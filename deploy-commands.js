const { REST, Routes } = require('discord.js');
const { clientId, token } = require('./config.json');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('crypto');

const commands = [];
const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

// Load all commands (same as your existing code)
for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);

		try {
			const commandModule = require(filePath);

			if (Array.isArray(commandModule)) {
				for (const command of commandModule) {
					if ('data' in command && 'execute' in command) {
						if (typeof command.data.toJSON === 'function') {
							commands.push(command.data.toJSON());
							console.log(`✅ Loaded command: ${command.data.name} from ${file}`);
						} else {
							console.log(`❌ [ERROR] Command in array at ${filePath} has invalid data structure.`);
						}
					} else {
						console.log(`⚠️  [WARNING] A command in array at ${filePath} is missing required properties.`);
					}
				}
			}
			else if ('data' in commandModule && 'execute' in commandModule) {
				if (typeof commandModule.data.toJSON === 'function') {
					commands.push(commandModule.data.toJSON());
					console.log(`✅ Loaded command: ${commandModule.data.name} from ${file}`);
				} else {
					console.log(`❌ [ERROR] Command at ${filePath} has invalid data structure.`);
				}
			} else {
				console.log(`⚠️  [WARNING] The command at ${filePath} is missing required properties.`);
			}
		} catch (error) {
			console.log(`❌ [ERROR] Failed to load command from ${filePath}:`, error.message);
		}
	}
}

const rest = new REST().setToken(token);

// Smart deployment function
async function deployCommands() {
	try {
		// Create a hash of current commands to check for changes
		const commandsString = JSON.stringify(commands.sort((a, b) => a.name.localeCompare(b.name)));
		const currentHash = crypto.createHash('md5').update(commandsString).digest('hex');

		// Check if we have a stored hash
		const hashFile = path.join(__dirname, '.commands-hash');
		let storedHash = '';

		if (fs.existsSync(hashFile)) {
			storedHash = fs.readFileSync(hashFile, 'utf8');
		}

		// If hashes match, no need to deploy
		if (currentHash === storedHash) {
			console.log(`✅ Commands are up to date. Skipping deployment.`);
			return;
		}

		console.log(`🔄 Commands have changed. Deploying ${commands.length} global commands...`);
		console.log(`⚠️  Note: Global commands can take up to 1 hour to propagate.`);

		// Deploy commands
		const data = await rest.put(
			Routes.applicationCommands(clientId),
			{ body: commands },
		);

		console.log(`✅ Successfully deployed ${data.length} global commands.`);

		// Save the new hash
		fs.writeFileSync(hashFile, currentHash);

	} catch (error) {
		console.error('❌ [DEPLOY ERROR]', error);
	}
}

// Export the function for use in index.js
module.exports = { deployCommands };

// If run directly, deploy immediately
if (require.main === module) {
	deployCommands();
}