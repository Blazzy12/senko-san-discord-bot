const { REST, Routes } = require('discord.js');
const { clientId, guildId, token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');

const commands = [];
// Grab all the command folders from the commands directory you created earlier
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	// Grab all the command files from the commands directory you created earlier
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	// Grab the SlashCommandBuilder#toJSON() output of each command's data for deployment
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);

		try {
			const commandModule = require(filePath);

			// Check if the module exports an array of commands
			if (Array.isArray(commandModule)) {
				for (const command of commandModule) {
					if ('data' in command && 'execute' in command) {
						// Additional check to ensure data has toJSON method
						if (typeof command.data.toJSON === 'function') {
							commands.push(command.data.toJSON());
							console.log(`✅ Loaded command: ${command.data.name} from ${file}`);
						} else {
							console.log(`❌ [ERROR] Command in array at ${filePath} has invalid data structure. Data:`, command.data);
						}
					} else {
						console.log(`⚠️  [WARNING] A command in array at ${filePath} is missing a required "data" or "execute" property.`);
					}
				}
			}
			// Handle single command export (original behavior)
			else if ('data' in commandModule && 'execute' in commandModule) {
				// Additional check to ensure data has toJSON method
				if (typeof commandModule.data.toJSON === 'function') {
					commands.push(commandModule.data.toJSON());
					console.log(`✅ Loaded command: ${commandModule.data.name} from ${file}`);
				} else {
					console.log(`❌ [ERROR] Command at ${filePath} has invalid data structure. Data:`, commandModule.data);
					console.log(`❌ [ERROR] Expected SlashCommandBuilder instance, got:`, typeof commandModule.data);
				}
			} else {
				console.log(`⚠️  [WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
				if (commandModule.data) {
					console.log(`Data found but invalid:`, commandModule.data);
				}
			}
		} catch (error) {
			console.log(`❌ [ERROR] Failed to load command from ${filePath}:`, error.message);
		}
	}
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
	try {
		console.log(`\n🚀 Started refreshing ${commands.length} application (/) commands.`);

		// The put method is used to fully refresh all commands in the guild with the current set
		const data = await rest.put(
			Routes.applicationGuildCommands(clientId, guildId),
			{ body: commands },
		);

		console.log(`✅ Successfully reloaded ${data.length} application (/) commands.`);
	} catch (error) {
		// And of course, make sure you catch and log any errors!
		console.error('❌ [DEPLOY ERROR]', error);
	}
})();