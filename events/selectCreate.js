const { Events, MessageFlags, Collection } = require('discord.js');

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		if (!interaction.isStringSelectMenu()) return;

		const selectMenu = interaction.client.selectMenus.get(interaction.customId);

		if (!selectMenu) {
			console.error(`No select menu matching ${interaction.customId} was found.`);
			return;
		}

		const { cooldowns } = interaction.client;

		if (!cooldowns.has(selectMenu.data.name)) {
			cooldowns.set(selectMenu.data.name, new Collection());
		}

		const now = Date.now();
		const timestamps = cooldowns.get(selectMenu.data.name);
		const defaultCooldownDuration = 1;
		const cooldownAmount = (selectMenu.cooldown ?? defaultCooldownDuration) * 1_000;

		if (timestamps.has(interaction.user.id)) {
			const expirationTime = timestamps.get(interaction.user.id) + cooldownAmount;
			if (now < expirationTime) {
				const expiredTimestamp = Math.round(expirationTime / 1_000);
				return interaction.reply({ content: `Please wait, you are on a cooldown for \`${selectMenu.data.name}\`. You can use it again <t:${expiredTimestamp}:R>.`, flags: MessageFlags.Ephemeral });
			}
		}

		timestamps.set(interaction.user.id, now);
		setTimeout(() => timestamps.delete(interaction.user.id), cooldownAmount);

		try {
			await selectMenu.execute(interaction);
		} catch (error) {
			console.error(error);
			if (interaction.replied || interaction.deferred) {
				await interaction.followUp({ content: 'There was an error while executing this select menu!', flags: MessageFlags.Ephemeral });
			} else {
				await interaction.reply({ content: 'There was an error while executing this select menu!', flags: MessageFlags.Ephemeral });
			}
		}
	},
};
