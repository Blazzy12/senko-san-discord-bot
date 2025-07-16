const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	textEnabled: true,
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('mirage')
		.setDescription('Shows mirages favourite gif!'),
	async execute(interactionOrMessage) {
		// Check if slash or text
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		const content = 'https://media.discordapp.net/attachments/817585952864075806/1395125879675293836/IMG_4493.gif?ex=68794fb9&is=6877fe39&hm=3c861cd7c68ea7340729baf3e3f386b1329e95867ddf26f0e2a49ea72cf4f761&=';
		return isSlashCommand
			? await interactionOrMessage.reply({ content })
			: await interactionOrMessage.reply(content);
	},
};