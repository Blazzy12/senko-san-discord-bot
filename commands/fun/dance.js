const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	textEnabled: true,
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('dance')
		.setDescription('Dance!'),
	async execute(interactionOrMessage) {
		// Check if slash or text
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		const content = 'https://i.imgur.com/XadBhFh.gif';
		return isSlashCommand
			? await interactionOrMessage.reply({ content })
			: await interactionOrMessage.reply(content);
	},
};