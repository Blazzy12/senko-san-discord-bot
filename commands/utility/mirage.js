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

		const content = 'https://tenor.com/view/anime-sleep-dizzy-gif-13520593';
		return isSlashCommand
			? await interactionOrMessage.reply({ content })
			: await interactionOrMessage.reply(content);
	},
};