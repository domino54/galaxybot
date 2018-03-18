module.exports = {
	name: "pause",
	description: "Pauses the current track playback. The same command will resume the playback.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// No permissions.
		if (!command.botGuild.isGalaxyBotManager(command.member)) {
			command.channel.send("Sorry <@" + command.user.id + ">, but you don't have permissions to pause/resume the music player. :point_up:");
			command.botGuild.log("No permissions to pause/resume music player.");
			return;
		}

		// Nothing is being played.
		if (!command.botGuild.voiceDispatcher) {
			command.channel.send("Looks like I'm not playing anything right now, <@" + command.user.id + ">. :shrug:");
			command.botGuild.log("Nothing is being played.");
			return;
		}

		// Resume
		if (command.botGuild.voiceDispatcher.paused) {
			command.channel.send("Aaaand... back to the business. :arrow_forward:");
			command.botGuild.log("Music player resumed.");
			command.botGuild.voiceDispatcher.resume();
		}

		// Pause
		else {
			command.channel.send("We're taking a little break! :pause_button:");
			command.botGuild.log("Music player paused.");
			command.botGuild.voiceDispatcher.pause();
		}
	}
}