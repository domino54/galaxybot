const Discord = require("discord.js");
const ManiaPlanet = require("./../integrations/ManiaPlanet.js");
const ServerBrowser = require("./../structures/ServerBrowser.js");

module.exports = {
	name: "servers",
	description: "Listing up to 10 most populated servers of a specific ManiaPlanet title. By adding `page`, you can navigate through the list.",

	execute: command => {
		// Title UID not specified.
		if (command.arguments.length <= 0) {
			command.channel.send(`Sorry ${command.user}, but you need to specify \`UID\` of the title you'd like to read about. Provide a valid \`UID\` in this command or search for a title by its name.`);
			command.botGuild.log("No title UID specified.");
			return;
		}

		// Get the title UID.
		const titleUid = ManiaPlanet.getTitleUid(command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions));

		// Results page.
		var pageNb = 1;
		if (!isNaN(command.arguments[1]) && command.arguments[1] > 1) pageNb = command.arguments[1];
		
		// Create a new server browser.
		new ServerBrowser(titleUid, pageNb, command.botGuild, command.message, command.galaxybot);
	}
}