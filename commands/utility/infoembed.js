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
			.setImage('https://i.imgur.com/IGyxWy8.gif');
		const serverInfoEmbed3 = new EmbedBuilder()
			.setColor(0xFFCCCB)
			.setDescription(
				'## <a:arrow:1364978340120887307> Rule No. 1\n' +
				'- No NSFW content, racism or gender wars.\n' +
				'## <a:arrow:1364978340120887307> Rule No. 2\n' +
				'- Arguments are fine as long as above mentioned rule is followed, but we will interfere if it gets too heated.\n' +
				'## <a:arrow:1364978340120887307> Rule No. 3\n' +
				'- English is the primary language of the server, but we are somewhat lenient with this.\n' +
				'## <a:arrow:1364978340120887307> Rule No. 4\n' +
				'- Do not abuse Text-To-Speech bot in voice chats with spam messages.\n' +
				'## <a:arrow:1364978340120887307> Rule No. 5\n' +
				'- Kindly respect personal space. This is an online platform, so you may not force irl chats here if others are not fine with it.\n' +
				'## <a:arrow:1364978340120887307> Rule No. 6\n' +
				'- If you leave and rejoin the server a lot your custom role\'s deletion is at our discretion.\n' +
				'## <a:point:1364978349176524810> Note <a:point:1364978349176524810>\n' +
				'- I. If rules are broken, you could be charged with a warning, timeout, kick, or ban; depending on your past record and the rule(s) you broke.\n' +
				'- II. We follow a hiearchy system here. You get perks according to your role.\n' +
				'Checkout <#1354552643045031988> to know more about it.\n',
			)
			.setImage('https://i.imgur.com/IGyxWy8.gif');

		// Send to the channel where the interaction was triggered
		await interaction.channel.send({ embeds: [serverInfoEmbed1, serverInfoEmbed2, serverInfoEmbed3] });

		// Reply to the interaction to acknowledge it was processed
		await interaction.reply({ content: 'Rules embeds sent!', ephemeral: true });
	},
};