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
				.setDescription('Give a role or role group to a user')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to give role to')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('role_or_group')
						.setDescription('Role or role group name to give')
						.setRequired(true)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('remove')
				.setDescription('Remove a role or role group from a user')
				.addUserOption(option =>
					option.setName('user')
						.setDescription('User to remove role from')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('role_or_group')
						.setDescription('Role or role group name to remove')
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
						)))
		.addSubcommand(subcommand =>
			subcommand
				.setName('group')
				.setDescription('Manage role groups')
				.addStringOption(option =>
					option.setName('action')
						.setDescription('Action to perform')
						.setRequired(true)
						.addChoices(
							{ name: 'Create', value: 'create' },
							{ name: 'Delete', value: 'delete' },
							{ name: 'Add Role', value: 'add_role' },
							{ name: 'Remove Role', value: 'remove_role' },
							{ name: 'List', value: 'list' },
						))
				.addStringOption(option =>
					option.setName('group_name')
						.setDescription('Name of the role group')
						.setRequired(false))
				.addRoleOption(option =>
					option.setName('role')
						.setDescription('Role to add/remove from group')
						.setRequired(false))),
	async execute(interactionOrMessage, args) {
		// Check if slash command
		const isSlashCommand = interactionOrMessage.isCommand?.() || interactionOrMessage.replied !== undefined;

		// Declare
		let guild, member, user, subcommand, targetUser, targetRoleOrGroup, giverRole, action, guildConfig;

		if (isSlashCommand) {
			const interaction = interactionOrMessage;
			guild = interaction.guild;
			member = interaction.member;
			user = interaction.user;

			subcommand = interaction.options.getSubcommand();
			targetUser = interaction.options.getUser('user');
			targetRoleOrGroup = interaction.options.getString('role_or_group');
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
				return await message.reply(`Usage: \`${prefix}role <add|remove|view|setup|group> [arguments]\``);
			}

			subcommand = args[0].toLowerCase();

			// Parse
			switch (subcommand) {
			case 'add':
			case 'remove':
				if (args.length < 3) {
					return await message.reply(`Usage: \`${prefix}role ${subcommand} <user> <role or group>\``);
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

				// Get role or group name
				targetRoleOrGroup = args.slice(2).join(' ');
				break;
			case 'setup':
				if (args.length < 4) {
					return await message.reply(`Usage: \`${prefix}role setup <giver_role> <target_role> <add|remove>\``);
				}
				// Parse giver role
				const giverRoleArg = args[1];
				const giverMatch = giverRoleArg.match(/^<@&(\d+)>$/) || giverRoleArg.match(/^(\d+)$/);
				let targetRole;
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

				// Store targetRole for later use
				targetRoleOrGroup = targetRole;
				break;
			case 'group':
				if (args.length < 2) {
					return await message.reply(`Usage: \`${prefix}role group <create|delete|add_role|remove_role|list> [group_name] [role]\``);
				}
				action = args[1].toLowerCase();
				const groupName = args[2];

				let role = null;
				if (args.length > 3) {
					const roleArg = args.slice(3).join(' ');
					const roleMatch = roleArg.match(/^<@&(\d+)>$/) || roleArg.match(/^(\d+)$/);
					if (roleMatch) {
						role = guild.roles.cache.get(roleMatch[1]);
					} else {
						role = guild.roles.cache.find(r => r.name.toLowerCase() === roleArg.toLowerCase());
					}
				}

				return await handleRoleGroup(interactionOrMessage, guild, member, action, groupName, role, isSlashCommand);
			}
		}

		try {
			switch (subcommand) {
			case 'add':
				await handleRoleAdd(interactionOrMessage, guild, member, targetUser, targetRoleOrGroup, isSlashCommand);
				break;
			case 'remove':
				await handleRoleRemove(interactionOrMessage, guild, member, targetUser, targetRoleOrGroup, isSlashCommand);
				break;
			case 'view':
				await handleRoleView(interactionOrMessage, guild, isSlashCommand);
				break;
			case 'setup':
				await handleRoleSetup(interactionOrMessage, guild, member, giverRole, targetRoleOrGroup, action, isSlashCommand);
				break;
			case 'group':
				const groupAction = isSlashCommand ? interactionOrMessage.options.getString('action') : action;
				const groupName = isSlashCommand ? interactionOrMessage.options.getString('group_name') : args[2];
				const role = isSlashCommand ? interactionOrMessage.options.getRole('role') : null;
				await handleRoleGroup(interactionOrMessage, guild, member, groupAction, groupName, role, isSlashCommand);
				break;
			default:
				const content = 'Invalid subcommand. Use `add`, `remove`, `view`, `setup`, or `group`.';
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

async function handleRoleAdd(interactionOrMessage, guild, executor, targetUser, roleOrGroupName, isSlashCommand) {
	const config = getGuildConfig(guild.id);

	// Get target member
	const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
	if (!targetMember) {
		const content = 'Target user is not in this server.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check if it's a role group first
	const roleGroup = getRoleGroup(guild.id, roleOrGroupName);
	let rolesToAdd = [];
	let isGroup = false;

	if (roleGroup) {
		// It's a role group
		isGroup = true;
		for (const roleId of roleGroup.roles) {
			const role = guild.roles.cache.get(roleId);
			if (role) {
				rolesToAdd.push(role);
			}
		}

		if (rolesToAdd.length === 0) {
			const content = `Role group "${roleOrGroupName}" exists but contains no valid roles.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}
	} else {
		// Try to find it as a single role
		const roleMatch = roleOrGroupName.match(/^<@&(\d+)>$/) || roleOrGroupName.match(/^(\d+)$/);
		let targetRole;

		if (roleMatch) {
			targetRole = guild.roles.cache.get(roleMatch[1]);
		} else {
			targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleOrGroupName.toLowerCase());
		}

		if (!targetRole) {
			const content = `Role or role group "${roleOrGroupName}" not found.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		rolesToAdd.push(targetRole);
	}

	// Check permissions and hierarchy for all roles
	const errors = [];
	const rolesAlreadyHas = [];
	const validRoles = [];

	for (const role of rolesToAdd) {
		// Check if user already has the role
		if (targetMember.roles.cache.has(role.id)) {
			rolesAlreadyHas.push(role.name);
			continue;
		}

		// Check permissions
		const hasPermission = await checkRolePermission(guild, executor, role);
		if (!hasPermission) {
			errors.push(`No permission to give: ${role.name}`);
			continue;
		}

		// Check role hierarchy
		if (role.position >= executor.roles.highest.position && !executor.permissions.has(PermissionFlagsBits.Administrator)) {
			errors.push(`Role too high: ${role.name}`);
			continue;
		}

		// Check bot permissions
		const botMember = guild.members.cache.get(guild.client.user.id);
		if (role.position >= botMember.roles.highest.position) {
			errors.push(`Bot cannot give: ${role.name}`);
			continue;
		}

		validRoles.push(role);
	}

	// If no valid roles to add
	if (validRoles.length === 0) {
		let content = isGroup 
			? `Cannot add any roles from group "${roleOrGroupName}".`
			: `Cannot add the role "${roleOrGroupName}".`;

		if (rolesAlreadyHas.length > 0) {
			content += `\n\nAlready has: ${rolesAlreadyHas.join(', ')}`;
		}
		if (errors.length > 0) {
			content += `\n\nErrors:\n${errors.join('\n')}`;
		}

		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Add all valid roles
	try {
		await targetMember.roles.add(validRoles, `Role${isGroup ? 's' : ''} given by ${executor.user?.username || executor.displayName}`);

		const embed = new EmbedBuilder()
			.setColor(0x00ff00)
			.setTitle(`✅ Role${isGroup ? 's' : ''} Added`)
			.addFields(
				{ name: 'User', value: `${targetUser.username} (${targetUser.id})`, inline: true },
				{ name: isGroup ? 'Role Group' : 'Role', value: isGroup ? roleOrGroupName : validRoles[0].name, inline: true },
				{ name: 'Given by', value: `${executor.user?.username || executor.displayName}`, inline: true },
			);

		if (isGroup) {
			embed.addFields({ name: 'Roles Added', value: validRoles.map(r => `• ${r.name}`).join('\n'), inline: false });
		}

		if (rolesAlreadyHas.length > 0) {
			embed.addFields({ name: 'Already Had', value: rolesAlreadyHas.join(', '), inline: false });
		}

		if (errors.length > 0) {
			embed.addFields({ name: 'Errors', value: errors.join('\n'), inline: false });
		}

		embed.setTimestamp();

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
			}
		}

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [embed] })
			: await interactionOrMessage.reply({ embeds: [embed] });

	} catch (error) {
		console.error('Error adding role(s):', error);
		const content = 'Failed to add the role(s). Please check my permissions.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}
}

async function handleRoleRemove(interactionOrMessage, guild, executor, targetUser, roleOrGroupName, isSlashCommand) {
	const config = getGuildConfig(guild.id);

	// Get target member
	const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
	if (!targetMember) {
		const content = 'Target user is not in this server.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Check if it's a role group first
	const roleGroup = getRoleGroup(guild.id, roleOrGroupName);
	let rolesToRemove = [];
	let isGroup = false;

	if (roleGroup) {
		// It's a role group
		isGroup = true;
		for (const roleId of roleGroup.roles) {
			const role = guild.roles.cache.get(roleId);
			if (role) {
				rolesToRemove.push(role);
			}
		}

		if (rolesToRemove.length === 0) {
			const content = `Role group "${roleOrGroupName}" exists but contains no valid roles.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}
	} else {
		// Try to find it as a single role
		const roleMatch = roleOrGroupName.match(/^<@&(\d+)>$/) || roleOrGroupName.match(/^(\d+)$/);
		let targetRole;

		if (roleMatch) {
			targetRole = guild.roles.cache.get(roleMatch[1]);
		} else {
			targetRole = guild.roles.cache.find(r => r.name.toLowerCase() === roleOrGroupName.toLowerCase());
		}

		if (!targetRole) {
			const content = `Role or role group "${roleOrGroupName}" not found.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		rolesToRemove.push(targetRole);
	}

	// Check permissions and hierarchy for all roles
	const errors = [];
	const rolesDoesntHave = [];
	const validRoles = [];

	for (const role of rolesToRemove) {
		// Check if user has the role
		if (!targetMember.roles.cache.has(role.id)) {
			rolesDoesntHave.push(role.name);
			continue;
		}

		// Check permissions
		const hasPermission = await checkRolePermission(guild, executor, role);
		if (!hasPermission) {
			errors.push(`No permission to remove: ${role.name}`);
			continue;
		}

		// Check role hierarchy
		if (role.position >= executor.roles.highest.position && !executor.permissions.has(PermissionFlagsBits.Administrator)) {
			errors.push(`Role too high: ${role.name}`);
			continue;
		}

		validRoles.push(role);
	}

	// If no valid roles to remove
	if (validRoles.length === 0) {
		let content = isGroup 
			? `Cannot remove any roles from group "${roleOrGroupName}".`
			: `Cannot remove the role "${roleOrGroupName}".`;

		if (rolesDoesntHave.length > 0) {
			content += `\n\nDoesn't have: ${rolesDoesntHave.join(', ')}`;
		}
		if (errors.length > 0) {
			content += `\n\nErrors:\n${errors.join('\n')}`;
		}

		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	// Remove all valid roles
	try {
		await targetMember.roles.remove(validRoles, `Role${isGroup ? 's' : ''} removed by ${executor.user?.username || executor.displayName}`);

		const embed = new EmbedBuilder()
			.setColor(0xff9900)
			.setTitle(`✅ Role${isGroup ? 's' : ''} Removed`)
			.addFields(
				{ name: 'User', value: `${targetUser.username} (${targetUser.id})`, inline: true },
				{ name: isGroup ? 'Role Group' : 'Role', value: isGroup ? roleOrGroupName : validRoles[0].name, inline: true },
				{ name: 'Removed by', value: `${executor.user?.username || executor.displayName}`, inline: true },
			);

		if (isGroup) {
			embed.addFields({ name: 'Roles Removed', value: validRoles.map(r => `• ${r.name}`).join('\n'), inline: false });
		}

		if (rolesDoesntHave.length > 0) {
			embed.addFields({ name: "Didn't Have", value: rolesDoesntHave.join(', '), inline: false });
		}

		if (errors.length > 0) {
			embed.addFields({ name: 'Errors', value: errors.join('\n'), inline: false });
		}

		embed.setTimestamp();

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
			}
		}

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [embed] })
			: await interactionOrMessage.reply({ embeds: [embed] });

	} catch (error) {
		console.error('Error removing role(s):', error);
		const content = 'Failed to remove the role(s). Please check my permissions.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}
}

async function handleRoleView(interactionOrMessage, guild, isSlashCommand) {
	const config = getGuildConfig(guild.id);

	const embed = new EmbedBuilder()
		.setColor(0x0099ff)
		.setTitle(`👤 Role Configuration - ${guild.name}`)
		.setTimestamp();

	let description = '';

	// Show role permissions
	if (config.role_permissions) {
		try {
			const rolePerms = JSON.parse(config.role_permissions);
			description += '**Role Permissions:**\n';
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
		} catch (error) {
			console.error('Error parsing role permissions:', error);
			description += '**Role Permissions:** Error reading configuration\n\n';
		}
	} else {
		description += '**Role Permissions:** None configured\n\n';
	}

	// Show role groups
	if (config.role_groups) {
		try {
			const roleGroups = JSON.parse(config.role_groups);
			description += '**Role Groups:**\n';
			for (const [groupName, groupData] of Object.entries(roleGroups)) {
				const roleNames = groupData.roles.map(roleId => {
					const role = guild.roles.cache.get(roleId);
					return role ? role.name : `Unknown Role (${roleId})`;
				});

				description += `**${groupName}** contains:\n`;
				description += roleNames.map(name => `• ${name}`).join('\n');
				description += '\n\n';
			}
		} catch (error) {
			console.error('Error parsing role groups:', error);
			description += '**Role Groups:** Error reading configuration\n\n';
		}
	} else {
		description += '**Role Groups:** None configured\n';
	}

	if (description.length > 4096) {
		description = description.substring(0, 4090) + '...';
	}

	embed.setDescription(description || 'No configuration found.');

	return isSlashCommand
		? await interactionOrMessage.reply({ embeds: [embed] })
		: await interactionOrMessage.reply({ embeds: [embed] });
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

async function handleRoleGroup(interactionOrMessage, guild, executor, action, groupName, role, isSlashCommand) {
	// Check admin permissions for all actions except list
	if (action !== 'list' && !executor.permissions.has(PermissionFlagsBits.ManageGuild)) {
		const content = 'You need "Manage Server" permissions to manage role groups.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}

	const config = getGuildConfig(guild.id);
	let roleGroups = {};

	// Parse existing groups
	if (config.role_groups) {
		try {
			roleGroups = JSON.parse(config.role_groups);
		} catch (error) {
			console.error('Error parsing existing role groups:', error);
		}
	}

	switch (action) {
	case 'create':
		if (!groupName) {
			const content = 'Please provide a group name.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		if (roleGroups[groupName.toLowerCase()]) {
			const content = `Role group "${groupName}" already exists.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		roleGroups[groupName.toLowerCase()] = { name: groupName, roles: [] };
		setConfigValue(guild.id, 'role_groups', JSON.stringify(roleGroups));

		const createEmbed = new EmbedBuilder()
			.setColor(0x00ff00)
			.setTitle('✅ Role Group Created')
			.addFields({ name: 'Group Name', value: groupName, inline: true })
			.setTimestamp()
			.setFooter({ text: `Created by ${executor.user?.username || executor.displayName}` });

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [createEmbed] })
			: await interactionOrMessage.reply({ embeds: [createEmbed] });

	case 'delete':
		if (!groupName) {
			const content = 'Please provide a group name.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		if (!roleGroups[groupName.toLowerCase()]) {
			const content = `Role group "${groupName}" does not exist.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		delete roleGroups[groupName.toLowerCase()];
		const newGroupsJson = Object.keys(roleGroups).length > 0 ? JSON.stringify(roleGroups) : null;
		setConfigValue(guild.id, 'role_groups', newGroupsJson);

		const deleteEmbed = new EmbedBuilder()
			.setColor(0xff0000)
			.setTitle('✅ Role Group Deleted')
			.addFields({ name: 'Group Name', value: groupName, inline: true })
			.setTimestamp()
			.setFooter({ text: `Deleted by ${executor.user?.username || executor.displayName}` });

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [deleteEmbed] })
			: await interactionOrMessage.reply({ embeds: [deleteEmbed] });

	case 'add_role':
		if (!groupName || !role) {
			const content = 'Please provide both a group name and a role.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		if (!roleGroups[groupName.toLowerCase()]) {
			const content = `Role group "${groupName}" does not exist. Create it first with \`/role group create\`.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		if (roleGroups[groupName.toLowerCase()].roles.includes(role.id)) {
			const content = `Role ${role.name} is already in group "${groupName}".`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		roleGroups[groupName.toLowerCase()].roles.push(role.id);
		setConfigValue(guild.id, 'role_groups', JSON.stringify(roleGroups));

		const addRoleEmbed = new EmbedBuilder()
			.setColor(0x00ff00)
			.setTitle('✅ Role Added to Group')
			.addFields(
				{ name: 'Group Name', value: groupName, inline: true },
				{ name: 'Role', value: role.name, inline: true },
			)
			.setTimestamp()
			.setFooter({ text: `Added by ${executor.user?.username || executor.displayName}` });

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [addRoleEmbed] })
			: await interactionOrMessage.reply({ embeds: [addRoleEmbed] });

	case 'remove_role':
		if (!groupName || !role) {
			const content = 'Please provide both a group name and a role.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		if (!roleGroups[groupName.toLowerCase()]) {
			const content = `Role group "${groupName}" does not exist.`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		const roleIndex = roleGroups[groupName.toLowerCase()].roles.indexOf(role.id);
		if (roleIndex === -1) {
			const content = `Role ${role.name} is not in group "${groupName}".`;
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		roleGroups[groupName.toLowerCase()].roles.splice(roleIndex, 1);
		setConfigValue(guild.id, 'role_groups', JSON.stringify(roleGroups));

		const removeRoleEmbed = new EmbedBuilder()
			.setColor(0xff9900)
			.setTitle('✅ Role Removed from Group')
			.addFields(
				{ name: 'Group Name', value: groupName, inline: true },
				{ name: 'Role', value: role.name, inline: true },
			)
			.setTimestamp()
			.setFooter({ text: `Removed by ${executor.user?.username || executor.displayName}` });

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [removeRoleEmbed] })
			: await interactionOrMessage.reply({ embeds: [removeRoleEmbed] });

	case 'list':
		if (Object.keys(roleGroups).length === 0) {
			const content = 'No role groups configured. Use `/role group create` to create one.';
			return isSlashCommand
				? await interactionOrMessage.reply({ content, ephemeral: true })
				: await interactionOrMessage.reply(content);
		}

		const listEmbed = new EmbedBuilder()
			.setColor(0x0099ff)
			.setTitle(`📋 Role Groups - ${guild.name}`)
			.setTimestamp();

		let description = '';
		for (const [key, groupData] of Object.entries(roleGroups)) {
			const roleNames = groupData.roles.map(roleId => {
				const r = guild.roles.cache.get(roleId);
				return r ? r.name : `Unknown Role (${roleId})`;
			});

			description += `**${groupData.name}**\n`;
			if (roleNames.length > 0) {
				description += roleNames.map(name => `• ${name}`).join('\n');
			} else {
				description += '• No roles in this group';
			}
			description += '\n\n';
		}

		if (description.length > 4096) {
			description = description.substring(0, 4090) + '...';
		}

		listEmbed.setDescription(description);

		return isSlashCommand
			? await interactionOrMessage.reply({ embeds: [listEmbed] })
			: await interactionOrMessage.reply({ embeds: [listEmbed] });

	default:
		const content = 'Invalid action. Use `create`, `delete`, `add_role`, `remove_role`, or `list`.';
		return isSlashCommand
			? await interactionOrMessage.reply({ content, ephemeral: true })
			: await interactionOrMessage.reply(content);
	}
}

function getRoleGroup(guildId, groupName) {
	const config = getGuildConfig(guildId);
	if (!config.role_groups) {
		return null;
	}

	try {
		const roleGroups = JSON.parse(config.role_groups);
		return roleGroups[groupName.toLowerCase()] || null;
	} catch (error) {
		console.error('Error parsing role groups:', error);
		return null;
	}
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