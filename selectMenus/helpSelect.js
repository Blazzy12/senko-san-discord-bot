const { EmbedBuilder } = require('discord.js');

module.exports = {
	data: {
		name: 'help',
	},
	cooldown: 3,
	async execute(interaction) {
		const selectedValue = interaction.values[0];

		const helpMap = {
			warningsystem: {
				title: '⚠️ Warning System',
				description: 'Commands for managing user warnings',
				commands: [
					'**Warning System**',
					'`,warn <user|user_Id>` [reason] - Warn a user.',
					'`,warnings <user|user_Id>` - View user warnings',
					'`,removewarn <warn_Id>` - Remove a warning',
					'`,clearwarnings <user|user_Id>` - Clear all warnings for a user',
					' ',
					'**Joke Warning System**',
					'`,jwarn <user|user_Id> [reason]` - Warn a user.',
					'`,jwarnings <user|user_Id>` - View user warnings',
					'`,jremovewarn <warn_Id>` - Remove a warning',
					'`,jclearwarnings <user|user_Id>` - Clear all warnings for a user',
					'** All compatible with slash commands**',
				],
			},
			moderationsystem: {
				title: '💥 Moderation System',
				description: 'Commands for server moderation',
				commands: [
					'`,ban <user|user_Id> [reason]` - Ban a user',
					'`,kick <user|user_Id> [reason]` - Kick a user',
					'`,mute <user|user_Id> <duration> [reason]` - Timeout a user',
					'`,unmute <user|user_Id> [reason]` - Un-Timeout a user',
					'`,purge <amount> [reason]` - Delete messages',
					'`,lock` - Locks the current channel',
					'`,unlock` - Unlocks the current channel',
					'** All compatible with slash commands**',
				],
			},
			utilitysystem: {
				title: '🔧 Utility System',
				description: 'Useful utility commands',
				commands: [
					'`,help` - This command',
					'`,serverinfo` - Get server information',
					'`,ping` - Get the bots ping',
					'** All compatible with slash commands**',
				],
			},
			funsystem: {
				title: '🎠 Fun System',
				description: 'Entertainment and fun commands',
				commands: [
					'`,mirage` - Posts lx.mirage07 favourite gif!',
					'** All compatible with slash commands**',
				],
			},
			configurationsystem: {
				title: '⚙️ Configuration System',
				description: 'Server configuration commands',
				commands: [
					'`,config <view|set|reset> [key] [value]` - Set log channel',
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
				inline: false
			})
			.setFooter({ text: 'Made with love <3 by _blazzy' })
			.setTimestamp();

		// Send the embed
		await interaction.reply({ embeds: [embed], ephemeral: true });
	},
};