const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('serverinfo')
		.setDescription('Fetches and posts the server information.'),
	async execute(interaction) {
		try {
			// Defer
			await interaction.deferReply();

			const { guild } = interaction;

			// Grab statistics
			const owner = await guild.fetchOwner();
			const creationDate = guild.createdAt.toLocaleDateString();
			const memberCount = guild.memberCount;
			const roleCount = guild.roles.cache.size;
			const channelCount = guild.channels.cache.size;
			const textCount = guild.channels.cache.filter(channel => channel.type === 0).size;
			const voiceCount = guild.channels.cache.filter(channel => channel.type === 2).size;
			const newsChannels = guild.channels.cache.filter(channel => channel.type === 5).size;
			const textLockedChannels = guild.channels.cache.filter(channel => !channel.permissionsFor(guild.roles.everyone).has('ViewChannel') && channel.type === 0).size;
			const voiceLockedChannels = guild.channels.cache.filter(channel => !channel.permissionsFor(guild.roles.everyone).has('ViewChannel') && channel.type === 2).size;
			const boostLevel = guild.premiumTier;
			const boostCount = guild.premiumSubscriptionCount;

			// Differentiate bots from humans
			let humanCount = 'Unable to fetch';
			let botCount = 'Unable to fetch';

			try {
				const members = await guild.members.fetch({ time: 60000 });
				humanCount = members.filter(member => !member.user.bot).size;
				botCount = members.filter(member => member.user.bot).size;
			} catch (error) {
				console.error('Failed to fetch members:', error);

				// Fallback
				humanCount = 'Unavailable';
				botCount = 'Unavailable';
			}

			// Check for features
			const inviteSplash = guild.splashURL() ? '✅' : '❌';
			const animatedIcon = guild.iconURL() && guild.iconURL().includes('.gif') ? '✅' : '❌';
			const bannerOn = guild.bannerURL() ? '✅' : '❌';

			// Embed
			const serverInfoEmbed = new EmbedBuilder()
				.setTitle(`${guild.name}'s Server Information`)
				.setThumbnail(guild.iconURL({ dynamic: true }))
				.setColor(0xFFB6C1)
				.addFields(
					{ name: '📋 Server Name', value: guild.name, inline: true },
					{ name: '🆔 Server ID', value: guild.id, inline: true },
					{ name: '👑 Owner', value: `${owner.user.username} (${owner.user.id})`, inline: true },
					{ name: '📅 Creation Date', value: creationDate, inline: true },
					{ name: '👥 Total Members', value: memberCount.toString(), inline: true },
					{ name: '👤 Humans', value: humanCount.toString(), inline: true },
					{ name: '🤖 Bots', value: botCount.toString(), inline: true },
					{ name: '🎲 Roles', value: roleCount.toString(), inline: true },
					{ name: '📺 Total Channels', value: channelCount.toString(), inline: true },
					{ name: '💬 Text Channels', value: textCount.toString(), inline: true },
					{ name: '🔊 Voice Channels', value: voiceCount.toString(), inline: true },
					{ name: '📰 News Channels', value: newsChannels.toString(), inline: true },
					{ name: '🔐 Text Locked Channels', value: textLockedChannels.toString(), inline: true },
					{ name: '🔐 Voice Locked Channels', value: voiceLockedChannels.toString(), inline: true },
					{ name: '🚀 Boost Level', value: boostLevel.toString(), inline: true },
					{ name: '🔥 Boost Count', value: boostCount.toString(), inline: true },
					{ name: '🔒 Verification Level', value: guild.verificationLevel.toString(), inline: true },
					{ name: '🎨 Invite Splash', value: inviteSplash, inline: true },
					{ name: '✨ Animated Icon', value: animatedIcon, inline: true },
					{ name: '🖼️ Server Banner', value: bannerOn, inline: true },
				)
				.setFooter({ text: `Requested by ${interaction.user.username}`, iconURL: interaction.user.displayAvatarURL() })
				.setTimestamp();

			// Checking for banner :D
			if (guild.bannerURL()) {
				serverInfoEmbed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
			}

			// Reply
			await interaction.editReply({
				embeds: [serverInfoEmbed],
			});
		} catch (error) {
			console.error('Eror with serverinfo command:', error);

			// Check
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({
					content: 'Error fetching server information',
					ephemeral: true,
				});
			} else {
				await interaction.reply({
					content: 'Error fetching server information',
					ephemeral: true,
				});
			}
		}
	},
};