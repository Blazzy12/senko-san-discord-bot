const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');

// We're going to initialize the sqlite3 database
const databasePath = path.join(__dirname, 'warnings.db');
const db = new Database(databasePath);

const WARN_LOG_CHANNEL_ID = '1388444962625949706';

// Create the warnings table if it were to not exist
db.exec(`CREATE TABLE IF NOT EXISTS warnings (
	id TEXT PRIMARY KEY,
	user_id TEXT NOT NULL,
	moderator_id TEXT NOT NULL,
	reason TEXT NOT NULL,
	guild_id TEXT NOT NULL,
	timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

// Indexing for faster response
db.exec(`CREATE INDEX IF NOT EXISTS idx_user_id ON warnings(user_id)`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_guild_id ON warnings(guild_id)`);

// Prepare the database for better performance
const statements = {
	getUserWarnings: db.prepare('SELECT * FROM warnings WHERE user_id = ? AND guild_id = ? ORDER BY timestamp ASC'),
	addwarning: db.prepare('INSERT INTO warnings (id, user_id, moderator_id, reason, guild_id) VALUES (?, ?, ?, ?, ?)'),
	getWarning: db.prepare('SELECT * FROM warnings WHERE id = ? and guild_id = ?'),
	removeWarning: db.prepare('DELETE FROM warnings WHERE id = ? and guild_id = ?'),
	countWarnings: db.prepare('SELECT COUNT(*) as count FROM warnings WHERE user_id = ? AND guild_id = ?'),
	clearWarnings: db.prepare('DELETE FROM warnings WHERE user_id = ? AND guild_id = ?'),
};

// Database function helpers
function getUserWarnings(userId, guildId) {
	return statements.getUserWarnings.all(userId, guildId);
}

function addWarning(userId, moderatorId, reason, guildId) {
	const warningId = Date.now().toString() + Math.random().toString(36).substr(2, 9);

	statements.addwarning.run(warningId, userId, moderatorId, reason, guildId);

	return {
		id: warningId,
		user_id: userId,
		moderator_id: moderatorId,
		reason: reason,
		guild_id: guildId,
		timestamp: new Date().toISOString(),
	};
}

function removeWarning(warningId, guildId) {
	const warning = statements.getWarning.get(warningId, guildId);

	if (!warning) {
		return null;
	}

	statements.removeWarning.run(warningId, guildId);
	return warning;
}

function clearWarnings(userId, guildId) {
	const result = statements.countWarnings.get(userId, guildId);
	const count = result.count;

	statements.clearWarnings.run(userId, guildId);
	return count;
}

function createWarningsEmbed(targetMember, userWarnings, page = 0, guild) {
	const warningsPerPage = 5;
	const startIndex = page * warningsPerPage;
	const endIndex = Math.min(startIndex + warningsPerPage, userWarnings.length);
	const totalPages = Math.ceil(userWarnings.length / warningsPerPage);

	const warningsEmbed = new EmbedBuilder()
		.setColor(0xffff00)
		.setTitle(`⚠️ Warnings for ${targetMember.username}`)
		.setDescription(`Total warnings: **${userWarnings.length}** | Page **${page + 1}** of **${totalPages}**\n**Server:** ${guild.name}`)
		.setThumbnail(targetMember.displayAvatarURL({ dynamic: true }))
		.setTimestamp()
		.setFooter({ text: `User ID: ${targetMember.id}` });

	return { warningsEmbed, startIndex, endIndex, totalPages };
}

module.exports = [
	{
		textEnabled: true,
		category: 'moderation',
		data: new SlashCommandBuilder()
			.setName('warn')
			.setDescription('Distribute a warning to a member.')
			.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
			.addUserOption(option =>
				option.setName('user')
					.setDescription('User to warn.')
					.setRequired(true),
			)
			.addStringOption(option =>
				option.setName('reason')
					.setDescription('Reason for warning the member.'),
			)
			.addBooleanOption(option =>
				option.setName('silent')
					.setDescription('Is this warn silent?'),
			),
		async execute(interactionOrMessage, args) {

			// Check if slash
			const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

			// Declare Vars
			let target, reason, silent, guild, member, user, interaction;

			if (isSlashCommand) {
				interaction = interactionOrMessage;
				guild = interaction.guild;
				member = interaction.member;
				user = interaction.user;

				target = interaction.options.getUser('user');
				reason = interaction.options.getString('reason') ?? 'No reason provided.';
				silent = interaction.options.getBoolean('silent') ?? false;
			} else {
				// Text command parsing
				const message = interactionOrMessage;
				guild = message.guild;
				member = message.member;
				user = message.author;

				// Check if usage is right
				if (!args || args.length < 1) {
					return await message.reply('Usage: `,warn <user> || <user_Id> [reason]`');
				}

				// Parse args
				const userMention = args[0];
				const reasonArgs = args.slice(1);
				reason = reasonArgs.length > 0 ? reasonArgs.join(' ') : 'No reason provided';
				silent = false;

				// Extract
				const userMatch = userMention.match(/^<@!?(\d+)>$/) || userMention.match(/^(\d+)$/);
				if (!userMatch) {
					return await message.reply('Please provide a valid user or user_Id.');
				}

				try {
					target = await message.client.users.fetch(userMatch[1]);
				} catch (error) {
					return await message.reply('Could not find that user.');
				}
			}

			// We're first going to check if the user has permission to warn a user.
			if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				const content = 'You do not have permission to warn.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Now we're going to check if the bot has permission to warn.
			if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				const content = 'I Senko-San do not have permission to warn nya~';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			try {
				// Grab guildId, then fetch
				let targetMember;
				try {
					targetMember = await guild.members.fetch(target.id);
				} catch (error) {
					// If the user isn't in the server we can still warn via ID
					targetMember = null;
				}

				if (targetMember) {
					// Check if user is a bot
					if (targetMember.bot) {
						const content = 'You cannot warn bots!';
						return isSlashCommand
							? await interactionOrMessage.reply({ content, ephemeral: true })
							: await interactionOrMessage.reply(content);
					}
					// Check if the moderator is trying to warn themselves
					if (targetMember.id == user.id) {
						const content = 'You cannot warn yourself!';
						return isSlashCommand
							? await interactionOrMessage.reply({ content, ephemeral: true })
							: await interactionOrMessage.reply(content);
					}
				}

				if (targetMember) {
					const warning = addWarning(targetMember.id, user.id, reason, guild.id);
					const userWarnings = getUserWarnings(targetMember.id, guild.id);
				} else {
					const warning = addWarning(target.id, user.id, reason, guild.id);
					const userWarnings = getUserWarnings(target.id, guild.id);
				}

				const warnEmbed = new EmbedBuilder()
					.setColor(0xffff00)
					.setTitle('⚠️ User Warned!')
					.addFields(
						{ name: 'User', value: `${target.username} (${target.displayName})`, inline: true },
						{ name: 'Warned by', value: `${user.username} (${user.displayName})`, inline: true },
						{ name: 'Reason', value: reason, inline: false },
						{ name: 'Silent Warn', value: silent ? 'Yes' : 'No', inline: true },
					)
					.setThumbnail(target.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `User ID: ${target.id}` });

				const logChannel = guild.channels.cache.get(WARN_LOG_CHANNEL_ID);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [warnEmbed] });
					} catch (logError) {
						console.error('Error sending log to channel:', logError);
					}
				} else {
					console.warn('Log channel not found or is not a text channel.');
				}

				try {
					const dmEmbed = new EmbedBuilder()
						.setColor(0xffff00)
						.setTitle('⚠️ You have been warned!')
						.addFields(
							{ name: 'Server', value: guild.name, inline: true },
							{ name: 'Moderator', value: user.displayName, inline: true },
							{ name: 'Reason', value: reason, inline: false },
						)
						.setTimestamp();

					await target.send({ embeds: [dmEmbed] });
				} catch (error) {
					console.error(`Could not DM user ${target.username}`, error);
				}

				if (silent) {
					return await interactionOrMessage.reply({ embeds: [warnEmbed], ephemeral: true });
				} else {
					return isSlashCommand
						? await interactionOrMessage.reply({ embeds: [warnEmbed], ephemeral: false })
						: await interactionOrMessage.reply({ embeds: [warnEmbed] });
				}
			} catch (error) {
				console.error('Error warning user:', error);
				const content = 'There was an error trying to warn this user.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}
		},
	},
	{
		textEnabled: true,
		category: 'moderation',
		data: new SlashCommandBuilder()
			.setName('warnings')
			.setDescription('View the warnings of a member.')
			.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
			.addUserOption(option =>
				option.setName('user')
					.setDescription('User to check.')
					.setRequired(true),
			)
			.addBooleanOption(option =>
				option.setName('silent')
					.setDescription('Is this check silent?'),
			),
		async execute(interactionOrMessage, args) {

			// Check if slash or not
			const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

			// Declare vars
			let target, reason, silent, guild, member, user, interaction;

			if (isSlashCommand) {
				interaction = interactionOrMessage;
				guild = interaction.guild;
				member = interaction.member;
				user = interaction.user;

				target = interaction.options.getUser('user');
				silent = interaction.options.getBoolean('silent') ?? false;
			} else {
				// Text command parsing
				const message = interactionOrMessage;
				guild = message.guild;
				member = message.member;
				user = message.author;

				// Check if they're using it right
				if (!args || args.length < 1) {
					return await message.reply('Usage: `,warnings <user> || <user_Id>`');
				}

				// Parse args
				const userMention = args[0];
				silent = false;

				// Extract
				const userMatch = userMention.match(/^<@!?(\d+)>$/) || userMention.match(/^(\d+)$/);
				if (!userMatch) {
					return await message.reply('Please provide a valid user or user_Id.');
				}

				try {
					target = await message.client.users.fetch(userMatch[1]);
				} catch (error) {
					return await message.reply('Could not find that user.');
				}
			}

			// Check permissions
			if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				const content = 'You do not have permission to view warnings of a member.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			try {
				const userWarnings = getUserWarnings(target.id, guild.id);

				// Handle case with no warnings
				if (userWarnings.length === 0) {
					const noWarningsEmbed = new EmbedBuilder()
						.setColor(0x00ff00)
						.setTitle('✅ No Warnings Found')
						.setDescription(`${target.username} has no warnings in this server.`)
						.setThumbnail(target.displayAvatarURL({ dynamic: true }))
						.setTimestamp()
						.setFooter({ text: `User ID: ${target.id}` });

					return isSlashCommand
						? await interactionOrMessage.reply({ embeds: [noWarningsEmbed], ephemeral: silent })
						: await interactionOrMessage.reply({ embeds: [noWarningsEmbed] });
				}

				// Handle case with 5 or fewer warnings (simple embed)
				if (userWarnings.length <= 5) {
					const warningsEmbed = new EmbedBuilder()
						.setColor(0xffff00)
						.setTitle(`⚠️ Warnings for ${target.username}`)
						.setDescription(`Total warnings: **${userWarnings.length}**`)
						.setThumbnail(target.displayAvatarURL({ dynamic: true }))
						.setTimestamp()
						.setFooter({ text: `User ID: ${target.id}` });

					// Add warning fields
					for (let i = 0; i < userWarnings.length; i++) {
						const warning = userWarnings[i];
						const moderator = await guild.members.fetch(warning.moderator_id).catch(() => null);
						const moderatorName = moderator ? moderator.user.username : 'Unknown';

						const timestamp = new Date(warning.timestamp);
						const formatDate = timestamp.toLocaleDateString();
						const formatTime = timestamp.toLocaleTimeString();

						warningsEmbed.addFields({
							name: `Warning #${i + 1} - ${formatDate} at ${formatTime}`,
							value: `**Moderator:** ${moderatorName}\n**Reason:** ${warning.reason}\n**ID:** \`${warning.id}\``,
							inline: false,
						});
					}

					return isSlashCommand
						? await interactionOrMessage.reply({ embeds: [warningsEmbed], ephemeral: silent })
						: await interactionOrMessage.reply({ embeds: [warningsEmbed] });
				}

				// Handle case with more than 5 warnings
				let currentPage = 0;
				const { warningsEmbed, startIndex, endIndex, totalPages } = createWarningsEmbed(target, userWarnings, currentPage, guild);

				// Add warnings to current page
				for (let i = startIndex; i < endIndex; i++) {
					const warning = userWarnings[i];
					const moderator = await guild.members.fetch(warning.moderator_id).catch(() => null);
					const moderatorName = moderator ? moderator.user.username : 'Unknown';

					const timestamp = new Date(warning.timestamp);
					const formatDate = timestamp.toLocaleDateString();
					const formatTime = timestamp.toLocaleTimeString();

					warningsEmbed.addFields({
						name: `Warning #${i + 1} - ${formatDate} at ${formatTime}`,
						value: `**Moderator:** ${moderatorName}\n**Reason:** ${warning.reason}\n**ID:** \`${warning.id}\``,
						inline: false,
					});
				}

				// Create navigation buttons
				const row = new ActionRowBuilder()
					.addComponents(
						new ButtonBuilder()
							.setCustomId('previous_page')
							.setLabel('◀ Previous')
							.setStyle(ButtonStyle.Primary)
							.setDisabled(currentPage === 0),
						new ButtonBuilder()
							.setCustomId('next_page')
							.setLabel('Next ▶')
							.setStyle(ButtonStyle.Primary)
							.setDisabled(currentPage === totalPages - 1),
					);

				// const response = await interaction.reply({
				// 	embeds: [warningsEmbed],
				// 	components: [row],
				// 	ephemeral: silent,
				// });

				const response = await interactionOrMessage.reply({ embeds: [warningsEmbed], components: [row], ephemeral: silent });

				// Handle button interactions 5 minutes
				const collector = response.createMessageComponentCollector({
					time: 180000,
				});

				collector.on('collect', async (buttonInteraction) => {
					// Only allow the command user to use buttons
					if (buttonInteraction.user.id !== user.id) {
						return await buttonInteraction.reply({
							content: 'You cannot use these buttons.',
							ephemeral: true,
						});
					}

					// Update page
					if (buttonInteraction.customId === 'previous_page' && currentPage > 0) {
						currentPage--;
					} else if (buttonInteraction.customId === 'next_page' && currentPage < totalPages - 1) {
						currentPage++;
					}

					// Create new embed for current page
					const { warningsEmbed: newEmbed, startIndex: newStart, endIndex: newEnd } = createWarningsEmbed(target, userWarnings, currentPage, guild);

					// Add warnings to new embed
					for (let i = newStart; i < newEnd; i++) {
						const warning = userWarnings[i];
						const moderator = await guild.members.fetch(warning.moderator_id).catch(() => null);
						const moderatorName = moderator ? moderator.user.username : 'Unknown';

						const timestamp = new Date(warning.timestamp);
						const formatDate = timestamp.toLocaleDateString();
						const formatTime = timestamp.toLocaleTimeString();

						newEmbed.addFields({
							name: `Warning #${i + 1} - ${formatDate} at ${formatTime}`,
							value: `**Moderator:** ${moderatorName}\n**Reason:** ${warning.reason}\n**ID:** \`${warning.id}\``,
							inline: false,
						});
					}

					// Update buttons
					const newRow = new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('previous_page')
								.setLabel('◀ Previous')
								.setStyle(ButtonStyle.Primary)
								.setDisabled(currentPage === 0),
							new ButtonBuilder()
								.setCustomId('next_page')
								.setLabel('Next ▶')
								.setStyle(ButtonStyle.Primary)
								.setDisabled(currentPage === totalPages - 1),
						);

					await buttonInteraction.update({
						embeds: [newEmbed],
						components: [newRow],
					});
				});

				collector.on('end', async () => {
					// Disable buttons when collector expires
					const disabledRow = new ActionRowBuilder()
						.addComponents(
							new ButtonBuilder()
								.setCustomId('previous_page')
								.setLabel('◀ Previous')
								.setStyle(ButtonStyle.Primary)
								.setDisabled(true),
							new ButtonBuilder()
								.setCustomId('next_page')
								.setLabel('Next ▶')
								.setStyle(ButtonStyle.Primary)
								.setDisabled(true),
						);

					try {
						await response.edit({ components: [disabledRow] });
					} catch (error) {
						console.error('Could not disable buttons:', error);
					}
				});

			} catch (error) {
				console.error('Error viewing user warnings:', error);
				const content = 'There was an error checking this user\'s warnings.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}
		},
	},
	{
		category: 'moderation',
		data: new SlashCommandBuilder()
			.setName('clearwarnings')
			.setDescription('Clear the warnings of a member.')
			.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
			.addUserOption(option =>
				option.setName('user')
					.setDescription('User to clear warnings of.')
					.setRequired(true),
			)
			.addBooleanOption(option =>
				option.setName('silent')
					.setDescription('Is this action silent?'),
			),
		async execute(interaction) {
			// Init
			const { options, guild } = interaction;
			const targetMember = options.getUser('user');
			const silent = options.getBoolean('silent');

			// Permission Check
			if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				return await interaction.reply({
					content: 'You do not have permissions to clear warnings nyaaaa~',
					ephemeral: true,
				});
			}

			try {
				// Get warnings
				const userWarnings = getUserWarnings(targetMember.id, guild.id);

				if (userWarnings.length === 0) {
					return await interaction.reply({
						content: `${targetMember.username} does not have any warnings to remove!`,
						ephemeral: true,
					});
				}

				// Clear the warnings now
				const clearCount = clearWarnings(targetMember.id, guild.id);

				const clearEmbed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle('✅ Warnings Cleared!')
					.addFields (
						{ name: 'User', value: `${targetMember.username} (${targetMember.displayName})`, inline: true },
						{ name: 'Cleared By', value: `${interaction.user.username} (${interaction.user.displayName})`, inline: true },
						{ name: 'Warnings Cleared', value: `${clearCount}`, inline: true },
					)
					.setThumbnail(targetMember.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `User ID: ${targetMember.id}` });

				// Log to channel
				const logChannel = guild.channels.cache.get(WARN_LOG_CHANNEL_ID);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [clearEmbed] });
					} catch (logError) {
						console.error('Error sending log to channel:', logError);
					}
				} else {
					console.warn('Log channel not found or is not a text channel.');
				}

				// Reply
				await interaction.reply({
					embeds: [clearEmbed],
					ephemeral: silent,
				});
			} catch (error) {
				console.error('There was an error trying to clear a users warnings:', error);
				await interaction.reply({
					content: 'Error removing users warning',
					ephemeral: true,
				});
			}
		},
	},
	{
		category: 'moderation',
		data: new SlashCommandBuilder()
			.setName('removewarn')
			.setDescription('Clear the warn of a member.')
			.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
			.addStringOption(option =>
				option.setName('warn_id')
					.setDescription('Warning id to clear.')
					.setRequired(true),
			)
			.addBooleanOption(option =>
				option.setName('silent')
					.setDescription('Is this action silent?'),
			),
		async execute(interaction) {
			const { options, guild } = interaction;
			const warningId = options.getString('warn_id');
			const silent = options.getBoolean('silent') ?? false;

			if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				return await interaction.reply({
					content: 'You do not have permission to remove warnings nya~',
					ephemeral: true,
				});
			}

			try {
				// Remove the warning
				const removedWarning = removeWarning(warningId, guild.id);

				// Check if the warning id exists
				if (!removedWarning) {
					return await interaction.reply({
						content: 'Warning not found, nya is angry, NYAAAAAAAA!',
						ephemeral: true,
					});
				}

				// Grab the user
				const targetUser = await guild.members.fetch(removedWarning.user_id).catch(() => null);
				const targetUsername = targetUser ? targetUser.user.username : 'Unknown';
				const targetDisplayName = targetUser ? targetUser.user.displayName : 'Unknown';

				// Grab the moderator
				const moderator = await guild.members.fetch(removedWarning.moderator_id).catch(() => null);
				const moderatorName = moderator ? moderator.user.username : 'Unknown';

				// Embed
				const removeEmbed = new EmbedBuilder()
					.setColor(0x00ff00)
					.setTitle('✅ Warning Removed!')
					.addFields(
						{ name: 'User', value: `${targetUsername} (${targetDisplayName})`, inline: true },
						{ name: 'Removed by', value: `${interaction.user.username} (${interaction.user.displayName})`, inline: true },
						{ name: 'Warning ID', value: `\`${warningId}\``, inline: true },
						{ name: 'Original Reason', value: removedWarning.reason, inline: false },
						{ name: 'Originally Warned by', value: moderatorName, inline: true },
						{ name: 'Original Date', value: new Date(removedWarning.timestamp).toLocaleDateString(), inline: true },
					)
					.setThumbnail(targetUser ? targetUser.user.displayAvatarURL({ dynamic: true }) : null)
					.setTimestamp()
					.setFooter({ text: `User ID: ${removedWarning.user_id}` });

				// Log to channel
				const logChannel = guild.channels.cache.get(WARN_LOG_CHANNEL_ID);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [removeEmbed] });
					} catch (logError) {
						console.error('Error sending log to channel:', logError);
					}
				} else {
					console.warn('Log channel not found or is not a text channel.');
				}

				// Reply
				await interaction.reply({
					embeds: [removeEmbed],
					ephemeral: silent,
				});
			} catch (error) {
				console.error('There was an error trying to remove a users warning:', error);
				await interaction.reply({
					content: 'There was an issue removing the users warning.',
					ephemeral: true,
				});
			}
		},
	},
];