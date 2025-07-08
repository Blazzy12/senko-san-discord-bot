const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');


// Init
const databasePath = path.join(__dirname, 'guild_config.db');
const configDB = new Database(databasePath);

// Create table
configDB.exec(`CREATE TABLE IF NOT EXISTS guild_config (
	guild_id TEXT PRIMARY KEY,
	prefix TEXT DEFAULT ',',
	warn_log_channel_id TEXT,
	kick_log_channel_id TEXT,
	ban_log_channel_id TEXT,
	mute_log_channel_id TEXT,
	lockdown_log_channel_id TEXT,
	purge_log_channel_id TEXT
)`);

// Index
configDB.exec(`CREATE INDEX IF NOT EXISTS idx_guild_config_guild_id ON guild_config(guild_id)`);

// Prepare statements for better performace
const configStatements = {
	getGuildConfig: configDB.prepare('SELECT * FROM guild_config WHERE guild_id = ?'),
	setGuildConfig: configDB.prepare(`
		INSERT OR REPLACE INTO guild_config
		(guild_id, prefix, warn_log_channel_id, kick_log_channel_id, ban_log_channel_id, mute_log_channel_id, lockdown_log_channel_id, purge_log_channel_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`),
	updateConfigValue: configDB.prepare(`
		INSERT OR REPLACE INTO guild_config
		(guild_id, prefix, warn_log_channel_id, kick_log_channel_id, ban_log_channel_id, mute_log_channel_id, lockdown_log_channel_id, purge_log_channel_id)
		VALUES (
			?,
			COALESCE(?, (SELECT prefix FROM guild_config WHERE guild_id = ?), ','),
			COALESCE(?, (SELECT warn_log_channel_id FROM guild_config WHERE guild_id = ?)),
			COALESCE(?, (SELECT kick_log_channel_id FROM guild_config WHERE guild_id = ?)),
			COALESCE(?, (SELECT ban_log_channel_id FROM guild_config WHERE guild_id = ?)),
			COALESCE(?, (SELECT mute_log_channel_id FROM guild_config WHERE guild_id = ?)),
			COALESCE(?, (SELECT lockdown_log_channel_id FROM guild_config WHERE guild_id = ?)),
			COALESCE(?, (SELECT purge_log_channel_id FROM guild_config WHERE guild_id = ?))
		)
	`),
	resetGuildConfig: configDB.prepare('DELETE FROM guild_config WHERE guild_id = ?'),
};

// Default Configuration
const defaultConfig = {
	prefix: ',',
	warn_log_channel_id: null,
	kick_log_channel_id: null,
	ban_log_channel_id: null,
	mute_log_channel_id: null,
	lockdown_log_channel_id: null,
	purge_log_channel_id: null,
};

// Configuration helper functions
function getGuildConfig(guildId) {

	const config = configStatements.getGuildConfig.get(guildId);

	if (!config) {
		return { ...defaultConfig, guild_id: guildId};
	}

	return config;
}

function setConfigValue(guildId, key, value) {

	const currentConfig = getGuildConfig(guildId);

	// Map config keys
	const configMap = {
		prefix: 1,
		warn_log_channel_id: 2,
		kick_log_channel_id: 3,
		ban_log_channel_id: 4,
		mute_log_channel_id: 5,
		lockdown_log_channel_id: 6,
		purge_log_channel_id: 7,
	};

	// Create array with null values
	const params = new Array(15).fill(null); // configs * 2 + guild_id
	params[0] = guildId;

	// Set values corresponding to SELECT position
	const position = configMap[key];

	if (position) {
		params[position] = value;
		params[position + 7] = guildId; // COALESCE
	}

	configStatements.updateConfigValue.run(...params);
	return true;

}

function resetGuildConfig(guildId) {

	configStatements.resetGuildConfig.run(guildId);
	return true;

}

// Commands
module.exports = [
	{
		textEnabled: true,
		category: 'configuration',
		data: new SlashCommandBuilder()
			.setName('config')
			.setDescription('View or modify your server configuration')
			.setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
			.addSubcommand(subcommand =>
				subcommand
					.setName('view')
					.setDescription('View your current server configuration'),
			)
			.addSubcommand(subcommand =>
				subcommand
					.setName('set')
					.setDescription('Set a configuration value')
					.addStringOption(option =>
						option.setName('key')
							.setDescription('Configuration key to set')
							.setRequired(true)
							.addChoices(
								{ name: 'Prefix', value: 'Prefix' },
								{ name: 'Warning Log Channel', value: 'warn_log_channel_id' },
								{ name: 'Kick Log Channel', value: 'kick_log_channel_id' },
								{ name: 'Ban Log Channel', value: 'ban_log_channel_id' },
								{ name: 'Mute Log Channel', value: 'mute_log_channel_id' },
								{ name: 'Lockdown Log Channel', value: 'lockdown_log_channel_id' },
								{ name: 'Purge Log Channel', value: 'purge_log_channel_id' },
							),
					)
					.addStringOption(option =>
						option.setName('value')
							.setDescription('New value for this configuration')
							.setRequired(true)
					),
			)
			.addSubcommand(subcommand =>
				subcommand
					.setName('reset')
					.setDescription('Reset server configuration to defaults'),
			),
		async execute(interactionOrMessage, args) {
			// Check if slash command
			const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

			// Declare vars
			let guild, member, user, subcommand, key, value;

			if (isSlashCommand) {
				const interaction = interactionOrMessage;
				guild = interaction.guild;
				member = interaction.member;
				user = interaction.user;
				subcommand = interaction.options.getSubcommand();
				key = interaction.options.getString('key');
				value = interaction.options.getString('value');
			} else {
				const message = interactionOrMessage;
				guild = message.guild;
				member = message.member;
				user = message.author;

				if (!args || args.length < 1) {
					return await message.reply('Usage: `,config <view|set|reset> [key] [value]`');
				}

				subcommand = args[0].toLowerCase();
				key = args[1];
				value = args.slice(2).join(' ');
			}

			// Permission Check
			if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
				const content = 'You would need "Manage Server" permissions kiddo to use this command.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}

			try {
				switch (subcommand) {
				case 'view':
					await handleViewConfig(interactionOrMessage, guild, isSlashCommand);
					break;
				case 'set':
					await handleSetConfig(interactionOrMessage, guild, key, value, isSlashCommand);
					break;
				case 'reset':
					await handleResetConfig(interactionOrMessage, guild, isSlashCommand);
					break;
				default:
					const content = 'Invaild subcommand, Use `view`, `set`, or `reset`.';
					return isSlashCommand
						? await interactionOrMessage.reply({ content, ephemeral: true })
						: await interactionOrMessage.reply(content);
				}
			} catch (error) {
				console.error('!IMPORTANT! Error in config command:', error);
				const content = 'There was an error processing your configuration request';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}
		},
	},
];

async function handleViewConfig(interactionOrMessage, guild, isSlashCommand) {
	const config = getGuildConfig(guild.id);

	const embed = new EmbedBuilder()
		.setColor(0x0099ff)
		.setTitle(`⚙️ Server Configuration - ${guild.name}`)
		.setThumbnail(guild.iconURL({ dynamic: true }))
		.addFields(
			{ name: '❓ Prefix', value: `\`${config.prefix}\``, inline: true },
			{ name: '⚠️ Warn Log Channel', value: config.warn_log_channel_id ? `<#${config.warn_log_channel_id}>` : '`Not set (warn_log_channel_id)`', inline: true },
			{ name: '🥾 Kick Log Channel', value: config.kick_log_channel_id ? `<#${config.kick_log_channel_id}>` : '`Not set (kick_log_channel_id)`', inline: true },
			{ name: '🛑 Ban Log Channel', value: config.ban_log_channel_id ? `<#${config.ban_log_channel_id}>` : '`Not set (ban_log_channel_id)`', inline: true },
			{ name: '🔇 Mute Log Channel', value: config.mute_log_channel_id ? `<#${config.mute_log_channel_id}>` : '`Not set (mute_log_channel_id)`', inline: true },
			{ name: '🔒 Lockdown Log Channel', value: config.lockdown_log_channel_id ? `<#${config.lockdown_log_channel_id}>` : '`Not set (lockdown_log_channel_id)`', inline: true },
			{ name: '🗡️ Purge Log Channel', value: config.purge_log_channel_id ? `<#${config.purge_log_channel_id}>` : '`Not set (purge_log_channel_id)`', inline: true },
		)
		.setTimestamp()
		.setFooter({ text: `Server ID: ${guild.id}` });

	return isSlashCommand
		? await interactionOrMessage.reply({ embeds: [embed] })
		: await interactionOrMessage.reply({ embeds: [embed] });
}

async function handleSetConfig(interactionOrMessage, guild, key, value, isSlashCommand) {
	if (!key || !value) {
		const content = 'Please provide both a key and value to set.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Validate
	let processedValue = value;

	switch (key) {
	case 'prefix':
		if (value.length > 5) {
			const content = 'Prefix cannot be longer than 5 characters.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}
		break;
	case 'warn_log_channel_id':
	case 'kick_log_channel_id':
	case 'ban_log_channel_id':
	case 'mute_log_channel_id':
	case 'lockdown_log_channel_id':
	case 'purge_log_channel_id':
		// Extract
		const channelMatch = value.match(/^<#(\d+)>$/) || value.match(/^(\d+)$/);

		if (!channelMatch) {
			const content = 'Please provide a vaild channel mention or ID.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		const channel = guild.channels.cache.get(channelMatch[1]);
		if (!channel || !channel.isTextBased()) {
			const content = 'Channel not found or is not a text channel.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		processedValue = channelMatch[1];
		break;
	default:
		const content = 'Invalid configuration key.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Set configuration value
	setConfigValue(guild.id, key, processedValue);

	// Success embed
	const embed = new EmbedBuilder()
		.setColor(0x00ff00)
		.setTitle(`✅ Configuration Updated - ${guild.name}`)
		.addFields(
    		{ name: 'Key', value: `\`${key}\``, inline: true },
			{ name: 'New Value', value: typeof processedValue === 'string' && processedValue.length > 50 ? `\`${processedValue.substring(0, 50)}...\`` : `\`${processedValue}\``, inline: true },
		)
		.setTimestamp()
		.setFooter({ text: `Updated by ${interactionOrMessage.user?.username || interactionOrMessage.author.username}` });

	return isSlashCommand
		? await interactionOrMessage.reply({ embeds: [embed] })
		: await interactionOrMessage.reply({ embeds: [embed] });
}

async function handleResetConfig(interactionOrMessage, guild, isSlashCommand) {
	// Reset
	resetGuildConfig(guild.id);

	const embed = new EmbedBuilder()
		.setColor(0xff9900)
		.setTitle('🔄 Configuration Reset - ${guild.name}')
		.setDescription('All server configuration has been reset to default values.')
		.setTimestamp()
		.setFooter({ text: `Reset by ${interactionOrMessage.user?.username || interactionOrMessage.author.username}` });

	return isSlashCommand
		? await interactionOrMessage.reply({ embeds: [embed] })
		: await interactionOrMessage.reply({ embeds: [embed] });
}

// Export the functions for use
module.exports.getGuildConfig = getGuildConfig;
module.exports.setConfigValue = setConfigValue;
module.exports.resetGuildConfig = resetGuildConfig;