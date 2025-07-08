const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	category: 'utility',
	textEnabled: true,
	data: new SlashCommandBuilder()
		.setName('rulesembed')
		.setDescription('awd'),
	async execute(interaction) {
		const serverInfoEmbed1 = new EmbedBuilder()
			.setColor(0xFFCCCB)
			.setImage('https://i.imgur.com/Lp05CQ1.gif');
		const serverInfoEmbed2 = new EmbedBuilder()
			.setColor(0xFFCCCB)
			.setTitle('📖 **__INTRODUCTION OF RULES__** 📖')
			.setDescription(
				'<:9109869264907838241:9109869264907838241> # Discord Rules:',
			);

		await interaction.reply({ embeds: [serverInfoEmbed1] });
		await interaction.reply({ embeds: [serverInfoEmbed2] });
	},
};