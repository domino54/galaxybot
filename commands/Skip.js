module.exports = {
	name: "skip",
	description: "Skips the currently played song. GalaxyBot managers can skip any song, while other users may skip it only if it's been requested by them.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// Not playing anything in the server.
		if (!command.botGuild.currentTrack) {
			command.channel.send("Nothing is being played right now, <@" + command.user.id + ">. :shrug:");
			command.botGuild.log("Can't skip, nothing is being played.");
			return;
		}

		// No permission to skip track of someone else.
		if (!command.gotGuild.isGalaxyBotManager(command.member) && command.user.id != command.botGuild.currentTrack.sender) {
			command.channel.send("You are not permitted to skip tracks requested by other users, <@" + command.user.id + ">. :no_good:");
			command.botGuild.log("No permission to skip current track.");
			return;
		}

		command.channel.send("Allright <@" + command.user.id + ">, skipping the current track! :thumbsup:");
		command.botGuild.log("Current track skipped through command: " + command.botGuild.currentTrack.title);

		if (command.botGuild.voiceDispatcher) command.botGuild.voiceDispatcher.end();
	}
}