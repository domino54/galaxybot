const ManiaPlanet = require("./../integrations/ManiaPlanet.js");

module.exports = {
	name: "mpserver",
	description: "Find a ManiaPlanet server by its login or name and show its current status.",

	execute: command => {
		if (command.arguments.length <= 0) {
			command.channel.send("Sorry <@" + command.user.id + ">, but you have to specify the server login or a search query. :rolling_eyes:");
			command.botGuild.log("Server login / search query not specified.");
			return;
		}

		const query = command.arguments.join(" ").toLowerCase();

		// Obtain information about the server.
		ManiaPlanet.serverInfo(query, response => {
			// Server not found.
			if (response.length <= 0) {
				command.channel.send("I was unable to find a server matching **" + command.galaxybot.escapeMentions(query) + "**, <@" + command.user.id + ">. It's offline, doesn't exist or I must've made some mistake...");
				command.botGuild.log("Server \"" + query + "\" not found.");
				return;
			}

			const serverInfo = response[0];
			const serverName = ManiaPlanet.stripFormatting(serverInfo.name);
			
			ManiaPlanet.title(serverInfo.title, titleInfo => {
				if (!titleInfo || titleInfo.code == 404) {
					command.channel.send("Sorry <@" + command.user.id + ">, but it looks like **" + command.galaxybot.escapeMentions(serverName) + "** is running in a private title pack.");
					command.botGuild.log("Title \"" + serverInfo.title + "\" not found.");
					return;
				}

				command.channel.send(ManiaPlanet.createServerEmbed(serverInfo, titleInfo));
				command.botGuild.log("Showing ManiaPlanet server information: " + serverName);
			});
		});
	}
}