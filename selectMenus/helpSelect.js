const { EmbedBuilder } = require('discord.js');
const { getGuildConfig } = require('../commands/configuration/configuration.js');

module.exports = {
	data: {
		name: 'help',
	},
	async execute(interaction) {
		const selectedValue = interaction.values[0];

		// Get guild config to access the prefix
		const guildConfig = getGuildConfig(interaction.guild.id);
		const prefix = guildConfig.prefix;

		const helpMap = {
			warningsystem: {
				title: '⚠️ Warning System',
				description: 'Commands for managing user warnings',
				commands: [
					'**Warning System**',
					`\`${prefix}warn <user|user_Id>\` [reason] - Warn a user.`,
					`\`${prefix}warnings <user|user_Id>\` - View user warnings`,
					`\`${prefix}removewarn <warn_Id>\` - Remove a warning`,
					`\`${prefix}clearwarnings <user|user_Id>\` - Clear all warnings for a user`,
					' ',
					'**Joke Warning System**',
					`\`${prefix}jwarn <user|user_Id> [reason]\` - Warn a user.`,
					`\`${prefix}jwarnings <user|user_Id>\` - View user warnings`,
					`\`${prefix}jremovewarn <warn_Id>\` - Remove a warning`,
					`\`${prefix}jclearwarnings <user|user_Id>\` - Clear all warnings for a user`,
					'** All compatible with slash commands**',
				],
			},
			moderationsystem: {
				title: '💥 Moderation System',
				description: 'Commands for server moderation',
				commands: [
					`\`${prefix}ban <user|user_Id> [reason]\` - Ban a user`,
					`\`${prefix}kick <user|user_Id> [reason]\` - Kick a user`,
					`\`${prefix}mute <user|user_Id> <duration> [reason]\` - Timeout a user`,
					`\`${prefix}unmute <user|user_Id> [reason]\` - Un-Timeout a user`,
					`\`${prefix}purge <amount> [reason]\` - Delete messages`,
					`\`${prefix}lock\` - Locks the current channel`,
					`\`${prefix}unlock\` - Unlocks the current channel`,
					'** All compatible with slash commands**',
				],
			},
			utilitysystem: {
				title: '🔧 Utility System',
				description: 'Useful utility commands',
				commands: [
					`\`${prefix}help\` - This command`,
					`\`${prefix}avatar [user|user_Id]\` - Fetches the user's avatar`,
					`\`${prefix}serverinfo\` - Get server information`,
					`\`${prefix}ping\` - Get the bots ping`,
					`\`${prefix}role <add|remove|view|setup> [arguments]`,
					'** All compatible with slash commands**',
				],
			},
			funsystem: {
				title: '🎠 Fun System',
				description: 'Entertainment and fun commands',
				commands: [
					'None currently, check back another time!',
					'** All compatible with slash commands**',
				],
			},
			configurationsystem: {
				title: '⚙️ Configuration System',
				description: 'Server configuration commands',
				commands: [
					`\`${prefix}config <view|set|reset> [key] [value]\` - Set log channel`,
					'** All compatible with slash commands**',
				],
			},
			information: {
				title: '📋 Bot Information',
				description: 'Information about Senko-San',
				commands: [
					'Senko-San is made by **_blazzy** with love!',
					'Source - https://github.com/Blazzy12/senko-san-discord-bot',
					'Support - https://discord.gg/E7v6sPcKd2',
					'Invite - [Click Me!](https://discord.com/oauth2/authorize?client_id=1388229912149622814&permissions=8&integration_type=0&scope=bot)',
					'',
					'Pop me a message if you have suggestions!',
				],
			},
		};

		// Get the selected category
		const category = helpMap[selectedValue];

		if (!category) {
			const errorEmbed = new EmbedBuilder()
				.setColor(0xFF0000)
				.setTitle('❌ Error')
				.setDescription('Invalid category selected!')
				.setFooter({ text: 'Made with love <3 by _blazzy' });

			return await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
		}

		// Create embed for the selected category
		const embed = new EmbedBuilder()
			.setColor(0xFFB6C1)
			.setTitle(category.title)
			.setDescription(category.description)
			.addFields({
				name: 'Commands',
				value: category.commands.join('\n'),
				inline: false,
			})
			.setFooter({ text: 'Made with love <3 by _blazzy' })
			.setTimestamp();

		// Send the embed
		await interaction.reply({ embeds: [embed], ephemeral: true });
	},
};