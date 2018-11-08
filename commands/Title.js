const ManiaPlanet = require("./../integrations/ManiaPlanet.js");

module.exports = {
	name: "title",
	description: "Shows information about the given title from the ManiaPlanet website.",

	execute: command => {
		// Title UID not specified.
		if (command.arguments.length <= 0) {
			command.channel.send(`Sorry ${command.user}, but you need to specify \`UID\` of the title you'd like to read about. Provide a valid \`UID\` in this command or search for a title by its name.`);
			command.botGuild.log("No title UID specified.");
			return;
		}

		// Get the title UID.
		const titleUid = ManiaPlanet.getTitleUid(command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions));
		command.botGuild.log(`Downloading "${titleUid}" title information.`);

		// Download the title information.
		ManiaPlanet.title(titleUid, titleInfo => {
			// Title not found.
			if (!titleInfo || titleInfo.code == 404) {
				command.channel.send(`Sorry ${command.user}, I can't recognize the **${titleUid}** title... :shrug:`);
				command.botGuild.log(`Title "${titleUid}" not found.`);
				return;
			}

			command.channel.send(ManiaPlanet.createTitleEmbed(titleInfo));
			command.botGuild.log(`Successfully sent ${ManiaPlanet.stripFormatting(titleInfo.name)} info.`);
		});
	}
}