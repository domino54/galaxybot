const ManiaExchange = require("./../integrations/ManiaExchange.js");

module.exports = {
	name: "mx",
	description: "Search for a Mania Exchange map by its ID or the map name.",

	execute: command => {
		// Which Mania Exchange site?
		if (command.arguments.length <= 0) {
			command.channel.send("<@" + command.user.id + ">, you have to tell me which site of Mania Exchange you want me to search through: `sm` or `tm`. :point_up:");
			command.botGuild.log("No Mania Exchange site specified.");
			return;
		}

		const site = command.arguments[0].toLowerCase();
		
		// Unknown Mania Exchange site.
		if (!site.match(/^(sm|tm)$/)) {
			command.channel.send("Sorry <@" + command.user.id + ">, but we only have the ShootMania `sm` and TrackMania `tm` sites on Mania Exchange. :shrug:");
			command.botGuild.log("Unknown Mania Exchange site: " + site);
			return;
		}

		// No UID or a search query specified.
		if (command.arguments.length < 2) {
			command.channel.send("<@" + command.user.id + ">, would be really nice if you told me the map's `mxid` or search for a map name. :shrug:");
			command.botGuild.log("No MXID or search query specified.");
			return;
		}

		const mxid = parseInt(command.arguments[1]);

		// A function to show the results.
		function showMapInfo(mapInfo) {
			command.channel.send(ManiaExchange.createMapEmbed(mapInfo));
			command.botGuild.log("Successfully sent Mania Exchange map info: " + mapInfo.Name);
		}

		// Get map by its MXID.
		if (command.arguments.length == 2 && mxid > 0) {
			command.botGuild.log("Searching for mxid " + mxid + " in " + site + " Mania Exchange.");

			ManiaExchange.maps(site, [mxid], mapInfo => {
				// MXID not found.
				if (!mapInfo || mapInfo.length <= 0) {
					command.channel.send("Sorry <@" + command.user.id + ">, but I couldn't find a map with id **" + mxid + "** on Mania Exchange. :cry:");
					command.botGuild.log("Mania Exchange map not found: " + site + " " + mxid);
					return;
				}

				showMapInfo(mapInfo[0]);
			});
		}

		// Search for a map.
		else {
			command.arguments.shift();
			const mapName = command.galaxybot.escapeMentions(command.arguments.join(" "));

			command.botGuild.log("Searching for \"" + mapName + "\" in " + site + " Mania Exchange.");

			ManiaExchange.search(site, { trackname: mapName, limit: 1 }, mapsInfo => {
				// No results.
				if (!mapsInfo || !mapsInfo.results || mapsInfo.results.length <= 0) {
					message.channel.send("Sorry <@" + command.user.id + ", but I couldn't find any map called **" + mapName + "** on Mania Exchange. :cry:");
					guild.log("No Mania Exchange results found for \"" + mapName + "\"");
					return;
				}

				showMapInfo(mapsInfo.results[0]);
			});
		}
	}
}