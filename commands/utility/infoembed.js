const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	category: 'utility',
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
				'## <a:arrow:1364978340120887307> Discord Rules:\n' +
				'- This server follows Discord\'s [TOS](https://discord.com/terms). Any violation of these terms will be taken seriously and will result in a penalty. It\'s our task to make sure the server is a safe place for our members to hang out.',
			)
			.setFooter({ iconURL: 'https://i.imgur.com/IGyxWy8.gif' });

		// Send to the channel where the interaction was triggered
		await interaction.channel.send({ embeds: [serverInfoEmbed1] });
		await interaction.channel.send({ embeds: [serverInfoEmbed2] });

		// Reply to the interaction to acknowledge it was processed
		await interaction.reply({ content: 'Rules embeds sent!', ephemeral: true });
	},
};