const Track = require("./../structures/Track.js");
const youtubedl = require("youtube-dl");

module.exports = {
	name: "sc",
	description: "Search for a SoundCloud track and add it to the music player queue.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// Music player not running and user is not in a voice channel.
		if (!command.botGuild.voiceConnection && !command.member.voiceChannel) {
			command.channel.send(`You need join a voice channel before I can start playing anything, ${command.user}. :loud_sound:`);
			command.botGuild.log("User not in any voice channel.");
			return;
		}

		// User not in our voice channel.
		if (command.botGuild.voiceConnection && command.member.voiceChannel != command.botGuild.voiceConnection.channel && !command.botGuild.isGalaxyBotManager(command.member)) {
			command.channel.send(`You need to join my voice channel if you want to request something, ${command.user}. :point_up:`);
			command.botGuild.log("User not in voice channel with bot.");
			return;
		}

		// Queue has reached the limit.
		const maxQueueLength = !isNaN(command.galaxybot.config.maxqueue) ? command.galaxybot.config.maxqueue : 0;

		if (maxQueueLength > 0 && command.botGuild.tracksQueue.length >= maxQueueLength) {
			command.channel.send(`Sorry ${command.user}, but it looks like the music player queue has reached the **${maxQueueLength}** requests limit. :outbox_tray:`);
			command.botGuild.log(`Music player queue full (${maxQueueLength}).`);
			return;
		}

		const query = command.arguments.join(" ");

		// Query is too short.
		if (query.length <= 0) {
			command.channel.send(`First of all, you need to tell me what should I play, ${command.user}. :shrug:`);
			command.botGuild.log("No query specified.");
			return;
		}

		// Search for a track in SoundCloud.
		var url = "scsearch:" + query;
		var track = new Track(url, command.member, track => {
			command.botGuild.onTrackCreated(track, command.member, url);
		});
	}
}