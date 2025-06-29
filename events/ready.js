const { Events } = require('discord.js');
const { initializeStickyHandler } = require('../commands/moderation/lockdown.js');

module.exports = {
	name: Events.ClientReady,
	once: true,
	execute(client) {
		console.log(`Ready! Logged in as ${client.user.tag}`);

		// Init sticky
		initializeStickyHandler(client);
	},
};
