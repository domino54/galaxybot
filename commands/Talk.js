module.exports = {
	name: "talk",
	description: "Talk as the GalaxyBot. For GalaxyBot creator only.",
	hidden: true,

	execute: command => {
		// Access denied.
		if (command.user.id != command.galaxybot.config.dommy) return;

		// No channel specified.
		if (command.galaxybot.talkChannel === undefined) {
			command.channel.send("Sorry <@" + command.user.id + ">, but you forgot to set the channel used to talk as me.");
			command.botGuild.log("Talk channel not set.");
			return;
		}

		command.galaxybot.talkChannel.send(command.arguments.join(" "));
	}
}