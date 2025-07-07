const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const MUTE_LOG_CHANNEL_ID = '1388764830663442522';

// Helper function to parse duration string to milliseconds
function parseDuration(duration) {
	const regex = /^(\d+)([smhdw])$/i;
	const match = duration.match(regex);

	if (!match) return null;

	const amount = parseInt(match[1]);
	const unit = match[2].toLowerCase();

	const multipliers = {
		's': 1000,                    // seconds
		'm': 60 * 1000,              // minutes
		'h': 60 * 60 * 1000,         // hours
		'd': 24 * 60 * 60 * 1000,    // days
		'w': 7 * 24 * 60 * 60 * 1000, // weeks
	};

	return amount * multipliers[unit];
}

module.exports = [
	{
		category: 'moderation',
		textEnabled: true,
		data: new SlashCommandBuilder()
			.setName('mute')
			.setDescription('Mute a user for a specific amount of time')
			.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
			.addUserOption(option =>
				option.setName('user')
					.setDescription('User to mute')
					.setRequired(true),
			)
			.addStringOption(option =>
				option.setName('duration')
					.setDescription('Duration of mute, (e.g. 5s, 10m, 15h, 20d)')
					.setRequired(true),
			)
			.addStringOption(option =>
				option.setName('reason')
					.setDescription('Reason for the mute?'),
			)
			.addBooleanOption(option =>
				option.setName('silent')
					.setDescription('Silent mute?'),
			),
		async execute(interactionOrMessage, args) {
			// Check if slash or text
			const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

			// Declare vars
			let target, duration, reason, silent, guild, member, user, interaction;

			if (isSlashCommand) {
				interaction = interactionOrMessage;
				guild = interaction.guild;
				member = interaction.member;
				user = interaction.user;

				target = interaction.options.getUser('user');
				duration = interaction.options.getString('duration');
				reason = interaction.options.getString('reason') ?? 'No reason provided.';
				silent = interaction.options.getBoolean('silent') ?? false;
			} else {
				// Text command parsing
				const message = interactionOrMessage;
				guild = message.guild;
				member = message.member;
				user = message.author;

				// Check if they're using it right
				if (!args || args.length < 2) {
					return await message.reply('Usage: `,mute <user> || <user_Id> <duration> [reason]`');
				}

				// Parse args
				const userMention = args[0];
				duration = args[1];
				const reasonArgs = args.slice(2);
				reason = reasonArgs.length > 0 ? reasonArgs.join(' ') : 'No reason provided.';
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

			// Parse duration to milliseconds
			const durationMs = parseDuration(duration);
			if (!durationMs) {
				const content = 'Invalid duration format. Use formats like: 5s, 10m, 1h, 2d, 1w (seconds, minutes, hours, days, weeks)';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Check if duration is too long (max 28 days for Discord timeout)
			if (durationMs > 28 * 24 * 60 * 60 * 1000) {
				const content = 'Duration cannot exceed 28 days due to Discord limitations.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Checking if the user has permission to moderate members
			if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				const content = 'You do not have permission to mute members.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				const content = 'I Senko do not have permission to mute members.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Grabbing guildId, members and then fetching the targets id
			try {
				let targetMember;
				try {
					targetMember = await guild.members.fetch(target.id);
				} catch (error) {
					const content = 'User isn\'t in the server silly!';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}

				// Checking if user is already muted
				if (targetMember.communicationDisabledUntil && targetMember.communicationDisabledUntil > Date.now()) {
					const content = 'You can\'t mute someone that is already muted.';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}

				// Checking if bot can mute the user
				if (!targetMember.moderatable) {
					const content = 'I cannot mute this user- as they may have a higher role than me or be the server owner; or could even of been myself that you were trying to mute?';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}
				// Checking role hierarchy between user
				if (member.roles.highest.position <= targetMember.roles.highest.position && guild.ownerId !== user.id) {
					const content = 'You cannot mute someone with an equal or higher role than you.';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}

				const finalReason = `${target.username} Muted by ${user.username} | ${duration} | ${reason}`;

				// Mute the user
				await targetMember.timeout(durationMs, finalReason);

				const muteEmbed = new EmbedBuilder()
					.setTitle('🔇 User Muted')
					.setColor(0xC2185B)
					.addFields(
						{ name: 'Muted User', value: `${target.username} (${target.displayName})`, inline: true },
						{ name: 'Muted by', value: `${user.username} (${user.displayName})`, inline: true },
						{ name: 'Duration', value: `${duration}`, inline: true },
						{ name: 'Reason', value: reason, inline: false },
						{ name: 'Silent Mute', value: silent ? 'Yes' : 'No', inline: true },
						{ name: 'Unmuted at', value: `<t:${Math.floor((Date.now() + durationMs) / 1000)}:F>`, inline: true },
					)
					.setThumbnail(target.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `User ID: ${target.id}` });

				const logChannel = guild.channels.cache.get(MUTE_LOG_CHANNEL_ID);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [muteEmbed] });
					} catch (logError) {
						console.error('Error sending log to channel:', logError);
					}
				} else {
					console.warn('Log channel not found or is not a text channel');
				}

				return isSlashCommand
					? await interactionOrMessage.reply({ content: finalReason, ephemeral: silent })
					: await interactionOrMessage.reply(finalReason);

			} catch (error) {
				console.error('Error muting user:', error);
				const content = 'There was an error trying to mute this user.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}
		},
	},
	{
		category: 'moderation',
		textEnabled: true,
		data: new SlashCommandBuilder()
			.setName('unmute')
			.setDescription('Unmutes a user.')
			.setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
			.addUserOption(option =>
				option.setName('user')
					.setDescription('User to unmute')
					.setRequired(true),
			)
			.addStringOption(option =>
				option.setName('reason')
					.setDescription('Reason for the unmute?'),
			)
			.addBooleanOption(option =>
				option.setName('silent')
					.setDescription('Silent unmute?'),
			),
		async execute(interactionOrMessage, args) {
			// Check if slash or text
			const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

			// Declare vars
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

				// Check if they're using it right
				if (!args || args.length < 1) {
					return await message.reply('Usage: `,unmute <user> || <user_Id> [reason]`');
				}

				// Parse args
				const userMention = args[0];
				const reasonArgs = args.slice(1);
				reason = reasonArgs.length > 0 ? reasonArgs.join(' ') : 'No reason provided.';
				silent = false;

				// Extract user ID
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

			// Checking if the user has permission to moderate members
			if (!member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				const content = 'You do not have permission to unmute members.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			if (!guild.members.me.permissions.has(PermissionFlagsBits.ModerateMembers)) {
				const content = 'I Senko do not have permission to unmute members.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Grabbing guild members and then fetching the target's id
			try {
				let targetMember;
				try {
					targetMember = await guild.members.fetch(target.id);
				} catch (error) {
					const content = 'User isn\'t in the server silly!';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}

				// Checking if user is actually muted
				if (!targetMember.communicationDisabledUntil || targetMember.communicationDisabledUntil < Date.now()) {
					const content = 'This user is not currently muted.';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}

				// Checking if bot can unmute the user
				if (!targetMember.moderatable) {
					const content = 'I cannot unmute this user- as they may have a higher role than me or be the server owner.';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}

				// Checking role hierarchy between user
				if (member.roles.highest.position <= targetMember.roles.highest.position && guild.ownerId !== user.id) {
					const content = 'You cannot unmute someone with an equal or higher role than you.';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}

				const finalReason = `${target.username} Unmuted by ${user.username} | ${reason}`;

				// Unmute the user
				await targetMember.timeout(null, finalReason);

				const unmuteEmbed = new EmbedBuilder()
					.setTitle('🔊 User Unmuted')
					.setColor(0xF8BBD9)
					.addFields(
						{ name: 'Unmuted User', value: `${target.username} (${target.displayName})`, inline: true },
						{ name: 'Unmuted by', value: `${user.username} (${user.displayName})`, inline: true },
						{ name: 'Reason', value: reason, inline: false },
						{ name: 'Silent Unmute', value: silent ? 'Yes' : 'No', inline: true },
					)
					.setThumbnail(target.displayAvatarURL({ dynamic: true }))
					.setTimestamp()
					.setFooter({ text: `User ID: ${target.id}` });

				const logChannel = guild.channels.cache.get(MUTE_LOG_CHANNEL_ID);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [unmuteEmbed] });
					} catch (logError) {
						console.error('Error sending log to channel:', logError);
					}
				} else {
					console.warn('Log channel not found or is not a text channel');
				}

				return isSlashCommand
					? await interactionOrMessage.reply({ content: finalReason, ephemeral: silent })
					: await interactionOrMessage.reply(finalReason);

			} catch (error) {
				console.error('Error unmuting user:', error);
				const content = 'There was an error trying to unmute this user.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}
		},
	},
];