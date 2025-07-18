// Init
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../configuration/configuration.js');

// Data storage, will eventually need to be replaced with sqlite3
const lockdownChannels = new Map();
const unlockingChannels = new Set(); // Track channels currently being unlocked

// Store client reference for message handler
let clientInstance = null;

// Helper function
function getLockedChannels() {
	return lockdownChannels;
}

// Initialize the sticky message handler with better safeguards
function initializeStickyHandler(client) {
	clientInstance = client;

	client.on('messageCreate', async (message) => {
		// Ignore bot messages to prevent infinite loops
		if (message.author.bot) return;

		// Check if this channel is currently being unlocked
		if (unlockingChannels.has(message.channel.id)) {
			console.log(`Skipping sticky message for channel ${message.channel.id} - currently unlocking`);
			return;
		}

		// Check if this message was sent in a locked channel
		if (lockdownChannels.has(message.channel.id)) {
			console.log(`Processing sticky message for locked channel ${message.channel.id}`);

			// Double-check that we're not in the middle of unlocking
			if (unlockingChannels.has(message.channel.id)) {
				console.log(`Aborting sticky message - channel ${message.channel.id} is unlocking`);
				return;
			}

			const lockInfo = lockdownChannels.get(message.channel.id);

			try {
				// Try to delete the old sticky message
				if (lockInfo.messageId) {
					try {
						const oldStickyMessage = await message.channel.messages.fetch(lockInfo.messageId);
						await oldStickyMessage.delete();
						console.log('Old sticky message deleted');
					} catch (error) {
						// Old message might already be deleted, that's okay
						console.log('Old sticky message not found or already deleted');
					}
				}

				// Final check before creating new sticky message
				if (unlockingChannels.has(message.channel.id)) {
					console.log(`Aborting sticky message creation - channel ${message.channel.id} is unlocking`);
					return;
				}

				// Send new sticky message
				const newStickyMessage = await message.channel.send({
					embeds: [{
						color: 0xFF0000,
						title: '🔒 Channel Locked',
						description: 'This channel has been locked. Only users with specific roles can send messages.',
						timestamp: new Date().toISOString(),
						footer: {
							text: 'Use /unlock or ,unlock to unlock the channel',
						},
					}],
				});

				// Update the stored message ID only if we're still locked
				if (lockdownChannels.has(message.channel.id)) {
					lockInfo.messageId = newStickyMessage.id;
					lockdownChannels.set(message.channel.id, lockInfo);
					console.log(`New sticky message created with ID: ${newStickyMessage.id}`);
				} else {
					// If we're no longer locked, delete the message we just created
					try {
						await newStickyMessage.delete();
						console.log('Deleted sticky message as channel is no longer locked');
					} catch (error) {
						console.error('Error deleting unnecessary sticky message:', error);
					}
				}

			} catch (error) {
				console.error('Error handling sticky message:', error);
			}
		}
	});
}

module.exports = [
	{
		textEnabled: true,
		category: 'moderation',
		data: new SlashCommandBuilder()
			.setName('lock')
			.setDescription('Locks the current channel')
			.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		async execute(interactionOrMessage) {
			// Check if slash or text
			const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

			// Declare vars
			let guild, channel, member, user, interaction;

			if (isSlashCommand) {
				interaction = interactionOrMessage;
				guild = interaction.guild;
				channel = interaction.channel;
				member = interaction.member;
				user = interaction.user;
			} else {
				const message = interactionOrMessage;
				guild = message.guild;
				channel = message.channel;
				member = message.member;
				user = message.author;
			}

			// Checks if user has permissions
			if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
				const content = 'Senko says you do not have permission to run this command nya~';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Checks if the bot has permissions
			if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
				const content = 'I Senko nya~ do not have permission to do this!';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Last base check for if the channel has already been locked
			if (lockdownChannels.has(channel.id)) {
				const content = 'You silly billy nyaa~ this channel is already locked!';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Get guild configuration to retrieve allowed roles
			const guildConfig = getGuildConfig(guild.id);
			let allowedRoles = [];

			// Parse the allowed roles from configuration
			if (guildConfig.lockdown_allowed_roles) {
				try {
					allowedRoles = JSON.parse(guildConfig.lockdown_allowed_roles);
				} catch (error) {
					console.error('Error parsing lockdown_allowed_roles:', error);
					const content = 'Error: Invalid lockdown roles configuration. Please check your server configuration.';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}
			}

			// If no roles are configured, we'll still allow locking (just removes @everyone permissions)
			if (!allowedRoles || allowedRoles.length === 0) {
				console.log(`No lockdown allowed roles configured for guild ${guild.id}. Locking will only remove @everyone permissions.`);
			}

			// Defer the reply to prevent timeout
			if (isSlashCommand) {
				await interactionOrMessage.deferReply({ ephemeral: true });
			}

			try {
				// First we're going to need to grab the everyone role
				const everyoneRole = guild.roles.everyone;

				// Remove the permissions to send messages
				await channel.permissionOverwrites.edit(everyoneRole, {
					SendMessages: false,
				});

				// Now we need to make sure the users that have permission can still message
				for (const roleId of allowedRoles) {
					// Grab the role IDs
					const role = guild.roles.cache.get(roleId);
					// Make sure they can message
					if (role) {
						await channel.permissionOverwrites.edit(role, {
							SendMessages: true,
						});
					}
				}

				// Send sticky message
				const lockMessage = await channel.send({
					embeds: [{
						color: 0xFF0000,
						title: '🔒 Channel Locked',
						description: 'This channel has been locked. Only users with specific roles can send messages.',
						timestamp: new Date().toISOString(),
						footer: {
							text: 'Use /unlock or ,unlock to unlock the channel',
						},
					}],
				});

				// Store the info, will need to be updated to sqlite3 at a later date
				lockdownChannels.set(channel.id, {
					messageId: lockMessage.id,
					allowedRoles: allowedRoles,
				});

				// Log embed
				const lockEmbed = new EmbedBuilder()
					.setTitle('🔒 Channel Locked')
					.setColor(0xFF0000)
					.addFields(
						{ name: 'Channel', value: `${channel.name} (<#${channel.id}>)`, inline: true },
						{ name: 'Locked by', value: `${user.username} (${user.displayName})`, inline: true },
					)
					.setThumbnail(user.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `Channel ID: ${channel.id}` });

				// Get log channel ID from config
				const LogChannelId = guildConfig.lockdown_log_channel_id;

				// Send to configured logs
				if (LogChannelId) {
					const logChannel = guild.channels.cache.get(LogChannelId);
					if (logChannel && logChannel.isTextBased()) {
						try {
							await logChannel.send({ embeds: [lockEmbed] });
						} catch (logError) {
							console.error('Error sending log to log channel:', logError);
						}
					} else {
						console.warn('Configured log channel not found or is not a text channel.');
					}
				} else {
					console.log('No log channel configured for this guild.');
				}

				// Send the confirm response
				const content = `**Locked** ${channel.name} channel.`;
				return isSlashCommand
					? await interactionOrMessage.editReply({ content })
					: await interactionOrMessage.reply(content);

			} catch (error) {
				console.error('There has been an error with the lock command:', error);
				const content = 'Uh-oh I do not feel good (error)';
				return isSlashCommand
					? await interactionOrMessage.editReply({ content })
					: await interactionOrMessage.reply(content);
			}
		},
	},
	{
		textEnabled: true,
		category: 'moderation',
		data: new SlashCommandBuilder()
			.setName('unlock')
			.setDescription('Unlocks the current channel')
			.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		async execute(interactionOrMessage) {
			// Check if slash or text
			const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

			// Declare vars
			let guild, channel, member, user, interaction;

			if (isSlashCommand) {
				interaction = interactionOrMessage;
				guild = interaction.guild;
				channel = interaction.channel;
				member = interaction.member;
				user = interaction.user;
			} else {
				const message = interactionOrMessage;
				guild = message.guild;
				channel = message.channel;
				member = message.member;
				user = message.author;
			}

			// Checks if user has permissions
			if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
				const content = 'Senko says you do not have permission to run this command nya~';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Checks if the bot has permissions
			if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
				const content = 'I Senko nya~ do not have permission to do this!';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Last base check for if the channel has already been locked
			if (!lockdownChannels.has(channel.id)) {
				const content = 'You silly billy nyaa~ this channel is not currently locked!';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Get the stored lock info to retrieve the allowed roles that were used
			const lockInfo = lockdownChannels.get(channel.id);
			const allowedRoles = lockInfo ? lockInfo.allowedRoles : [];

			try {
				// IMMEDIATELY mark this channel as being unlocked to prevent sticky messages
				unlockingChannels.add(channel.id);
				console.log(`Channel ${channel.id} marked as unlocking`);

				// Delete the sticky message if it exists BEFORE deferring
				if (lockInfo && lockInfo.messageId) {
					try {
						const stickyMessage = await channel.messages.fetch(lockInfo.messageId);
						await stickyMessage.delete();
						console.log('Sticky message deleted successfully');
					} catch (error) {
						console.log('Sticky message already deleted or not found:', error.message);
					}
				}

				// Remove the channel from lockdown tracking
				lockdownChannels.delete(channel.id);
				console.log(`Channel ${channel.id} removed from lockdown tracking`);

				// Now defer the reply (this prevents the deferred message from triggering sticky)
				if (isSlashCommand) {
					await interactionOrMessage.deferReply({ ephemeral: false });
				}

				// Reset channel permissions
				const everyoneRole = guild.roles.everyone;

				// Remove the permissions to send messages (reset to default)
				await channel.permissionOverwrites.edit(everyoneRole, {
					SendMessages: null,
				});

				// Reset role permissions to default
				for (const roleId of allowedRoles) {
					const role = guild.roles.cache.get(roleId);
					if (role) {
						await channel.permissionOverwrites.edit(role, {
							SendMessages: null,
						});
					}
				}

				console.log(`Channel ${channel.id} permissions reset`);

				// Create and send the unlock embed
				const unlockedEmbed = new EmbedBuilder()
					.setTitle('🔓 Channel Unlocked')
					.setColor(0x00ff00)
					.addFields(
						{ name: 'Channel', value: `${channel.name} (<#${channel.id}>)`, inline: true },
						{ name: 'Unlocked by', value: `${user.username} (${user.displayName})`, inline: true },
					)
					.setThumbnail(user.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `Channel ID: ${channel.id}` });

				// Send to log channel
				const guildConfig = getGuildConfig(guild.id);
				const LogChannelId = guildConfig.lockdown_log_channel_id;

				if (LogChannelId) {
					const logChannel = guild.channels.cache.get(LogChannelId);
					if (logChannel && logChannel.isTextBased()) {
						try {
							await logChannel.send({ embeds: [unlockedEmbed] });
						} catch (logError) {
							console.error('Error sending log to log channel:', logError);
						}
					}
				}

				// Send the confirm response
				const result = isSlashCommand
					? await interactionOrMessage.editReply({ embeds: [unlockedEmbed] })
					: await interactionOrMessage.reply({ embeds: [unlockedEmbed] });

				// Remove the unlocking flag after a longer delay to be extra safe
				setTimeout(() => {
					unlockingChannels.delete(channel.id);
					console.log(`Channel ${channel.id} unmarked as unlocking`);
				}, 2000); // 2 second delay

				return result;

			} catch (error) {
				console.error('There has been an error with the Unlock command:', error);

				// Make sure to clean up the unlocking flag even on error
				unlockingChannels.delete(channel.id);

				const content = 'Uh-oh I do not feel good (error)';
				return isSlashCommand
					? await interactionOrMessage.editReply({ content })
					: await interactionOrMessage.reply(content);
			}
		},
	},
];

// Export functions
module.exports.getLockedChannels = getLockedChannels;
module.exports.initializeStickyHandler = initializeStickyHandler;