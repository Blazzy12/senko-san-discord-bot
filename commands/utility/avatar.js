const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');


module.exports = {
	textEnabled: true,
	aliases: ['av'],
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('avatar')
		.setDescription('Fetches the users avatar.')
		.addUserOption(option =>
			option.setName('user')
				.setDescription('User that you want to fetch.'),
		),
	async execute(interactionOrMessage, args) {
		// Check if slash or text
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		let target, user, member, guild, interaction;

		if (isSlashCommand) {
			interaction = interactionOrMessage;
			guild = interaction.guild;
			member = interaction.member;
			user = interaction.user;

			target = interaction.options.getUser('user') || user;
		} else {
			const message = interactionOrMessage;
			guild = message.guild;
			member = message.member;
			user = message.author;

			if (!args || args.length < 1) {
				target = user;
			} else {
				const userMention = args[0];

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
		}

		const embed = new EmbedBuilder()
			.setColor(0x000000)
			.setTitle(`${target.username}'s Avatar`)
			.setImage(target.displayAvatarURL({ dynamic: true, size: 1024, format: 'png' }))
			.setFooter({ text: `User ID: ${target.id}`})
			.setTimestamp();

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [embed] })
			: await interactionOrMessage.reply({ embeds: [embed] });

	},
};