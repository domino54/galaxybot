const Discord = require("discord.js");
const ManiaPlanet = require("./../integrations/ManiaPlanet.js");
const ServerBrowser = require("./../structures/ServerBrowser.js");

module.exports = {
	name: "servers",
	description: "Listing up to 10 most populated servers of a specific ManiaPlanet title. By adding `page`, you can navigate through the list.",

	execute: command => {
		// Title UID not specified.
		if (command.arguments.length <= 0) {
			command.channel.send(`Sorry ${command.user}, but you need to specify the \`UID\` of a title you want to see servers of. Provide a valid \`UID\` in this command or use one of these short codes: ${ManiaPlanet.getTitleCodes().join(", ")}.`);
			command.botGuild.log("No title UID specified.");
			return;
		}

		// Get the title UID.
		const titleUid = ManiaPlanet.getTitleUid(command.arguments[0]);

		// Results page.
		var pageNb = 1;
		if (!isNaN(command.arguments[1]) && command.arguments[1] > 1) pageNb = command.arguments[1];
		
		// Create a new server browser.
		new ServerBrowser(titleUid, pageNb, command.botGuild, command.message, command.galaxybot);
	}
}