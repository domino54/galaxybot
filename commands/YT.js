module.exports = {
	name: "yt",
	description: "Search for a YouTube video or playlist and add it to the music player queue.",
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

		command.channel.startTyping();
		command.botGuild.searchYouTube(query, command.member).then(nbVideos => {
			command.channel.stopTyping();

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
					errorMessage = `I couldn't find anything matching **${command.galaxybot.escapeMentions(query, command.message.mentions)}**, ${command.user}. :cry:`;
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
			command.channel.stopTyping();
		});
	}
}