const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

module.exports = {
	category: 'moderation',
	data: new SlashCommandBuilder()
		.setName('kick')
		.setDescription('Kicks a user.')
		.setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('Kicks a user for sometimes a reason.')
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
	async execute(interaction) {
		const { options, guild } = interaction;

		const target = options.getUser('user');
		const reason = options.getString('reason') ?? 'No reason provided.';
		const silent = options.getBoolean('silent') ?? false;

		const KICK_LOG_CHANNEL_ID = '1388319341828903124';

		// Checking if the user has permission to kick a user.
		if (!interaction.member.permissions.has(PermissionFlagsBits.KickMembers)) {
			return await interaction.reply({
				content: 'You do not have permission to kick members.',
				ephemeral: true,
			});
		}

		if (!guild.members.me.permissions.has(PermissionFlagsBits.KickMembers)) {
			return await interaction.reply({
				content: 'I do not have permission to kick members.',
				ephemeral: true,
			});
		}

		try {
			// Grabbing guildId, members and then fetching the targets id
			const targetMember = await guild.members.fetch(target.id);

			// Checking role hierarchy between bot
			if (!targetMember.kickable) {
				return await interaction.reply({
					content: 'I cannot kick this user- as they may have a higher role than me or be the server owner; or could even of been myself that you were trying to kick?',
					ephemeral: true,
				});
			}

			// Checking role hierarchy between user
			if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && guild.ownerId !== interaction.user.id) {
				return await interaction.reply({
					content: 'You cannot kick someone with an equal or higher role than you.',
					ephemeral: true,
				});
			}

			// Kick the user first
			await targetMember.kick({ reason });

			const kickEmbed = new EmbedBuilder()
				.setTitle('🔨 User Kicked')
				.setColor(0xFFA500)
				.addFields(
					{ name: 'Kicked User', value: `${target.username} (${target.displayName})`, inline: true },
					{ name: 'Kicked by', value: `${interaction.user.username} (${interaction.user.displayName})`, inline: true },
					{ name: 'Reason', value: reason, inline: false },
					{ name: 'Silent Kick', value: silent ? 'Yes' : 'No', inline: true },
				)
				.setThumbnail(target.displayAvatarURL({ dynamic: true }))
				.setTimestamp()
				.setFooter({ text: `User ID: ${target.id}` });

			const logChannel = guild.channels.cache.get(KICK_LOG_CHANNEL_ID);
			if (logChannel && logChannel.isTextBased()) {
				try {
					await logChannel.send({ embeds: [kickEmbed] });
				} catch (logError) {
					console.error('Error sending log to channel:', logError);
				}
			} else {
				console.warn('Log channel not found or is not a text channel');
			}

			// Then send the appropriate response
			if (silent) {
				await interaction.reply({
					content: `**SILENT: Kicked** ${target.username} for **Reason:** ${reason}`,
					ephemeral: true,
				});
			} else {
				await interaction.reply({
					content: `**Kicked** ${target.username} for **Reason:** ${reason}`,
					ephemeral: false,
				});
			}

		} catch (error) {
			console.error('Error kicking user:', error);
			await interaction.reply({
				content: 'There was an error trying to kick this user.',
				ephemeral: true,
			});
		}
	},
};