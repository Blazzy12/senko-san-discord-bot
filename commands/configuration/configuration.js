const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const Database = require('better-sqlite3');
const path = require('path');

// Config constants
const VALID_CONFIG_KEYS = [
	'prefix',
	'warn_log_channel_id',
	'kick_log_channel_id',
	'ban_log_channel_id',
	'mute_log_channel_id',
	'lockdown_log_channel_id',
	'purge_log_channel_id',
	'lockdown_allowed_roles',
];

// Database schema definition - add new columns here
const SCHEMA_DEFINITION = {
	guild_id: { type: 'TEXT', primaryKey: true },
	prefix: { type: 'TEXT', defaultValue: ',' },
	warn_log_channel_id: { type: 'TEXT', defaultValue: null },
	kick_log_channel_id: { type: 'TEXT', defaultValue: null },
	ban_log_channel_id: { type: 'TEXT', defaultValue: null },
	mute_log_channel_id: { type: 'TEXT', defaultValue: null },
	lockdown_log_channel_id: { type: 'TEXT', defaultValue: null },
	purge_log_channel_id: { type: 'TEXT', defaultValue: null },
	lockdown_allowed_roles: { type: 'TEXT', defaultValue: null },
	// Add new columns here in the future:
	// new_column_name: { type: 'TEXT', defaultValue: null },
};

// Create a mapping for user-friendly names to actual keys
const KEY_ALIASES = {
	'prefix': 'prefix',
	'warn': 'warn_log_channel_id',
	'warning': 'warn_log_channel_id',
	'warn_log': 'warn_log_channel_id',
	'warn_log_channel_id': 'warn_log_channel_id',
	'kick': 'kick_log_channel_id',
	'kick_log': 'kick_log_channel_id',
	'kick_log_channel_id': 'kick_log_channel_id',
	'ban': 'ban_log_channel_id',
	'ban_log': 'ban_log_channel_id',
	'ban_log_channel_id': 'ban_log_channel_id',
	'mute': 'mute_log_channel_id',
	'mute_log': 'mute_log_channel_id',
	'mute_log_channel_id': 'mute_log_channel_id',
	'lockdown': 'lockdown_log_channel_id',
	'lockdown_log': 'lockdown_log_channel_id',
	'lockdown_log_channel_id': 'lockdown_log_channel_id',
	'purge': 'purge_log_channel_id',
	'purge_log': 'purge_log_channel_id',
	'purge_log_channel_id': 'purge_log_channel_id',
	'lockdown_roles': 'lockdown_allowed_roles',
	'lockdown_allowed_roles': 'lockdown_allowed_roles',
};

// Init
const databasePath = path.join(__dirname, 'guild_config.db');
const configDB = new Database(databasePath);

// Dynamic migration system
function getExistingColumns() {
	try {
		const tableInfo = configDB.pragma('table_info(guild_config)');
		return tableInfo.map(col => col.name);
	} catch (error) {
		// Table doesn't exist yet
		return [];
	}
}

function createTableWithSchema() {
	const columns = Object.entries(SCHEMA_DEFINITION).map(([columnName, config]) => {
		let columnDef = `${columnName} ${config.type}`;

		if (config.primaryKey) {
			columnDef += ' PRIMARY KEY';
		}

		if (config.defaultValue !== null && config.defaultValue !== undefined) {
			columnDef += ` DEFAULT '${config.defaultValue}'`;
		}

		return columnDef;
	});

	const createTableSQL = `CREATE TABLE IF NOT EXISTS guild_config (
		${columns.join(',\n\t\t')}
	)`;

	console.log('Creating/updating guild_config table...');
	configDB.exec(createTableSQL);
}

function runMigrations() {
	const existingColumns = getExistingColumns();

	// If table doesn't exist, create it
	if (existingColumns.length === 0) {
		createTableWithSchema();
		console.log('Created guild_config table with all columns.');
		return;
	}

	// Check for missing columns and add them
	const missingColumns = Object.keys(SCHEMA_DEFINITION).filter(
		columnName => !existingColumns.includes(columnName)
	);

	if (missingColumns.length > 0) {
		console.log(`Found ${missingColumns.length} missing columns. Adding them...`);

		missingColumns.forEach(columnName => {
			const config = SCHEMA_DEFINITION[columnName];
			let alterSQL = `ALTER TABLE guild_config ADD COLUMN ${columnName} ${config.type}`;

			if (config.defaultValue !== null && config.defaultValue !== undefined) {
				alterSQL += ` DEFAULT '${config.defaultValue}'`;
			}

			try {
				configDB.exec(alterSQL);
				console.log(`✅ Added column: ${columnName}`);
			} catch (error) {
				console.error(`❌ Failed to add column ${columnName}:`, error.message);
			}
		});

		console.log('Migration completed successfully!');
	} else {
		console.log('Database schema is up to date.');
	}
}

// Run migrations
runMigrations();

// Create index
configDB.exec(`CREATE INDEX IF NOT EXISTS idx_guild_config_guild_id ON guild_config(guild_id)`);

// Generate prepared statements dynamically
function generatePreparedStatements() {
	const columnNames = Object.keys(SCHEMA_DEFINITION);
	const placeholders = columnNames.map(() => '?').join(', ');

	return {
		getGuildConfig: configDB.prepare('SELECT * FROM guild_config WHERE guild_id = ?'),
		setGuildConfig: configDB.prepare(`
			INSERT OR REPLACE INTO guild_config
			(${columnNames.join(', ')})
			VALUES (${placeholders})
		`),
		resetGuildConfig: configDB.prepare('DELETE FROM guild_config WHERE guild_id = ?'),
	};
}

// Prepare statements for better performance
const configStatements = generatePreparedStatements();

// Generate default configuration dynamically
function generateDefaultConfig() {
	const defaultConfig = {};

	Object.entries(SCHEMA_DEFINITION).forEach(([columnName, config]) => {
		if (columnName !== 'guild_id') {
			defaultConfig[columnName] = config.defaultValue;
		}
	});

	return defaultConfig;
}

const defaultConfig = generateDefaultConfig();

// Configuration helper functions
function getGuildConfig(guildId) {
	const config = configStatements.getGuildConfig.get(guildId);

	if (!config) {
		return { ...defaultConfig, guild_id: guildId };
	}

	return config;
}

function setConfigValue(guildId, key, value) {
	const currentConfig = getGuildConfig(guildId);

	// Create config object with current values
	const configUpdate = { ...currentConfig };
	configUpdate.guild_id = guildId;
	configUpdate[key] = value;

	// Get column order from schema definition
	const columnNames = Object.keys(SCHEMA_DEFINITION);
	const orderedValues = columnNames.map(columnName => configUpdate[columnName]);

	configStatements.setGuildConfig.run(...orderedValues);
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
								{ name: 'Prefix', value: 'prefix' },
								{ name: 'Warning Log Channel', value: 'warn_log_channel_id' },
								{ name: 'Kick Log Channel', value: 'kick_log_channel_id' },
								{ name: 'Ban Log Channel', value: 'ban_log_channel_id' },
								{ name: 'Mute Log Channel', value: 'mute_log_channel_id' },
								{ name: 'Lockdown Log Channel', value: 'lockdown_log_channel_id' },
								{ name: 'Purge Log Channel', value: 'purge_log_channel_id' },
								{ name: 'Lockdown Allowed Roles', value: 'lockdown_allowed_roles' },
							),
					)
					.addStringOption(option =>
						option.setName('value')
							.setDescription('New value for this configuration')
							.setRequired(true),
					),
			)
			.addSubcommand(subcommand =>
				subcommand
					.setName('remove')
					.setDescription('Configuration key to remove')
					.addStringOption(option =>
						option.setName('key')
							.setDescription('Configuration key to set')
							.setRequired(true)
							.addChoices(
								{ name: 'Warning Log Channel', value: 'warn_log_channel_id' },
								{ name: 'Kick Log Channel', value: 'kick_log_channel_id' },
								{ name: 'Ban Log Channel', value: 'ban_log_channel_id' },
								{ name: 'Mute Log Channel', value: 'mute_log_channel_id' },
								{ name: 'Lockdown Log Channel', value: 'lockdown_log_channel_id' },
								{ name: 'Purge Log Channel', value: 'purge_log_channel_id' },
								{ name: 'Lockdown Allowed Roles', value: 'lockdown_allowed_roles' },
							),
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
			let guild, member, user, subcommand, key, value, guildConfig;

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

				// Get config
				guildConfig = getGuildConfig(guild.id);
				const prefix = guildConfig.prefix;

				if (!args || args.length < 1) {
					return await message.reply(`Usage: \`${prefix}config <view|set|remove|reset> [key] [value]\``);
				}

				subcommand = args[0].toLowerCase();
				key = args[1];
				value = args.slice(2).join(' ');

				// Validate key for text commands (only for 'set' subcommand)
				if (subcommand === 'set' || subcommand === 'remove') {
					if (!key) {
						const validKeys = subcommand === 'set' 
							? Object.keys(KEY_ALIASES).join('`, `')
							: Object.keys(KEY_ALIASES).filter(k => k !== 'prefix').join('`, `');
						return await message.reply(`Please provide a configuration key to ${subcommand}.\n\nValid keys: \`${validKeys}\``);
					}

					// Normalize the key using aliases
					const normalizedKey = KEY_ALIASES[key.toLowerCase()];
					if (!normalizedKey) {
						return await message.reply(`Invalid configuration key: \`${key}\`\n\nValid keys: \`${Object.keys(KEY_ALIASES).join('`, `')}\``);
					}

					if (subcommand === 'remove' && normalizedKey === 'prefix') {
						return await message.reply('Sorry, to reset the prefix you\'re going to have to reset the whole config. You do that via `reset`.');
					}

					// Update key to the normalized version
					key = normalizedKey;

					if (subcommand === 'set' && !value) {
						return await message.reply('Please provide a value to set for this configuration key.');
					}
				}
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
				case 'remove':
					await handleRemoveConfig(interactionOrMessage, guild, key, isSlashCommand);
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

	// Parse lockdown roles
	let lockdownDisplay = '`Not set (lockdown_allowed_roles)`';
	if (config.lockdown_allowed_roles) {
		try {
			const roleIds = JSON.parse(config.lockdown_allowed_roles);
			const roleNames = roleIds.map(roleId => {
				const role = guild.roles.cache.get(roleId);
				return role ? `<@&${roleId}>` : `Unknown Role (${roleId})`;
			});
			lockdownDisplay = roleNames.join(', ');
		} catch (error) {
			lockdownDisplay = '`Invalid role data`';
		}
	}

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
			{ name: '🔐 Lockdown Allowed Roles', value: lockdownDisplay, inline: false },
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

	switch (key.toLowerCase()) {
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
	case 'lockdown_allowed_roles':
		// Parse mention and ids
		const roleMentions = value.match(/<@&(\d+)>/g) || [];
		const roleIds = value.match(/\b\d{17,19}\b/g) || [];

		// Combine
		const allRoleIds = [...new Set([
			...roleMentions.map(mention => mention.match(/\d+/)[0]),
			...roleIds,
		])];

		if (allRoleIds.length === 0) {
			const content = 'Please provide valid role mentions (@role) or role IDs separated by spaces.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		// Validate
		const invalidRoles = [];
		for (const roleId of allRoleIds) {
			const role = guild.roles.cache.get(roleId);
			if (!role) {
				invalidRoles.push(roleId);
			}
		}

		if (invalidRoles.length > 0) {
			const content = `The following role IDs were not found: ${invalidRoles.join(', ')}`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		processedValue = JSON.stringify(allRoleIds);
		break;
	default:
		const content = 'Invalid configuration key.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Set configuration value
	setConfigValue(guild.id, key, processedValue);

	let displayValue = processedValue;
	if (key === 'lockdown_allowed_roles') {
		try {
			const roleIds = JSON.parse(processedValue);
			const roleNames = roleIds.map(roleId => {
				const role = guild.roles.cache.get(roleId);
				return role ? `@${role.name}` : `Unknown Role (${roleId})`;
			});
			displayValue = roleNames.join(', ');
		} catch (error) {
			displayValue = 'Invalid role data';
		}
	}

	// Success embed
	const embed = new EmbedBuilder()
		.setColor(0x00ff00)
		.setTitle(`✅ Configuration Updated - ${guild.name}`)
		.addFields(
    		{ name: 'Key', value: `\`${key}\``, inline: true },
			{ name: 'New Value', value: typeof displayValue === 'string' && displayValue.length > 50 ? `\`${displayValue.substring(0, 50)}...\`` : `\`${displayValue}\``, inline: true },
		)
		.setTimestamp()
		.setFooter({ text: `Updated by ${interactionOrMessage.user?.username || interactionOrMessage.author.username}` });

	return isSlashCommand
		? await interactionOrMessage.reply({ embeds: [embed] })
		: await interactionOrMessage.reply({ embeds: [embed] });
}

async function handleRemoveConfig(interactionOrMessage, guild, key, isSlashCommand) {
	if (!key) {
		const content = 'Please provide a configuration key to remove.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// For text commands, normalize the key using aliases
	let normalizedKey = key;
	if (!isSlashCommand) {
		normalizedKey = KEY_ALIASES[key.toLowerCase()];
		if (!normalizedKey) {
			const validKeys = Object.keys(KEY_ALIASES).filter(k => k !== 'prefix').join('`, `');
			const content = `Invalid configuration key: \`${key}\`\n\nValid keys: \`${validKeys}\``;
			return await interactionOrMessage.reply(content);
		}
	}

	// Don't allow removing prefix
	if (normalizedKey === 'prefix') {
		const content = 'Sorry, to reset the prefix you\'re going to have to reset the whole config. You do that via `reset`.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Validate key exists in valid config keys
	if (!VALID_CONFIG_KEYS.includes(normalizedKey)) {
		const content = 'Invalid configuration key.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Set the value to null (default)
	setConfigValue(guild.id, normalizedKey, null);

	// Success embed
	const embed = new EmbedBuilder()
		.setColor(0xff9900)
		.setTitle(`🗑️ Configuration Removed - ${guild.name}`)
		.addFields(
			{ name: 'Key', value: `\`${normalizedKey}\``, inline: true },
			{ name: 'Status', value: '`Reset to default (null)`', inline: true },
		)
		.setTimestamp()
		.setFooter({ text: `Removed by ${interactionOrMessage.user?.username || interactionOrMessage.author.username}` });

	return isSlashCommand
		? await interactionOrMessage.reply({ embeds: [embed] })
		: await interactionOrMessage.reply({ embeds: [embed] });
}

async function handleResetConfig(interactionOrMessage, guild, isSlashCommand) {
	// Reset
	resetGuildConfig(guild.id);

	const embed = new EmbedBuilder()
		.setColor(0xff9900)
		.setTitle(`🔄 Configuration Reset - ${guild.name}`)
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