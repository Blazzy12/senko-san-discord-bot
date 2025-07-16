const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

// Cache
const memberCountCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000;

module.exports = {
	category: 'utility',
	textEnabled: true,
	aliases: ['si', 'info'],
	data: new SlashCommandBuilder()
		.setName('serverinfo')
		.setDescription('Fetches and posts the server information.'),
	async execute(interactionOrMessage) {
		// Check if slash or text
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		// Declare vars
		let guild, user, interaction;

		if (isSlashCommand) {
			interaction = interactionOrMessage;
			guild = interaction.guild;
			user = interaction.user;
		} else {
			// Text command
			const message = interactionOrMessage;
			guild = message.guild;
			user = message.author;
		}

		try {
			// Defer for slash commands
			if (isSlashCommand) {
				await interactionOrMessage.deferReply();
			}

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

			// Check Cache
			const cacheKey = guild.id;
			const cached = memberCountCache.get(cacheKey);
			const now = Date.now();

			// Differentiate bots from humans
			let humanCount = 'Unable to fetch';
			let botCount = 'Unable to fetch';
			let fromCache = false;

			if (cached && (now - cached.timestamp) < CACHE_DURATION) {
				humanCount = cached.humanCount;
				botCount = cached.botCount;
				fromCache = true;

				console.log(`Using cached member count for ${guild.name}`);
			} else {
				console.log(`Fetching counts for ${guild.name}`);

				try {
					const members = await guild.members.fetch({ time: 30000 });
					humanCount = members.filter(member => !member.user.bot).size;
					botCount = members.filter(member => member.user.bot).size;

					// Cache results
					memberCountCache.set(cacheKey, {
						humanCount,
						botCount,
						timestamp: now,
					});

					console.log(`Got cached member count for ${guild.name}`);
				} catch (error) {
					console.log(`Failed fetching member count for ${guild.name}, use fallback`);

					// Fallback
					if (cached) {
						humanCount = cached.humanCount;
						botCount = cached.botCount;
						fromCache = true;
						console.log(`Using count fallback for ${guild.name}`);
					}
				}
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
				.setFooter({ text: `Requested by ${user.username}, The cache resets every 5 minutes`, iconURL: user.displayAvatarURL() })
				.setTimestamp();

			// Checking for banner :D
			if (guild.bannerURL()) {
				serverInfoEmbed.setImage(guild.bannerURL({ dynamic: true, size: 1024 }));
			}

			// Reply
			if (isSlashCommand) {
				await interactionOrMessage.editReply({
					embeds: [serverInfoEmbed],
				});
			} else {
				await interactionOrMessage.reply({
					embeds: [serverInfoEmbed],
				});
			}
		} catch (error) {
			console.error('Error with serverinfo command:', error);

			const content = 'Error fetching server information';

			// Check and respond appropriately
			if (isSlashCommand) {
				if (interactionOrMessage.replied || interactionOrMessage.deferred) {
					await interactionOrMessage.followUp({
						content,
						ephemeral: true,
					});
				} else {
					await interactionOrMessage.reply({
						content,
						ephemeral: true,
					});
				}
			} else {
				await interactionOrMessage.reply(content);
			}
		}
	},
};