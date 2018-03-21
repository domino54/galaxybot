module.exports = {
	name: "skip",
	description: "Skips the currently played song. GalaxyBot managers can skip any song, while other users may skip it only if it's been requested by them.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// Not playing anything in the server.
		if (!command.botGuild.voiceConnection) {
			command.channel.send(`Nothing is being played right now, ${command.user}. :shrug:`);
			command.botGuild.log("Can't skip, nothing is being played.");
			return;
		}

		// No permission to skip track of someone else.
		if (!command.botGuild.isGalaxyBotManager(command.member) && command.user.id != command.botGuild.currentTrack.senderId) {
			command.channel.send(`Sorry ${command.user}, you can only skip the current track if it's been requested by you. :point_up:`);
			command.botGuild.log("No permission to skip current track.");
			return;
		}

		command.channel.send(`Allright ${command.user}, skipping the current track! :thumbsup:`);
		command.botGuild.log(`Track "${command.botGuild.currentTrack.title}" skipped via command.`);

		if (command.botGuild.voiceDispatcher) command.botGuild.voiceDispatcher.end();
	}
}