const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const BAN_LOG_CHANNEL_ID = '1388319341828903124';

module.exports = {
	category: 'moderation',
	data: new SlashCommandBuilder()
		.setName('ban')
		.setDescription('Bans a user for sometimes a reason.')
		.setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
		.addUserOption(option =>
			option.setName('user')
				.setDescription('User to ban.')
				.setRequired(true),
		)
		.addStringOption(option =>
			option.setName('reason')
				.setDescription('Reason for banning said user.'),
		)
		.addBooleanOption(option =>
			option.setName('silent')
				.setDescription('Is this ban silent?'),
		),
	async execute(interaction) {
		const { options, guild } = interaction;

		const target = options.getUser('user');
		const reason = options.getString('reason') ?? 'No reason provided.';
		const silent = options.getBoolean('silent') ?? false;

		// Checking if the user has permission to ban a user.
		if (!interaction.member.permissions.has(PermissionFlagsBits.BanMembers)) {
			return await interaction.reply({
				content: 'You do not have permission to ban members.',
				ephemeral: true,
			});
		}

		if (!guild.members.me.permissions.has(PermissionFlagsBits.BanMembers)) {
			return await interaction.reply({
				content: 'I do not have permission to ban members.',
				ephemeral: true,
			});
		}

		try {
			// Grabbing guildId, members and then fetching the targets id
			const targetMember = await guild.members.fetch(target.id);

			// Checking role hierarchy between bot
			if (!targetMember.bannable) {
				return await interaction.reply({
					content: 'I cannot ban this user- as they may have a higher role than me or be the server owner; or could even of been myself that you were trying to ban?',
					ephemeral: true,
				});
			}

			// Checking role hierarchy between user
			if (interaction.member.roles.highest.position <= targetMember.roles.highest.position && guild.ownerId !== interaction.user.id) {
				return await interaction.reply({
					content: 'You cannot ban someone with an equal or higher role than you.',
					ephemeral: true,
				});
			}

			const finalReason = `Banned by ${interaction.user.username} | ${reason}`;

			// Ban the user first
			await targetMember.ban({ reason: finalReason });

			const banEmbed = new EmbedBuilder()
				.setTitle('🔨 User Banned')
				.setColor(0xFF0000)
				.addFields(
					{ name: 'Banned User', value: `${target.username} (${target.displayName})`, inline: true },
					{ name: 'Banned by', value: `${interaction.user.username} (${interaction.user.displayName})`, inline: true },
					{ name: 'Reason', value: reason, inline: false },
					{ name: 'Silent Ban', value: silent ? 'Yes' : 'No', inline: true },
				)
				.setThumbnail(target.displayAvatarURL({ dynamic: true }))
				.setTimestamp()
				.setFooter({ text: `User ID: ${target.id}` });

			const logChannel = guild.channels.cache.get(BAN_LOG_CHANNEL_ID);
			if (logChannel && logChannel.isTextBased()) {
				try {
					await logChannel.send({ embeds: [banEmbed] });
				} catch (logError) {
					console.error('Error sending log to channel:', logError);
				}
			} else {
				console.warn('Log channel not found or is not a text channel');
			}

			// Then send the appropriate response
			if (silent) {
				await interaction.reply({
					content: `**SILENT: Banned** ${target.username} for **Reason:** ${reason}`,
					ephemeral: true,
				});
			} else {
				await interaction.reply({
					content: `**Banned** ${target.username} for **Reason:** ${reason}`,
					ephemeral: false,
				});
			}

		} catch (error) {
			console.error('Error banning user:', error);
			await interaction.reply({
				content: 'There was an error trying to ban this user.',
				ephemeral: true,
			});
		}
	},
};