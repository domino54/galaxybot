const Discord = require("discord.js");
const ManiaPlanet = require("./../integrations/ManiaPlanet.js");

module.exports = {
	name: "servers",
	description: "Listing up to 10 most populated servers of a specific ManiaPlanet title. By adding `page`, you can navigate through the list.",

	execute: command => {
		// Title UID not specified.
		if (command.arguments.length <= 0) {
			command.channel.send("Sorry <@" + command.user.id + ">, but you need to specify the `UID` of a title you want to see servers of. Provide a valid `UID` in this command or use one of these short codes: " + ManiaPlanet.getTitleCodes().join(", ") + ".");
			command.botGuild.log("No title UID specified.");
			return;
		}

		// Get the title UID.
		const titleUid = ManiaPlanet.getTitleUid(command.arguments[0]);

		// Results page.
		var pageNb = 1;
		if (!isNaN(command.arguments[1]) && command.arguments[1] > 1) pageNb = command.arguments[1];
		const offset = (pageNb - 1) * 10;
		
		command.botGuild.log("Downloading title info: " + titleUid);

		// Download the title information.
		ManiaPlanet.title(titleUid, titleInfo => {
			// Title not found.
			if (!titleInfo || titleInfo.code == 404) {
				command.channel.send("Sorry, I can't recognize the **" + titleUid + "** title... :shrug:");
				command.botGuild.log("Title not found: " + titleUid);
				return;
			}

			const titleName = ManiaPlanet.stripFormatting(titleInfo.name);
			command.botGuild.log("Obtained title infomation: " + titleName);

			// Download the servers list.
			ManiaPlanet.servers({"titleUids[]": titleUid, length: 11, offset: offset }, serversInfos => {
				// No servers were found.
				if (serversInfos.length <= 0) {
					if (pageNb <= 1) {
						command.channel.send("Looks like there are no servers online in **" + titleInfo.name + "** right now. :rolling_eyes:");
					} else {
						command.channel.send("**" + titleInfo.name + "** doesn't have this many servers. :thinking:");
					}

					command.botGuild.log("No servers found in title: " + titleName);
					return;
				}

				command.botGuild.log("Found " + serversInfos.length + " servers in " + titleName);

				// Only one server online - show a fancy embed.
				if (serversInfos.length == 1) {
					const embed = ManiaPlanet.createServerEmbed(serversInfos[0], titleInfo);
					command.channel.send("There's only one server online in **" + titleInfo.name + "** right now.", embed);
					return;
				}

				// A function to format integer with leading zeroes.
				function formatInteger(integer, length) {
					var string = integer.toString();
					while (string.length < length) string = "0" + string;
					return string;
				}

				// List the found servers.
				var serversNodes = [];

				for (const serverInfo of serversInfos) {
					if (serversNodes.length >= 10) break;

					const order = formatInteger(serversNodes.length + 1 + (pageNb - 1) * 10, 2);
					const nbPlayers = formatInteger(serverInfo.player_count, 3);
					const nbPlayersMax = formatInteger(serverInfo.player_max, 3);

					serversNodes.push(order + ". " + nbPlayers + " / " + nbPlayersMax + " " + ManiaPlanet.stripFormatting(serverInfo.name));
				}

				// Send the message.
				command.channel.send(new Discord.RichEmbed({
					title: ManiaPlanet.stripFormatting(titleInfo.name),
					description: "```" + serversNodes.join("\n") + "```",
					color: ManiaPlanet.getTitleColor(titleInfo.primary_color),
					thumbnail: {
						url: titleInfo.card_url
					},
					footer: {
						text: "Page #" + pageNb
					}
				}));
			});
		});
	}
}