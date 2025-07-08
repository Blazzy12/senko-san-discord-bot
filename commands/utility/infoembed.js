const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	category: 'utility',
	textEnabled: true,
	data: new SlashCommandBuilder()
		.setName('rulesembed')
		.setDescription('awd'),
	async execute(interaction) {
		const serverInfoEmbed = new EmbedBuilder()
			.setColor(0xFFCCCB)
			.setThumbnail('https://i.imgur.com/Lp05CQ1.gif')
		await interaction.reply({ embeds: [serverInfoEmbed] });
	},
};