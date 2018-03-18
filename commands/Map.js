const ManiaPlanet = require("./../integrations/ManiaPlanet.js");

module.exports = {
	name: "map",
	description: "Shows information about the given map from the ManiaPlanet website.",

	execute: command => {
		// Map UID not specified.
		if (command.arguments.length <= 0) {
			command.channel.send("Sorry <@" + command.user.id + ">, but you need to specify `UID` of the map you'd like to see information of.");
			command.botGuild.log("No map UID specified.");
			return;
		}

		// Get the map UID.
		const mapUid = command.arguments[0];

		command.botGuild.log("Downloading map info: " + mapUid);

		// Download the map information.
		ManiaPlanet.map(mapUid, mapInfo => {
			// Map not found.
			if (!mapInfo || mapInfo.code == 404) {
				command.channel.send("Sorry <@" + command.user.id + ">, I couldn't find any information about this map: **" + mapUid + "**. :cry:")
				command.botGuild.log("Map not found: " + mapUid);
				return;
			}

			command.channel.send(ManiaPlanet.createMapEmbed(mapInfo));
			command.botGuild.log("Successfully sent map info: " + ManiaPlanet.stripFormatting(mapInfo.name));
		});
	}
}