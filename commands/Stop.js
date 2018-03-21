module.exports = {
	name: "stop",
	description: "Allows GalaxyBot managers to stop music playback and clear the queue.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// No permission to stop music player.
		if (!command.botGuild.isGalaxyBotManager(command.member)) {
			const rolesList = command.botGuild.createRolesList();
			var rolesText = "";

			if (rolesList && rolesList.length > 0) {
				rolesText = " and members with one of following roles: " + rolesList.join(", ");
			}

			command.channel.send(`Sorry ${command.user}, but you can't stop the music playback. I can be stopped only by the server administrators${rolesText}. :point_up:`);
			command.botGuild.log("No permission to stop music player.");
			return;
		}

		// Nothing is being played.
		if (!command.botGuild.voiceConnection) {
			command.channel.send(`I'm not playing anything right now, ${command.user}. :shrug:`);
			command.botGuild.log("Music player is already stopped.");
			return;
		}

		command.channel.send(`Abort! Playback has been stopped and queue emptied, as requested by ${command.user}. :no_good:`);
		command.botGuild.log("Stopped music player on request.");

		// Clear the queue.
		command.botGuild.tracksQueue = [];
		command.botGuild.uniqueTracks = [];

		// Clear all timers created by adding a playlist.
		for (const timer of command.botGuild.pendingTimers) clearTimeout(timer);
		command.botGuild.pendingTimers = [];
		command.botGuild.lastStop = Date.now();

		if (command.botGuild.voiceDispatcher) command.botGuild.voiceDispatcher.end();
		if (command.botGuild.voiceConnection) command.botGuild.voiceConnection.disconnect();
	}
}