const Track = require("./../structures/Track.js");
const yt_search = require("youtube-search");
const URL = require("url");

module.exports = {
	name: "play",
	description: "Connects to a voice channel and plays audio from the given link. If an invalid URL is given, GalaxyBot will search the phrase in YouTube and play the first playable result. `now` and `next` allow GalaxyBot managers to play the track instantly or insert it at the beginning of the queue. If an audio file is attached to the message, GalaxyBot will attempt to play it.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// Music player not running and user is not in a voice channel.
		if (!command.botGuild.voiceConnection && !command.member.voiceChannel) {
			command.channel.send("You need join a voice channel before I can start playing anything, <@" + command.user.id + ">. :loud_sound:");
			command.botGuild.log("User not in any voice channel.");
			return;
		}

		// User not in our voice channel.
		if (command.botGuild.voiceConnection && command.member.voiceChannel != command.botGuild.voiceConnection.channel && !command.botGuild.isGalaxyBotManager(command.member)) {
			command.channel.send("You need to join my voice channel if you want to request something, <@" + command.user.id + ">. :point_up:");
			command.botGuild.log("User not in voice channel with bot.");
			return;
		}

		// Try to play the message attachment.
		if (command.message.attachments.size > 0) {
			var attachmentURL;

			command.message.attachments.forEach((attachment, snowflake) => {
				if (attachmentURL) return;

				// Look for audio files.
				if (!attachment.filename.match(/\.(mp3|ogg|wav|flac|m4a|aac|webm)$/i)) return;

				attachmentURL = attachment.proxyURL;
			});

			// Create track of the attachment.
			if (attachmentURL) {
				const isNow = command.arguments[0] === "now";
				const isNext = isNow || command.arguments[0] === "next";

				var track = new Track(attachmentURL, command.member, track => {
					command.botGuild.onTrackCreated(track, command.member, attachmentURL, isNext, isNow);
				});
			}

			// Invalid attachments.
			else {
				command.channel.send("I can't play any of the files you just sent me, <@" + command.user.id + ">. :cry:");
				command.botGuild.log("No compatible audio attachments sent with command.");
				return;
			}

			return;
		}

		// URL not specified
		if (command.arguments.length <= 0) {
			command.channel.send("First of all, you need to tell me what should I play, <@" + command.user.id + ">. :shrug:");
			command.botGuild.log("No query specified.");
			return;
		}

		// Create a new track object for the speicifed URL.
		var query = command.arguments.join(" ");
		var url = command.arguments[0].replace(/<|>/g, "");

		command.botGuild.log("Track requested by " + command.user.tag + ": " + query);

		// Try to load track from a local file.
		if (query.match(/^[A-Z]:(\/|\\)/)) {
			// Unauthorized.
			if (command.member.id != command.galaxybot.config.dommy) {
				command.channel.send("Sorry <@" + command.user.id + ">, but only my creator is allowed to play music from the server storage. :no_entry:");
				command.botGuild.log("Not authorized to use server resources.");
				return;
			}

			var track = new Track(query, command.member, track => {
				command.botGuild.onTrackCreated(track, command.member, query);
			});
		}

		// Try to load track from given URL.
		else if (URL.parse(url).hostname) {
			const isNow = command.arguments[1] === "now";
			const isNext = isNow || command.arguments[1] === "next";

			var track = new Track(url, command.member, track => {
				command.botGuild.onTrackCreated(track, command.member, url, isNext, isNow);
			});
		}

		// Can't search in YouTube: API token not provided.
		else if (!command.galaxybot.config.youtube || !command.galaxybot.config.youtube.token) {
			command.channel.send("I can't search for tracks in YouTube, API token is missing in my configuration file! :rolling_eyes:");
			command.botGuild.log("Wrong YouTube configuration: token not specified.");
		}

		// Search for the track in YouTube.
		else {
			var options = {
				maxResults: 10,
				key: command.galaxybot.config.youtube.token
			};

			yt_search(query, options, (error, results) => {
				if (error) return console.log(error);
				if (results.length > 0) {
				 	var track = new Track(results[0].link, command.member, track => {
						command.botGuild.onTrackCreated(track, command.member, url);
					});
				}
			});
		}
	}
}