module.exports = {
	name: "talk",
	description: "Talk as the GalaxyBot in previously set channel. For GalaxyBot creator only.",
	hidden: true,
	owner: true,

	execute: command => {
		// No channel specified.
		if (command.galaxybot.talkChannel === undefined) {
			command.channel.send(`Sorry ${command.user}, but you forgot to set the channel used to talk as me.`);
			command.botGuild.log("Talk channel not set.");
			return;
		}

		command.galaxybot.talkChannel.send(command.arguments.join(" "));
	}
}