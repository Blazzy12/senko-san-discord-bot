const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	category: 'utility',
	textEnabled: true,
	data: new SlashCommandBuilder()
		.setName('rulesembed')
		.setDescription('awd'),
	async execute(interaction) {
		const serverInfoEmbed = new EmbedBuilder()
			.setTitle('Rules')
			.setColor(0xFFB6C1)
			.setDescription(
				':book: **INTRODUCTION OF RULES** :book:\n\n' +
				':9109869264907838241: **Discord Rules:**\n' +
				'• This server follows Discord\'s ToS. Any violation of these terms will be taken seriously and will result in a penalty. It\'s our task to make sure the server is a safe place for our members to hang out.\n\n' +
				'https://cdn.discordapp.com/attachments/1114247388660514956/1114250025581686834/7_1.gif?ex=686d5ab3&is=686c0933&hm=8b37db368e1e2c79c066af9c169f3c7ec0d3fcf053bc5efcb525b5a471125026&\n\n' +
				':9109869264907838241: **Rule No. 1**\n' +
				'• No NSFW content, racism or gender wars.\n\n' +
				':9109869264907838241: **Rule No. 2**\n' +
				'• Arguments are fine as long as above mentioned rule is followed, but we will interfere if it gets too heated.\n\n' +
				':9109869264907838241: **Rule No. 3**\n' +
				'• English is the primary language of the server, but we are somewhat lenient with this.\n\n' +
				':9109869264907838241: **Rule No. 4**\n' +
				'• Do not abuse Text-To-Speech bot in voice chats with spam messages.\n\n' +
				':9109869264907838241: **Rule No. 5**\n' +
				'• Kindly respect personal space. This is an online platform, so you may not force irl chats here if others are not fine with it.\n\n' +
				':9187229377066598801: **Note** :9187229377066598801:\n' +
				'• I. If rules are broken, you could be charged with timeout, kick or ban, depending on your past record and the rule(s) you broke.\n\n' +
				'• II. We follow hierarchy system here. You will get perks according to your role.\n\n' +
				'Checkout https://discord.com/channels/1333446943107715083/1354552643045031988 to know more about it.\n\n' +
				'https://cdn.discordapp.com/attachments/1114247388660514956/1114250025581686834/7_1.gif?ex=686d5ab3&is=686c0933&hm=8b37db368e1e2c79c066af9c169f3c7ec0d3fcf053bc5efcb525b5a471125026&',
			)
			.setTimestamp();
		await interaction.reply({ embeds: [serverInfoEmbed] });
	},
};