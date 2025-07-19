const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../configuration/configuration.js');

module.exports = {
	category: 'moderation',
	aliases: ['ub'],
	textEnabled: true,
	data: new SlashCommandBuilder()
		.setName('unban')
		.setDescription('Unbans a user for sometimes a reason.')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('User to unban.')
				.setRequired(true),
		)
		.addStringOption(option =>
			option.setName('reason')
				.setDescription('Reason for unbaning said user.'),
		)
		.addBooleanOption(option =>
			option.setName('silent')
				.setDescription('Is this unban silent?'),
		),
	async execute(interactionOrMessage, args) {
		// Check if slash or text
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		// Declare vars
		let target, reason, silent, guild, member, user, interaction, guildConfig;

		if (isSlashCommand) {
			interaction = interactionOrMessage;
			guild = interaction.guild;
			member = interaction.member;
			user = interaction.user;

			// Get config
			guildConfig = getGuildConfig(guild.id);

			target = interaction.options.getUser('user');
			reason = interaction.options.getString('reason') ?? 'No reason provided.';
			silent = interaction.options.getBoolean('silent') ?? false;

		} else {
			// Text command parsing
			const message = interactionOrMessage;
			guild = message.guild;
			member = message.member;
			user = message.author;

			// Get config
			guildConfig = getGuildConfig(guild.id);
			const prefix = guildConfig.prefix;

			// Check if they're using it right
			if (!args || args.length < 1) {
				return await message.reply(`Usage: \`${prefix}unban <user|user_Id> [reason]\``);
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

		// Checking if the user has permission to ban a user.
		if (!member.permissions.has(PermissionFlagsBits.BanMembers)) {
			const content = 'You do not have permission to unban members.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
			const content = 'I Senko do not have permission to unban members.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		try {
			// Check if the user is actually banned
			let banInfo = null;
			try {
				const bans = await guild.bans.fetch();
				banInfo = bans.get(target.id);
			} catch (error) {
				console.error('Error fetching bans:', error);
				const content = 'There was an error checking the ban list.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// If user is not banned, return early
			if (!banInfo) {
				const content = `**${target.username}** is not currently banned from this server.`;
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// User is banned, proceed with unban
			await guild.members.unban(target.id, reason);

			const banEmbed = new EmbedBuilder()
				.setTitle('✨ User Unbanned')
				.setColor(0xFF0000)
				.addFields(
					{ name: 'Unbanned User', value: `${target.username} (${target.displayName})`, inline: true },
					{ name: 'Unbanned by', value: `${user.username} (${user.displayName})`, inline: true },
					{ name: 'Reason', value: reason, inline: false },
					{ name: 'Silent Unban', value: silent ? 'Yes' : 'No', inline: true },
				)
				.setThumbnail(target.displayAvatarURL({ dynamic: true }))
				.setTimestamp()
				.setFooter({ text: `User ID: ${target.id}` });

			const LogChannelId = guildConfig.ban_log_channel_id;

			// Send to configured logs
			if (LogChannelId) {
				const logChannel = guild.channels.cache.get(LogChannelId);
				if (logChannel && logChannel.isTextBased()) {
					try {
						await logChannel.send({ embeds: [banEmbed] });
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
				const content = `**SILENT: UnBanned** ${target.username} for **Reason:** ${reason}`;
				return await interactionOrMessage.reply({ content, ephemeral: true });
			} else {
				const content = `**UnBanned** ${target.username} for **Reason:** ${reason}`;
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: false })
					: await interactionOrMessage.reply(content);
			}

		} catch (error) {
			console.error('Error unbanning user:', error);
			const content = 'There was an error trying to unban this user.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}
	},
};