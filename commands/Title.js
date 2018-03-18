const ManiaPlanet = require("./../integrations/ManiaPlanet.js");

module.exports = {
	name: "title",
	description: "Shows information about the given title from the ManiaPlanet website.",

	execute: command => {
		// Title UID not specified.
		if (command.arguments.length <= 0) {
			command.channel.send("Sorry <@" + command.user.id + ">, but you need to specify `UID` of the title you'd like to read about. Provide a valid `UID` in this command or use one of these short codes: " + ManiaPlanet.getTitleCodes().join(", ") + ".");
			command.botGuild.log("No title UID specified.");
			return;
		}

		// Get the title UID.
		const titleUid = ManiaPlanet.getTitleUid(command.arguments[0]);

		command.botGuild.log("Downloading title info: " + titleUid);

		// Download the title information.
		ManiaPlanet.title(titleUid, titleInfo => {
			// Title not found.
			if (!titleInfo || titleInfo.code == 404) {
				command.channel.send("Sorry <@" + command.user.id + "> I can't recognize the **" + titleUid + "** title... :shrug:");
				command.botGuild.log("Title not found: " + titleUid);
				return;
			}

			command.channel.send(ManiaPlanet.createTitleEmbed(titleInfo));
			command.botGuild.log("Successfully sent title info: " + ManiaPlanet.stripFormatting(titleInfo.name));
		});
	}
}