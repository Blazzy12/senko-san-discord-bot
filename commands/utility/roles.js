const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getGuildConfig, setConfigValue } = require('../configuration/configuration.js');

module.exports = {
	textEnabled: true,
	category: 'utility',
	data: new SlashCommandBuilder()
		.setName('role')
		.setDescription('Manage roles for a user')
		.addSubcommand(subcommand =>
			subcommand
				.setName('add')
				.setDescription('Give a role to a user')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to give role to')
						.setRequired(true))
				.addRoleOption(option =>
					option.setName('role')
						.setDescription('Role to give')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove a role from a user')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to remove role from')
						.setRequired(true))
				.addRoleOption(option =>
					option.setName('role')
						.setDescription('Role to remove')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('view')
				.setDescription('View the current role permission configuration'))
		.addSubcommand(subcommand =>
			subcommand
				.setName('setup')
				.setDescription('Setup role permissions')
				.addRoleOption(option =>
					option.setName('giver_role')
						.setDescription('Role that can give other roles')
						.setRequired(true))
				.addRoleOption(option =>
					option.setName('target_role')
						.setDescription('Role that can be given')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('action')
						.setDescription('Add or remove permission')
						.setRequired(true)
						.addChoices(
							{ name: 'Add Permission', value: 'add' },
							{ name: 'Remove Permission', value: 'remove' },
						))),
	async execute(interactionOrMessage, args) {
		// Check if slash command
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		// Declare
		let guild, member, user, subcommand, targetUser, targetRole, giverRole, action, guildConfig;

		if (isSlashCommand) {
			const interaction = interactionOrMessage;
			guild = interaction.guild;
			member = interaction.member;
			user = interaction.user;

			subcommand = interaction.options.getSubcommand();
			targetUser = interaction.options.getUser('user');
			targetRole = interaction.options.getRole('role');
			giverRole = interaction.options.getRole('giver_role');
			action = interaction.options.getString('action');
		} else {
			const message = interactionOrMessage;
			guild = message.guild;
			member = message.member;
			user = message.author;

			// Get config
			guildConfig = getGuildConfig(guild.id);
			const prefix = guildConfig.prefix;

			if (!args || args.length < 1) {
				return await message.reply(`Usage: \`${prefix}role <add|remove|view|setup> [arguments]\``);
			}

			subcommand = args[0].toLowerCase();

			// Parse
			switch (subcommand) {
			case 'add':
			case 'remove':
				if (args.length < 3) {
					return await message.reply(`Usage: \`${prefix}role ${subcommand} <user> <role>\``);
				}
				// Parse user (mention or ID)
				const userMatch = args[1].match(/^<@!?(\d+)>$/) || args[1].match(/^(\d+)$/);
				if (!userMatch) {
					return await message.reply('Please provide a valid user mention or ID.');
				}
				targetUser = await guild.members.fetch(userMatch[1]).then(m => m.user).catch(() => null);
				if (!targetUser) {
					return await message.reply('User not found in this server.');
				}

				// Parse role (mention or ID or name)
				const roleArg = args.slice(2).join(' ');
				const roleMatch = roleArg.match(/^<@&(\d+)>$/) || roleArg.match(/^(\d+)$/);
				if (roleMatch) {
					targetRole = guild.roles.cache.get(roleMatch[1]);
				} else {
					// Try to find by name
					targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
				}
				if (!targetRole) {
					return await message.reply('Role not found. Please use a role mention, ID, or exact name.');
				}
				break;
			case 'setup':
				if (args.length < 4) {
					return await message.reply(`Usage: \`${prefix}role setup <giver_role> <target_role> <add|remove>\``);
				}
				// Parse giver role
				const giverRoleArg = args[1];
				const giverMatch = giverRoleArg.match(/^<@&(\d+)>$/) || giverRoleArg.match(/^(\d+)$/);
				if (giverMatch) {
					giverRole = guild.roles.cache.get(giverMatch[1]);
				} else {
					giverRole = guild.roles.cache.find(r => r.name.toLowerCase() === giverRoleArg.toLowerCase());
				}
				if (!giverRole) {
					return await message.reply('Giver role not found.');
				}

				// Parse target role
				const targetRoleArg = args[2];
				const targetMatch = targetRoleArg.match(/^<@&(\d+)>$/) || targetRoleArg.match(/^(\d+)$/);
				if (targetMatch) {
					targetRole = guild.roles.cache.get(targetMatch[1]);
				} else {
					targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === targetRoleArg.toLowerCase());
				}
				if (!targetRole) {
					return await message.reply('Target role not found.');
				}

				action = args[3].toLowerCase();
				if (!['add', 'remove'].includes(action)) {
					return await message.reply('Action must be either "add" or "remove".');
				}
				break;
			}
		}

		try {
			switch (subcommand) {
			case 'add':
				await handleRoleAdd(interactionOrMessage, guild, member, targetUser, targetRole, isSlashCommand);
				break;
			case 'remove':
				await handleRoleRemove(interactionOrMessage, guild, member, targetUser, targetRole, isSlashCommand);
				break;
			case 'view':
				await handleRoleView(interactionOrMessage, guild, isSlashCommand);
				break;
			case 'setup':
				await handleRoleSetup(interactionOrMessage, guild, member, giverRole, targetRole, action, isSlashCommand);
				break;
			default:
				const content = 'Invalid subcommand. Use `add`, `remove`, `view`, or `setup`.';
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}
		} catch (error) {
			console.error('!IMPORTANT! Error in role command:', error);
			const content = 'There was an error processing your role command.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}
	},
};

async function handleRoleAdd(interactionOrMessage, guild, executor, targetUser, targetRole, isSlashCommand) {
	const config = getGuildConfig(guild.id);

	// Get target member
	const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
	if (!targetMember) {
		const content = 'Target user is not in this server.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check if user already has the role
	if (targetMember.roles.cache.has(targetRole.id)) {
		const content = `${targetUser.username} already has the ${targetRole.name} role.`;
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check permissions
	const hasPermission = await checkRolePermission(guild, executor, targetRole);
	if (!hasPermission) {
		const content = 'You don\'t have permission to give this role.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check role hierarchy
	if (targetRole.position >= executor.roles.highest.position && !executor.permissions.has(PermissionFlagsBits.Administrator)) {
		const content = 'You cannot give a role that is equal to or higher than your highest role.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check bot permissions
	const botMember = guild.members.cache.get(guild.client.user.id);
	if (targetRole.position >= botMember.roles.highest.position) {
		const content = 'I cannot give a role that is equal to or higher than my highest role.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	try {
		await targetMember.roles.add(targetRole, `Role given by ${executor.user?.username || executor.displayName}`);

		const embed = new EmbedBuilder()
			.setColor(0x00ff00)
			.setTitle('✅ Role Added')
			.addFields(
				{ name: 'User', value: `${targetUser.username} (${targetUser.id})`, inline: true },
				{ name: 'Role', value: `${targetRole.name}`, inline: true },
				{ name: 'Given by', value: `${executor.user?.username || executor.displayName}`, inline: true },
			)
			.setTimestamp();

		const LogChannelId = config.roles_command_log_channel_id;

		// Send to configured logs
		if (LogChannelId) {
			const logChannel = guild.channels.cache.get(LogChannelId);
			if (logChannel && logChannel.isTextBased()) {
				try {
					await logChannel.send({ embeds: [embed] });
				} catch (logError) {
					console.error('Error sending log to log channel:', logError);
				}
			} else {
				console.warn('Configured log channel not found or is not a text channel.');
			}
		} else {
			console.log('No log channel configured for this guild.');
		}

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [embed] })
			: await interactionOrMessage.reply({ embeds: [embed] });

	} catch (error) {
		console.error('Error adding role:', error);
		const content = 'Failed to add the role. Please check my permissions.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}
}

async function handleRoleRemove(interactionOrMessage, guild, executor, targetUser, targetRole, isSlashCommand) {
	const config = getGuildConfig(guild.id);

	// Get target member
	const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
	if (!targetMember) {
		const content = 'Target user is not in this server.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check if user has the role
	if (!targetMember.roles.cache.has(targetRole.id)) {
		const content = `${targetUser.username} doesn't have the ${targetRole.name} role.`;
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check permissions
	const hasPermission = await checkRolePermission(guild, executor, targetRole);
	if (!hasPermission) {
		const content = 'You don\'t have permission to remove this role.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check role hierarchy
	if (targetRole.position >= executor.roles.highest.position && !executor.permissions.has(PermissionFlagsBits.Administrator)) {
		const content = 'You cannot remove a role that is equal to or higher than your highest role.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	try {
		await targetMember.roles.remove(targetRole, `Role removed by ${executor.user?.username || executor.displayName}`);

		const embed = new EmbedBuilder()
			.setColor(0xff9900)
			.setTitle('✅ Role Removed')
			.addFields(
				{ name: 'User', value: `${targetUser.username} (${targetUser.id})`, inline: true },
				{ name: 'Role', value: `${targetRole.name}`, inline: true },
				{ name: 'Removed by', value: `${executor.user?.username || executor.displayName}`, inline: true },
			)
			.setTimestamp();

		const LogChannelId = config.roles_command_log_channel_id;

		// Send to configured logs
		if (LogChannelId) {
			const logChannel = guild.channels.cache.get(LogChannelId);
			if (logChannel && logChannel.isTextBased()) {
				try {
					await logChannel.send({ embeds: [embed] });
				} catch (logError) {
					console.error('Error sending log to log channel:', logError);
				}
			} else {
				console.warn('Configured log channel not found or is not a text channel.');
			}
		} else {
			console.log('No log channel configured for this guild.');
		}

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [embed] })
			: await interactionOrMessage.reply({ embeds: [embed] });

	} catch (error) {
		console.error('Error removing role:', error);
		const content = 'Failed to remove the role. Please check my permissions.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}
}

async function handleRoleView(interactionOrMessage, guild, isSlashCommand) {
	const config = getGuildConfig(guild.id);

	if (!config.role_permissions) {
		const content = 'No role permissions have been configured yet. Use `/role setup` or your respective text command to set them up.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	try {
		const rolePerms = JSON.parse(config.role_permissions);
		const embed = new EmbedBuilder()
			.setColor(0x0099ff)
			.setTitle(`👤 Role Permissions - ${guild.name}`)
			.setTimestamp();

		let description = '';
		for (const [giverRoleId, allowedRoleIds] of Object.entries(rolePerms)) {
			const giverRole = guild.roles.cache.get(giverRoleId);
			const giverRoleName = giverRole ? giverRole.name : `Unknown Role (${giverRoleId})`;

			const allowedRoleNames = allowedRoleIds.map(roleId => {
				const role = guild.roles.cache.get(roleId);
				return role ? role.name : `Unknown Role (${roleId})`;
			});

			description += `**${giverRoleName}** can give:\n`;
			description += allowedRoleNames.map(name => `• ${name}`).join('\n');
			description += '\n\n';
		}

		if (description.length > 4096) {
			description = description.substring(0, 4090) + '...';
		}

		embed.setDescription(description || 'No permissions configured.');

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [embed] })
			: await interactionOrMessage.reply({ embeds: [embed] });

	} catch (error) {
		console.error('Error parsing role permissions:', error);
		const content = 'Error reading role permissions configuration.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}
}

async function handleRoleSetup(interactionOrMessage, guild, executor, giverRole, targetRole, action, isSlashCommand) {
	// Check admin permissions
	if (!executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
		const content = 'You need "Manage Server" permissions to setup role permissions.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	const config = getGuildConfig(guild.id);
	let rolePerms = {};

	// Parse existing permissions
	if (config.role_permissions) {
		try {
			rolePerms = JSON.parse(config.role_permissions);
		} catch (error) {
			console.error('Error parsing existing role permissions:', error);
		}
	}

	if (action === 'add') {
		// Add permission
		if (!rolePerms[giverRole.id]) {
			rolePerms[giverRole.id] = [];
		}

		if (!rolePerms[giverRole.id].includes(targetRole.id)) {
			rolePerms[giverRole.id].push(targetRole.id);
		} else {
			const content = `${giverRole.name} already has permission to give ${targetRole.name}.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}
	} else if (action === 'remove') {
		// Remove permission
		if (rolePerms[giverRole.id]) {
			const index = rolePerms[giverRole.id].indexOf(targetRole.id);
			if (index > -1) {
				rolePerms[giverRole.id].splice(index, 1);
				// Remove empty arrays
				if (rolePerms[giverRole.id].length === 0) {
					delete rolePerms[giverRole.id];
				}
			} else {
				const content = `${giverRole.name} doesn't have permission to give ${targetRole.name}.`;
				return isSlashCommand
					? await interactionOrMessage.reply({ content, ephemeral: true })
					: await interactionOrMessage.reply(content);
			}
		} else {
			const content = `${giverRole.name} doesn't have any role permissions configured.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}
	}

	// Save updated permissions
	const newPermsJson = Object.keys(rolePerms).length > 0 ? JSON.stringify(rolePerms) : null;
	setConfigValue(guild.id, 'role_permissions', newPermsJson);

	const embed = new EmbedBuilder()
		.setColor(action === 'add' ? 0x00ff00 : 0xff9900)
		.setTitle(`✅ Role Permission ${action === 'add' ? 'Added' : 'Removed'}`)
		.addFields(
			{ name: 'Giver Role', value: giverRole.name, inline: true },
			{ name: 'Target Role', value: targetRole.name, inline: true },
			{ name: 'Action', value: action === 'add' ? 'Added Permission' : 'Removed Permission', inline: true },
		)
		.setTimestamp()
		.setFooter({ text: `Updated by ${executor.user?.username || executor.displayName}` });

	return isSlashCommand
		? await interactionOrMessage.reply({ embeds: [embed] })
		: await interactionOrMessage.reply({ embeds: [embed] });
}

async function checkRolePermission(guild, member, targetRole) {
	// Check if user has Manage Roles permission (always allow)
	if (member.permissions.has(PermissionFlagsBits.ManageRoles)) {
		return true;
	}

	// Check custom role permissions
	const config = getGuildConfig(guild.id);
	if (!config.role_permissions) {
		return false;
	}

	try {
		const rolePerms = JSON.parse(config.role_permissions);

		// Check if any of the member's roles can give the target role
		for (const memberRoleId of member.roles.cache.keys()) {
			if (rolePerms[memberRoleId] && rolePerms[memberRoleId].includes(targetRole.id)) {
				return true;
			}
		}
	} catch (error) {
		console.error('Error checking role permissions:', error);
	}

	return false;
}