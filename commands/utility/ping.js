const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	textEnabled: true,
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with Pong!'),
	async execute(interactionOrMessage) {
		// Check if slash or text
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		const client = interactionOrMessage.client;

		// Bot latency
		const botLatency = client.ws.ping;
		const responseMessage = `Pong! 🏓 Latency: ${botLatency}ms`;
		return isSlashCommand
			? await interactionOrMessage.reply({ content: responseMessage })
			: await interactionOrMessage.reply(responseMessage);
	},
};