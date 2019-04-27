const ManiaPlanet = require("./../integrations/ManiaPlanet.js");

module.exports = {
	name: "map",
	syntax: ["% <uid>"],
	group: "mp",
	description: "Shows information about the given map from the ManiaPlanet website.",

	execute: command => {
		// Map UID not specified.
		if (command.arguments.length <= 0) {
			command.channel.send(`Sorry ${command.user}, but you need to specify \`UID\` of the map you'd like to see information of.`);
			command.botGuild.log("No map UID specified.");
			return;
		}

		// Get the map UID.
		const mapUid = command.arguments[0];
		command.botGuild.log(`Downloading info about map ${mapUid}.`);

		// Download the map information.
		ManiaPlanet.map(mapUid, mapInfo => {
			// Map not found.
			if (!mapInfo || mapInfo.code == 404) {
				command.channel.send(`Sorry ${command.user}, I couldn't find any information about this map: **${mapUid}**. :cry:`)
				command.botGuild.log(`Map with UID ${mapUid} not found.`);
				return;
			}

			command.channel.send(ManiaPlanet.createMapEmbed(mapInfo));
			command.botGuild.log(`Successfully sent ${ManiaPlanet.stripFormatting(mapInfo.name)} info.`);
		});
	}
}