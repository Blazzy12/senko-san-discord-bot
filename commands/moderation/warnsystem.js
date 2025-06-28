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
		timestamp: new Date().toISOString()
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
		.setDescription(`Total warnings: **${userWarnings.length}** | Page **${page + 1}** of **${totalPages}**`)
		.setThumbnail(targetMember.displayAvatarURL({ dynamic: true }))
		.setTimestamp()
		.setFooter({ text: `User ID: ${targetMember.id}` });

	return { warningsEmbed, startIndex, endIndex, totalPages };
}

module.exports = [
	{
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
					.setDescription('Reason for warning the member.')
			)
			.addBooleanOption(option =>
				option.setName('silent')
					.setDescription('Is this warn silent?'),
			),
		async execute(interaction) {
			const { options, guild } = interaction;

			const targetMember = options.getUser('user');
			const reason = options.getString('reason') ?? 'No reason provided.';
			const silent = options.getBoolean('silent') ?? false;

			// We're first going to check if the user has permission to warn a user.
			if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				return await interaction.reply({
					content: 'You do not have permission to warn.',
					ephemeral: true,
				});
			}

			// Now we're going to check if the bot has permission to warn.
			if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				return await interaction.reply({
					content: 'I Senko-San do not have permission to warn nya~',
					ephemeral: true,
				});
			}

			try {
				// Check if user is a bot
				if (targetMember.bot) {
					return await interaction.reply({
						content: 'You cannot warn bots!',
						ephemeral: true,
					});
				}

				// Check if the moderator is trying to warn themselves
				if (targetMember.id == interaction.user.id) {
					return await interaction.reply({
						content: 'You cannot warn yourself!',
						ephemeral: true,
					});
				}

				const warning = addWarning(targetMember.id, interaction.user.id, reason, guild.id);
				const userWarnings = getUserWarnings(targetMember.id, guild.id);

				const warnEmbed = new EmbedBuilder()
					.setColor(0xffff00)
					.setTitle('⚠️ User Warned!')
					.addFields(
						{ name: 'User', value: `${targetMember.username} (${targetMember.displayName})`, inline: true },
						{ name: 'Warned by', value: `${interaction.user.username} (${interaction.user.displayName})`, inline: true },
						{ name: 'Reason', value: reason, inline: false },
						{ name: 'Silent Warn', value: silent ? 'Yes' : 'No', inline: true},
					)
					.setThumbnail(targetMember.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `User ID: ${targetMember.id}` });

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

				if (silent) {
					await interaction.reply({
						embeds: [warnEmbed],
						ephemeral: true,
					});
				} else {
					await interaction.reply({
						embeds: [warnEmbed],
						ephemeral: false,
					});
				}

				try {
					const dmEmbed = new EmbedBuilder()
						.setColor(0xffff00)
						.setTitle('⚠️ You have been warned!')
						.addFields(
							{ name: 'Server', value: guild.name, inline: true},
							{ name: 'Moderator', value: interaction.user.displayName, inline: true},
							{ name: 'Reason', value: reason, inline: false},
						)
						.setTimestamp();

					await targetMember.send({ embeds: [dmEmbed] });
				} catch (error) {
					console.error(`Could not DM user ${targetMember.username}`, error);
				}
			} catch (error) {
				console.error('Error warning user:', error);
				await interaction.reply({
					content: 'There was an error trying to warn this user.',
					ephemeral: true,
				});
			}
		},
	},
	{
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
		async execute(interaction) {
			const { options, guild } = interaction;
			const targetMember = options.getUser('user');
			const silent = options.getBoolean('silent') ?? false;

			// Check permissions
			if (!interaction.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				return await interaction.reply({
					content: 'You do not have permission to view warnings of a member.',
					ephemeral: true,
				});
			}

			try {
				const userWarnings = getUserWarnings(targetMember.id, guild.id);

				// Handle case with no warnings
				if (userWarnings.length === 0) {
					const noWarningsEmbed = new EmbedBuilder()
						.setColor(0x00ff00)
						.setTitle('✅ No Warnings Found')
						.setDescription(`${targetMember.username} has no warnings in this server.`)
						.setThumbnail(targetMember.displayAvatarURL({ dynamic: true }))
						.setTimestamp()
						.setFooter({ text: `User ID: ${targetMember.id}` });


					return await interaction.reply({
						embeds: [noWarningsEmbed],
						ephemeral: silent,
					});
				}

				// Handle case with 5 or fewer warnings (simple embed)
				if (userWarnings.length <= 5) {
					const warningsEmbed = new EmbedBuilder()
						.setColor(0xffff00)
						.setTitle(`⚠️ Warnings for ${targetMember.username}`)
						.setDescription(`Total warnings: **${userWarnings.length}**`)
						.setThumbnail(targetMember.displayAvatarURL({ dynamic: true }))
						.setTimestamp()
						.setFooter({ text: `User ID: ${targetMember.id}` });

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

					return await interaction.reply({
						embeds: [warningsEmbed],
						ephemeral: silent,
					});
				}

				// Handle case with more than 5 warnings
				let currentPage = 0;
				const { warningsEmbed, startIndex, endIndex, totalPages } = createWarningsEmbed(targetMember, userWarnings, currentPage, guild);

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

				const response = await interaction.reply({
					embeds: [warningsEmbed],
					components: [row],
					ephemeral: silent,
				});

				// Handle button interactions 5 minutes
				const collector = response.createMessageComponentCollector({
					time: 300000,
				});

				collector.on('collect', async (buttonInteraction) => {
					// Only allow the command user to use buttons
					if (buttonInteraction.user.id !== interaction.user.id) {
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
					const { warningsEmbed: newEmbed, startIndex: newStart, endIndex: newEnd } = createWarningsEmbed(targetMember, userWarnings, currentPage, guild);

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
				await interaction.reply({
					content: 'There was an error checking this user\'s warnings.',
					ephemeral: true,
				});
			}
		},
	},
];

// catch (error) {
// 			console.error('Error viewing user warnings:', error);
// 			await interaction.reply({
// 				content: 'There was an error checking the user warnings',
// 				ephemeral: true,
// 			});
// 		}