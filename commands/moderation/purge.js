const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, AttachmentBuilder } =  require('discord.js');

const MODERATION_LOG_CHANNEL_ID = '1388764830663442522';

module.exports = {
	textEnabled: true,
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
	async execute(interactionOrMessage, args) {
		// Check if slash or text
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		// Declare vars
		let amount, reason, guild, member, user, interaction;

		if (isSlashCommand) {
			interaction = interactionOrMessage;
			guild = interaction.guild;
			member = interaction.member;
			user = interaction.user;

			amount = interaction.options.getNumber('amount');
			reason = interaction.options.getString('reason') ?? 'No reason provided';
		} else {
			// Text command parsing
			const message = interactionOrMessage;
			guild = message.guild;
			member = message.member;
			user = message.author;

			// Check if they're using it right
			if (!args || args.length < 1) {
				return await message.reply('Usage: `,purge <amount> [reason]`');
			}

			// Parse args
			const amountArg = parseInt(args[0]);
			const reasonArgs = args.slice(1);

			if (isNaN(amountArg) || amountArg < 1 || amountArg > 100) {
				return await message.reply('Umm Senko San says to provide a valid amount between 1 and 100');
			}

			amount = amountArg;
			reason = reasonArgs.length > 0 ? reasonArgs.join(' ') : 'No reason provided.';
		}

		// Check user message perms
		if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
			const content = 'Hiya nyaa~~ u do not have permissions to do this!';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		// Check user message perms
		if (!guild.members.me.permissions.has(PermissionFlagsBits.ManageMessages)) {
			const content = 'Hiya senko does not have pemissions to do this nya!';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		try {
			// Defering due to time
			if (isSlashCommand) {
				await interaction.deferReply({ ephemeral: true });
			}

			// Get channel
			const channel = isSlashCommand ? interactionOrMessage.channel : interactionOrMessage.channel;

			// Fetch the message amount
			const messages = await channel.messages.fetch({ limit: amount });

			// Checking there is messages
			if (messages.size === 0) {
				const content = 'Silly billy nya~ there is not any messages to delete!';
				return isSlashCommand
					? await interactionOrMessage.editReply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Discord has a limitation of 14 days to bulk delete messages
			const filterMessages = messages.filter(msg =>
				Date.now() - msg.createdTimestamp < 14 * 24 * 60 * 60 * 1000,
			);

			// Checking now for zerooo
			if (filterMessages.size === 0) {
				const content = 'Senko says these messages are too old.';
				return isSlashCommand
					? await interactionOrMessage.editReply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			// Collect the messages before deletion
			let mArchive = '';
			const mSorted = Array.from(filterMessages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

			mArchive = `Messages purged from #${channel.name} on ${new Date().toLocaleString()}\n`;
			mArchive += `Purged by ${user.username} | (ID: ${user.id})\n`;
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
			const deletedMessages = await channel.bulkDelete(filterMessages, true);

			// Tell them it's done
			const sContent = `Nya~ Senko has banished **${deletedMessages.size}** dang message(s)!`;

			if (isSlashCommand) {
				await interactionOrMessage.editReply({ content: sContent });

				// Delete message after 5 seconds
				setTimeout(async () => {
					try {
						await interactionOrMessage.deleteReply();
					} catch (error) {
						// Ignore if already deleted
					}
				}, 5000);
			} else {
				const reply = await interactionOrMessage.reply(sContent);

				// Delete message after 5 seconds
				setTimeout(async () => {
					try {
						await reply.delete();
					} catch (error) {
						// Ignore if already deleted
					}
				}, 5000);
			}

			const purgeEmbed = new EmbedBuilder()
				.setTitle('✏️ Message(s) Purged')
				.setColor(0xFFB6C1)
				.addFields(
					{ name: 'Amount Deleted', value: `${deletedMessages.size}`, inline: true },
					{ name: 'Deleted By', value: `${user.username} (${user.displayName})`, inline: true },
					{ name: 'Reason', value: reason, inline: false },
				)
				.setThumbnail(user.displayAvatarURL({ dynamic: true }))
				.setTimestamp()
				.setFooter({ text: `User ID: ${user.id} | Messages attached above` });

			const logChannel = guild.channels.cache.get(MODERATION_LOG_CHANNEL_ID);
			if (logChannel && logChannel.isTextBased()) {
				try {
					const logA = { embeds: [purgeEmbed] };

					// Add text file
					if (mArchive) {
						const fName = `purge-${channel.name}-${Date.now()}.txt`;
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

			const content = 'Nya~ uhon you encountered one of my errors, Error purging messages';

			if (isSlashCommand) {
				if (interactionOrMessage.deferred) {
					return await interactionOrMessage.editReply({ content, ephemeral: true });
				} else {
					return await interactionOrMessage.reply({ content, ephemeral: true });
				}
			} else {
				return await interactionOrMessage.reply(content);
			}
		}
	},
};