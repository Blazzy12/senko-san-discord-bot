const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } =  require('discord.js');

const MODERATION_LOG_CHANNEL_ID = '';

module.exports = {
	category: 'moderation',
	data: new SlashCommandBuilder()
		.setName('purge')
		.setDescription('Purges an amount of messages.')
		.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
		.addNumberOption(option =>
			option.setName('amount')
				.setDescription('Amount of messages to purge.')
				.setRequired(true)
				.setMinValue(1)
				.setMaxValue(100),
		)
		.addStringOption(option =>
			option.setName('reason')
				.setDescription('Reason for purging?'),
		),
	async execute(interaction) {
		const { options, guild } = interaction;

		const amount = options.getNumber('amount');
		const reason = options.getString('reason') ?? 'No reason provided';

		// Check user message perms
		if (!interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				content: 'Hiya nyaa~~ u do not have permmmisisiions to do this!',
				ephemeral: true,
			});
		}

		// Check user message perms
		if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
			return await interaction.reply({
				content: 'Hiya senko does not have pemissions to do this nya!',
				ephemeral: true,
			});
		}

		try {
			// Defering due to time
			await interaction.deferReply({ ephemeral: true });

			// Fetch the message amount
			const messages = await interaction.channel.messages.fetch({ limit: amount });

			// Checking there is messages
			if (messages.size === 0) {
				return await interaction.editReply({
					content: 'Silly billy nya~ there is not any messages to delete!',
					ephemeral: true,
				});
			}

			// Discord has a limitation of 14 days to bulk delete messages
			const filterMessages = messages.filter(msg =>
				Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000,
			);

			// Checking now for zerooo
			if (filterMessages.size === 0) {
				return await interaction.editReply({
					content: 'Senko says these messages are too old.',
					ephemeral: true,
				});
			}

			// Collect the messages before deletion
			let mArchive = '';
			const mSorted = Array.from(filterMessages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

			mArchive = `Messages purged from #${interaction.channel.name} on ${new Date().toLocaleString()}\n`;
			mArchive += `Purged by ${interaction.user.username} | (ID: ${interaction.user.id})\n`;
			mArchive += `Reason: ${reason}\n`;
			mArchive += `Total messages: ${mSorted.length}\n\n`;
			mArchive += '='.repeat(50) + '\n\n';

			mSorted.forEach((msg, index) => {
				// Repeative handling
				const timestamp = new Date(msg.createdTimestamp).toLocaleString();
				const msgAuthor = msg.author ? `${msg.author.username} (${msg.author.id})` : 'Unknown Author';
				const content = msg.content || '[No text content]';

				// Message handling
				mArchive += `[${index + 1}] ${timestamp}\n`;
				mArchive += `Author: ${msgAuthor}\n`;
				mArchive += `Content: ${content}\n`;

				// Attachment handling
				if (msg.attachments.size > 0) {
					mArchive += `Attachments: ${msg.attachments.map(att => att.name).join(', ')}\n`;
				}

				// Embed handling
				if (msg.embeds.length > 0) {
					mArchive += `Embeds: ${msg.embeds.length} embed(s)\n`;
				}

				mArchive += '\n' + '-'.repeat(30) + '\n\n';
			});

			// Delete messages
			const deletedMessages = await interaction.channel.bulkDelete(filterMessages, true);

			// Tell them it's done
			await interaction.editReply({
				content: `Nya~ Senko has banished **${deletedMessages.size} dang message(s)!`,
			});

			// Delete message after 5 seconds
			setTimeout(async () => {
				try {
					await interaction.deleteReply();
				} catch (error) {
					// Ignore if already deleted
				}
			}, 5000);

			const purgeEmbed = new EmbedBuilder()
				.setTitle('✏️ Message(s) Purged')
				.setColor(0xFFB6C1)
				.addFields(
					{ name: 'Amount Deleted', value: `${deletedMessages.size}`, inline: true },
					{ name: 'Deleted By', value: `${interaction.user.username} (${interaction.user.displayName})`, inline: true },
					{ name: 'Reason', value: reason, inline: false },
				)
				.setThumbnail(interaction.user.displayAvatarURL({ dynamic: true }))
				.setTimestamp()
				.setFooter({ text: `User ID: ${interaction.user.id} | Messages attached below` });

			const logChannel = guild.channels.cache.get(MODERATION_LOG_CHANNEL_ID);
			if (logChannel && logChannel.isTextBased()) {
				try {
					const logA = { embeds: [purgeEmbed] };

					// Add text file
					if (mArchive) {
						const fName = `purge-${interaction.channel.name}-${Date.now()}.txt`;
						const fAttach = new AttachmentBuilder(Buffer.from(mArchive, 'utf-8'), { name: fName });
						logA.files = [fAttach];
					}

					await logChannel.send(logA);
				} catch (error) {
					console.error('Error sending files to log channel:', error);
				}
			} else {
				console.warn('Log channel not found or is not a text channel.');
			}

		} catch (error) {
			console.error('Error purging messages:', error);

			if (interaction.deferred) {
				return await interaction.editReply({
					content: 'Nya~ uhon you encountered one of my errors, Error purging messages',
					ephemeral: true,
				});
			} else {
				return await interaction.reply({
					content: 'Nya~ uhon you encountered one of my errors, Error purging messages',
					ephemeral: true,
				});
			}
		}
	},
};