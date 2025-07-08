const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../configuration/configuration.js');

module.exports = {
	category: 'moderation',
	textEnabled: true,
	data: new SlashCommandBuilder()
		.setName('kick')
		.setDescription('kick a user for sometimes a reason.')
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('User to kick.')
				.setRequired(true),
		)
		.addStringOption(option =>
			option.setName('reason')
				.setDescription('Reason for kicking said user.'),
		)
		.addBooleanOption(option =>
			option.setName('silent')
				.setDescription('Is this kick silent?'),
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
				return await message.reply('Usage: `,kick <user|user_Id> [reason]`');
			}

			// Parse args
			const userMention = args[0];
			const reasonArgs = args.slice(1);
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



		// Checking if the user has permission to kick a user.
		if (!member.permissions.has(PermissionFlagsBits.KickMembers)) {
			const content = 'You do not have permission to kick members.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
			const content = 'I Senko do not have permission to kick members.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		try {
			// Grabbing guildId, members and then fetching the targets id
			let targetMember;
			try {
				targetMember = await guild.members.fetch(target.id);
			} catch (error) {
				// If the user isn't in the server we will still kick by ID
				targetMember = null;
			}

			if (targetMember) {
				// Checking role hierarchy between bot
				if (!targetMember.kickable) {
					const content = 'I cannot kick this user- as they may have a higher role than me or be the server owner; or could even of been myself that you were trying to kick?';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}

				// Checking role hierarchy between user
				if (member.roles.highest.position <= targetMember.roles.highest.position && guild.ownerId !== user.id) {
					const content = 'You cannot kick someone with an equal or higher role than you.';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}
			}

			const finalReason = `Kicked by ${user.username} | ${reason}`;

			if (targetMember) {
				await targetMember.kick({ reason: finalReason });
			} else {
				await guild.members.kick(target.id, { reason: finalReason });
			}

			const kickEmbed = new EmbedBuilder()
				.setTitle('🔨 User Kicked')
				.setColor(0xFF0000)
				.addFields(
					{ name: 'Kicked User', value: `${target.username} (${target.displayName})`, inline: true },
					{ name: 'Kicked by', value: `${user.username} (${user.displayName})`, inline: true },
					{ name: 'Reason', value: reason, inline: false },
					{ name: 'Silent Kick', value: silent ? 'Yes' : 'No', inline: true },
				)
				.setThumbnail(target.displayAvatarURL({ dynamic: true }))
				.setTimestamp()
				.setFooter({ text: `User ID: ${target.id}` });

			// Get config
			const guildConfig = getGuildConfig(guild.id);
			const LogChannelId = guildConfig.kick_log_channel_id;

			// Send to configured logs
			if (LogChannelId) {
				const logChannel = guild.channels.cache.get(LogChannelId);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [kickEmbed] });
					} catch (logError) {
						console.error('Error sending log to log channel:', logError);
					}
				} else {
					console.warn('Configured log channel not found or is not a text channel.');
				}
			} else {
				console.log('No log channel configured for this guild.');
			}

			// Then send the appropriate response
			if (silent) {
				const content = `**SILENT: Kicked** ${target.username} for **Reason:** ${reason}`;
				return await interactionOrMessage.reply({ content, ephemeral: true });
			} else {
				const content = `**Kicked** ${target.username} for **Reason:** ${reason}`;
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

		} catch (error) {
			console.error('Error kicking user:', error);
			const content = 'There was an error trying to kick this user.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}
	},
};