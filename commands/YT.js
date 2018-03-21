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

		const query = command.arguments.join(" ");

		command.botGuild.searchYouTube(query, command.member).then(nbVideos => {
			// A playlist has been added.
			if (nbVideos > 0) {
				command.channel.send(`Okay ${command.user}, I'm adding **${nbVideos}** tracks from your playlist to the queue!`);
			}
		}).catch(error => {
			var errorMessage;

			switch (error) {
				// YouTube is unavailable.
				case "yt unavailable" :
					errorMessage = "I can't search for tracks in YouTube, API token is missing in my configuration file! :rolling_eyes:";
					break;

				// Incorrect query specified.
				case "bad query" :
					errorMessage = `First of all, you need to tell me what should I play, ${command.user}. :shrug:`;
					break;

				// YouTube is unavailable.
				case "no results" :
					errorMessage = `I couldn't find anything matching **${command.galaxybot.escapeMentions(query)}**, ${command.user}. :cry:`;
					break;
				
				// Unknown.
				default : errorMessage = "An error has occured while I was searching on YouTube. If the problem persists, please contact my creator!";
			}

			command.channel.send(errorMessage);
			command.botGuild.log("Error occured while searching in YouTube: " + error);
		});
	}
}