const { SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	textEnabled: true,
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('help')
		.setDescription('Shows all the commands on the server, and guides.'),
	async execute(interactionOrMessage) {
		// Check if slash or text
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		let guild, interaction;
		if (isSlashCommand) {
			interaction = interactionOrMessage;
			guild = interaction.guild;
		} else {
			const message = interactionOrMessage;
			guild = message.guild;
		}

		const select = new StringSelectMenuBuilder()
			.setCustomId('help')
			.setPlaceholder('Select your section')
			.setMinValues(1)
			.setMaxValues(1)
			.addOptions([
				new StringSelectMenuOptionBuilder()
					.setLabel('Warning System')
					.setDescription('How to use the warning system.')
					.setValue('warningsystem')
					.setEmoji('⚠️'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Moderation')
					.setDescription('How to use the moderation system.')
					.setValue('moderationsystem')
					.setEmoji('💥'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Utility')
					.setDescription('How to use the utility system.')
					.setValue('utilitysystem')
					.setEmoji('🔧'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Fun')
					.setDescription('How to use the fun system.')
					.setValue('funsystem')
					.setEmoji('🎠'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Configuration')
					.setDescription('How to use the configuration system.')
					.setValue('configurationsystem')
					.setEmoji('⚙️'),
				new StringSelectMenuOptionBuilder()
					.setLabel('Info')
					.setDescription('Information about the bot.')
					.setValue('information')
					.setEmoji('📋'),
			]);

		const row = new ActionRowBuilder()
			.addComponents(select);

		const embed = new EmbedBuilder()
			.setColor(0xFFB6C1)
			.setAuthor({ name: 'Senko-San', iconURL: guild.members.me.displayAvatarURL() })
			.setDescription(
				'## Senko-San Commands\n' +
				'*Just click the selection menu at the bottom silly billy~*\n' +
				'## Features\n' +
				'`Warning System`, `Moderation`, `Utility`, `Fun`, `Configuration`, `Info`\n',
			)
			.setFooter({ text: 'Made with love <3 by _blazzy' });

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [embed], components: [row] })
			: await interactionOrMessage.reply({ embeds: [embed], components: [row] });
	}
};