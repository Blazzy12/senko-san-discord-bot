const { Events, Collection } = require('discord.js');
const { getGuildConfig } = require('./configuration.js'); // Import the config function

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		// Ignore bots and DMs
		if (message.author.bot || !message.guild) return;

		// Get the guild's configuration to retrieve the dynamic prefix
		const guildConfig = getGuildConfig(message.guild.id);
		const prefix = guildConfig.prefix;

		// Check if message starts with the guild's prefix
		if (!message.content.startsWith(prefix)) return;

		// Parse command and arguments
		const args = message.content.slice(prefix.length).trim().split(/ +/);
		let commandName = args.shift().toLowerCase();

		// Get command from text commands collection
		let command = message.client.textCommands.get(commandName);

		// If command not found, check if it's an alias
		if (!command) {
			// Look through all commands to find one with this alias
			for (const [name, cmd] of message.client.textCommands) {
				if (cmd.aliases && cmd.aliases.includes(commandName)) {
					command = cmd;
					commandName = name; // Use the main command name for cooldowns
					break;
				}
			}
		}

		if (!command) {
			// Optionally handle unknown commands silently or with a message
			return;
		}

		const { cooldowns } = message.client;

		if (!cooldowns.has(command.data.name)) {
			cooldowns.set(command.data.name, new Collection());
		}

		const now = Date.now();
		const timestamps = cooldowns.get(command.data.name);
		const defaultCooldownDuration = 3;
		const cooldownAmount = (command.cooldown ?? defaultCooldownDuration) * 1_000;

		if (timestamps.has(message.author.id)) {
			const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
			if (now < expirationTime) {
				const expiredTimestamp = Math.round(expirationTime / 1_000);
				return message.reply(`Please wait, you are on a cooldown for \`${command.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`);
			}
		}

		timestamps.set(message.author.id, now);
		setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

		try {
			await command.execute(message, args);
		} catch (error) {
			console.error(error);
			await message.reply('There was an error while executing this command!');
		}
	},
};