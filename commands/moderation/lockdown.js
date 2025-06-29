// Init
const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const LOCKDOWN_LOG_CHANNEL_ID = '1388764830663442522';
const ALLOWED_ROLES = ['1333691633551540275', '1361410527389286550', '1388259374111264791', '1360309600825639153', '1333769686583611392', '1382920873362722896', '1388335848138739893'];

// Data storage, will eventually need to be replaced with sqlite3
const lockdownChannels = new Map();

// Store client reference for message handler
let clientInstance = null;

// Helper function
function getLockedChannels() {
	return lockdownChannels;
}

// Initialize the sticky message handler
function initializeStickyHandler(client) {
	clientInstance = client;
	
	client.on('messageCreate', async (message) => {
		// Ignore bot messages to prevent infinite loops
		if (message.author.bot) return;
		
		// Check if this message was sent in a locked channel
		if (lockdownChannels.has(message.channel.id)) {
			const lockInfo = lockdownChannels.get(message.channel.id);
			
			try {
				// Try to delete the old sticky message
				if (lockInfo.messageId) {
					try {
						const oldStickyMessage = await message.channel.messages.fetch(lockInfo.messageId);
						await oldStickyMessage.delete();
					} catch (error) {
						// Old message might already be deleted, that's okay
						console.log('Old sticky message not found or already deleted');
					}
				}
				
				// Send new sticky message
				const newStickyMessage = await message.channel.send({
					embeds: [{
						color: 0xFF0000,
						title: '🔒 Channel Locked',
						description: 'This channel has been locked. Only users with specific roles can send messages.',
						timestamp: new Date().toISOString(),
						footer: {
							text: 'Use /unlock to unlock the channel',
						},
					}],
				});
				
				// Update the stored message ID
				lockInfo.messageId = newStickyMessage.id;
				lockdownChannels.set(message.channel.id, lockInfo);
				
			} catch (error) {
				console.error('Error handling sticky message:', error);
			}
		}
	});
}

module.exports = [
	{
		category: 'moderation',
		data: new SlashCommandBuilder()
			.setName('lock')
			.setDescription('Locks the current channel')
			.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		async execute(interaction) {
			// My love
			const { guild, channel } = interaction;

			// Checks if user has permissions
			if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
				return await interaction.reply({
					content: 'Senko says you do not have permission to run this command nya~',
					ephemeral: true,
				});
			}

			// Checks if the bot has permissions
			if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
				return await interaction.reply({
					content: 'I Senko nya~ do not have permission to do this!',
					ephemeral: true,
				});
			}

			// Last base check for if the channel has already been locked
			if (lockdownChannels.has(channel.id)) {
				return await interaction.reply({
					content: 'You silly billy nyaa~ this channel is already locked!',
					ephemeral: true,
				});
			}

			// Defer the reply to prevent timeout
			await interaction.deferReply({ ephemeral: true });

			try {
				// First we're going to need to grab the everyone role
				const everyoneRole = guild.roles.everyone;

				// Remove the permissions to send messages
				await channel.permissionOverwrites.edit(everyoneRole, {
					SendMessages: false,
				});

				// Now we need to make sure the users that have permission can still message
				for (const roleId of ALLOWED_ROLES) {
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
							text: 'Use /unlock to unlock the channel',
						},
					}],
				});

				// Store the info, will need to be updated to sqlite3 at a later date
				lockdownChannels.set(channel.id, {
					messageId: lockMessage.id,
					allowedRoles: ALLOWED_ROLES,
				});

				// Log embed
				const lockEmbed = new EmbedBuilder()
					.setTitle('🔒 Channel Locked')
					.setColor(0xFF0000)
					.addFields(
						{ name: 'Channel', value: `${channel.name} (<#${channel.id}>)`, inline: true },
						{ name: 'Locked by', value: `${interaction.user.username} (${interaction.user.displayName})`, inline: true },
					)
					.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `Channel ID: ${channel.id}` });

				const logChannel = guild.channels.cache.get(LOCKDOWN_LOG_CHANNEL_ID);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [lockEmbed] });
					} catch (logError) {
						console.error('Error sending log to channel:', logError);
					}
				} else {
					console.warn('Log channel not found or is not a text channel');
				}

				// Send the confirm response
				await interaction.editReply({
					content: `**Locked** ${channel.name} channel.`,
				});

			} catch (error) {
				console.error('There has been an error with the lock command:', error);
				return await interaction.editReply({
					content: 'Uh-oh I do not feel good (error)',
				});
			}
		},
	},
	{
		category: 'moderation',
		data: new SlashCommandBuilder()
			.setName('unlock')
			.setDescription('Unlocks the current channel')
			.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
		async execute(interaction) {
			// My love
			const { guild, channel } = interaction;

			// Checks if user has permissions
			if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
				return await interaction.reply({
					content: 'Senko says you do not have permission to run this command nya~',
					ephemeral: true,
				});
			}

			// Checks if the bot has permissions
			if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageChannels)) {
				return await interaction.reply({
					content: 'I Senko nya~ do not have permission to do this!',
					ephemeral: true,
				});
			}

			// Last base check for if the channel has already been locked
			if (!lockdownChannels.has(channel.id)) {
				return await interaction.reply({
					content: 'You silly billy nyaa~ this channel is not currently locked!',
					ephemeral: true,
				});
			}

			// Defer the reply to prevent timeout
			await interaction.deferReply({ ephemeral: false });

			try {
				// First we're going to need to grab the everyone role
				const everyoneRole = guild.roles.everyone;

				// Remove the permissions to send messages
				await channel.permissionOverwrites.edit(everyoneRole, {
					SendMessages: null,
				});

				// Now we need to make sure the users that have permission are reset to default
				for (const roleId of ALLOWED_ROLES) {
					// Grab the role IDs
					const role = guild.roles.cache.get(roleId);
					// Make sure they can message
					if (role) {
						await channel.permissionOverwrites.edit(role, {
							SendMessages: null,
						});
					}
				}

				const lockInfo = lockdownChannels.get(channel.id);
				if (lockInfo) {
					try {
						const stickyMessage = await channel.messages.fetch(lockInfo.messageId);
						await stickyMessage.delete();
					} catch (error) {
						console.log('Sticky message already deleted or not found');
					}
					lockdownChannels.delete(channel.id);
				}

				// Log embed
				const unlockedEmbed = new EmbedBuilder()
					.setTitle('🔓 Channel Unlocked')
					.setColor(0x00ff00)
					.addFields(
						{ name: 'Channel', value: `${channel.name} (<#${channel.id}>)`, inline: true },
						{ name: 'Unlocked by', value: `${interaction.user.username} (${interaction.user.displayName})`, inline: true },
					)
					.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `Channel ID: ${channel.id}` });

				const logChannel = guild.channels.cache.get(LOCKDOWN_LOG_CHANNEL_ID);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [unlockedEmbed] });
					} catch (logError) {
						console.error('Error sending log to channel:', logError);
					}
				} else {
					console.warn('Log channel not found or is not a text channel');
				}

				// Send the confirm response
				await interaction.editReply({
					embeds: [unlockedEmbed],
				});

			} catch (error) {
				console.error('There has been an error with the Unlock command:', error);
				return await interaction.editReply({
					content: 'Uh-oh I do not feel good (error)',
				});
			}
		},
	},
];

// Export functions
module.exports.getLockedChannels = getLockedChannels;
module.exports.initializeStickyHandler = initializeStickyHandler;