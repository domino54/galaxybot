const Track = require("./../structures/Track.js");
const URL = require("url");
const youtubedl = require("youtube-dl");

module.exports = {
	name: "play",
	description: "Connects to a voice channel and plays audio from the given link. You can request videos from SoundCloud, Mixcloud, YouTube, Vimeo, Dailymotion, Facebook and Streamable, send direct link to a file or a YouTube playlist (up to 100 videos). If an invalid URL is given, GalaxyBot will search the phrase in YouTube and play the first playable result. `now` and `next` allow GalaxyBot managers to play the track instantly or insert it at the beginning of the queue. If an audio file is attached to the message, GalaxyBot will attempt to play it.",
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
					command.botGuild.onTrackCreated(track, command.member, attachmentURL, { next: isNext, now: isNow });
				});
			}

			// Invalid attachments.
			else {
				command.channel.send(`I can't play any of the files you just sent me, ${command.user}. :cry:`);
				command.botGuild.log("No compatible audio attachments sent with command.");
				return;
			}

			return;
		}

		// URL not specified
		if (command.arguments.length <= 0) {
			command.channel.send(`First of all, you need to tell me what should I play, ${command.user}. :shrug:`);
			command.botGuild.log("No query specified.");
			return;
		}

		// Create a new track object for the speicifed URL.
		const query = command.arguments.join(" ");
		const url = command.arguments[0].replace(/<|>/g, "");
		const ytlist = query.match(/^https?:\/\/(www\.)?(youtu\.be|youtube\.com)\/playlist\?list=[\w-]+/g);

		command.botGuild.log(`Track requested by ${command.user.tag}: "${query}"`);

		// Try to load track from a local file.
		if (query.match(/^[A-Z]:(\/|\\)/)) {
			// Unauthorized.
			if (command.member.id != command.galaxybot.config.dommy) {
				command.channel.send(`Sorry ${command.user}, but only my creator is allowed to play music from the server storage. :no_entry:`);
				command.botGuild.log("Not authorized to use server resources.");
				return;
			}

			var track = new Track(query, command.member, track => {
				command.botGuild.onTrackCreated(track, command.member, query);
			});
		}

		// Load YouTube playlist.
		else if (ytlist) {
			let pendingRequests = command.botGuild.hasPendingPlaylist(command.member);

			// User already has a playlist being added.
			if (pendingRequests > 0) {
				command.channel.send(`I'm already processing a playlist sent by you, ${command.user}. Please wait until I'm done with **${pendingRequests}** remaining requests, or use the \`undo\` command!`);
				command.botGuild.log(`Already processing playlist requested by ${command.user.tag}.`);
				return;
			}

			const playlistURL = ytlist[0];
			const playlistID = playlistURL.match(/[\w-]+$/)[0];
			
			command.botGuild.addPlaylistYouTube(playlistID, command.member).then(nbVideos => {
				if (nbVideos > 0) {
					command.channel.send(`Okay ${command.user}, I'm adding **${nbVideos}** videos from your playlist to the queue!`);
				}
			}).catch(error => {
				var errorMessage;

				switch (error) {
					// YouTube is unavailable.
					case "yt unavailable" :
						errorMessage = "I add YouTube playlists, API token is missing in my configuration file! :rolling_eyes:";
						break;

					// Unknown.
					default : errorMessage = "An error has occured while I was adding a YouTube playlist. If the problem persists, please contact my creator!";
				}

				command.channel.send(errorMessage);
				command.botGuild.log("Error occured while adding YouTube playlist: " + error);
			});
		}

		// Try to load track from given URL.
		else if (URL.parse(url).hostname) {
			const isNow = command.arguments[1] === "now";
			const isNext = isNow || command.arguments[1] === "next";

			var track = new Track(url, command.member, track => {
				command.botGuild.onTrackCreated(track, command.member, url, { next: isNext, now: isNow });
			});
		}

		// Search for the track in YouTube.
		else {
			command.botGuild.searchYouTube(query, command.member).then(nbVideos => {
				// A playlist has been added.
				if (nbVideos > 0) {
					command.channel.send(`Okay ${command.user}, I'm adding **${nbVideos}** videos from your playlist to the queue!`);
				}
			}).catch(error => {
				var errorMessage;

				switch (error) {
					// YouTube is unavailable.
					case "yt unavailable" :
						errorMessage = "I can't search for videos and playlists in YouTube, API token is missing in my configuration file! :rolling_eyes:";
						break;

					// Incorrect query specified.
					case "bad query" :
						errorMessage = `First of all, you need to tell me what should I play, ${command.user}. :shrug:`;
						break;

					// YouTube is unavailable.
					case "no results" :
						errorMessage = `I couldn't find anything matching **${command.galaxybot.escapeMentions(query, command.message)}**, ${command.user}. :cry:`;
						break;

					// User already has a pending playlist.
					case "pending playlist" : {
						let pendingRequests = command.botGuild.hasPendingPlaylist(command.member);
						errorMessage = `I'm already processing a playlist sent by you, ${command.user}. Please wait until I'm done with **${pendingRequests}** remaining requests, or use the \`undo\` command!`;
						break;
					}
					
					// Unknown.
					default : errorMessage = `An error has occured while I was searching on YouTube. If the problem persists, please contact my creator!\n\`\`\`${error}\`\`\``;
				}

				command.channel.send(errorMessage);
				command.botGuild.log("Error occured while searching in YouTube: " + error);
			});
		}
	}
}