module.exports = {
	name: "guilds",
	description: "The number of guilds GalaxyBot is active in. Full list featuring guilds names is available only to the bot owner, through a direct message.",

	execute: command => {
		var serversNames = [];

		command.galaxybot.activeGuilds.forEach((guild, guildId) => {
			serversNames.push(command.galaxybot.escapeMentions(guild.guild.name));
		});

		const message = `I'm active in **${serversNames.length}** server${serversNames.length != 1 ? "s" : ""}`;

		// Complete guilds list in personal message for owner.
		if (command.user.id == command.galaxybot.config.owner && command.channel.type == "dm") {
			command.channel.send(`${message}: ${serversNames.join(", ")}.`);
		}

		// Limited info for other users.
		else command.channel.send(message + ".");

		command.botGuild.log(`Showing the number of active guilds: ${serversNames.length}.`);
	}
}