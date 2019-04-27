module.exports = {
	name: "queue",
	syntax: ["% [page]", "% me"],
	group: "music",
	description: "Lists up to 10 upcoming entries in the music player queue. Specify `page` to browse a certain page of the queue. `me` can be used to list your upcoming requests.",
	serverOnly: true,
	musicPlayer: true,

	execute: command => {
		// The tracks queue is completely empty.
		if (command.botGuild.tracksQueue.length <= 0) {
			command.channel.send(`The music player queue is empty. Will you make a step to change that, ${command.user}? :smirk:`);
			command.botGuild.log("Music player queue empty.");
			return;
		}

		// Show upcoming tracks requested by the user.
		if (command.arguments[0] === "me") {
			var upcomingTracks = [];

			for (const track of command.botGuild.tracksQueue) {
				if (track.senderId == command.user.id) upcomingTracks.push(track);
			}

			command.botGuild.log(`${command.user.tag} has ${upcomingTracks.length} music player requests.`);

			switch (upcomingTracks.length) {
				// No tracks requested by the user.
				case 0 :
					command.channel.send(`Looks like you don't have any upcoming requests, ${command.user}.`);
					break;

				// Only one track requested by the user.
				case 1 :
					command.channel.send(`You have one upcoming ${upcomingTracks[0].type}, ${command.user}:`, upcomingTracks[0].embed);
					break;

				// Create the tracks list.
				default : {
					var tracksList = [];

					for (const track of upcomingTracks) {
						if (tracksList.length >= 10) break;
						const position = command.botGuild.tracksQueue.indexOf(track) + 1;
						tracksList.push(`${position}. ${track.title}`);
					}

					command.channel.send(`You have **${upcomingTracks.length}** requests waiting in the queue, ${command.user}: \n\`\`\`${tracksList.join("\n")}\`\`\``);
				}
			}

			return;
		}

		// Show tracks requested by everyone.
		command.botGuild.log(`${command.botGuild.tracksQueue.length} tracks in queue.`);

		// Only one track in the queue.
		if (command.botGuild.tracksQueue.length == 1) {
			command.channel.send("Up next:", command.botGuild.tracksQueue[0].embed);
		}

		else {
			const pageArg = parseInt(command.arguments[0]);
			const page = !isNaN(pageArg) && pageArg > 1 ? pageArg : 1;
			const nbPages = Math.floor((command.botGuild.tracksQueue.length - 1) / 10) + 1;
			const offset = (page - 1) * 10;

			// Queue is not that long
			if (offset > command.botGuild.tracksQueue.length) {
				command.channel.send(`The music player queue is only **${command.botGuild.tracksQueue.length}** requests long, ${command.user}. :shrug:`);
				command.botGuild.log("Given order exceeds the music player queue length.");
				return;
			}

			var tracksList = [];

			for (var i = offset; i < command.botGuild.tracksQueue.length; i++) {
				if (tracksList.length >= 10) break;
				const track = command.botGuild.tracksQueue[i];
				tracksList.push(`${i + 1}. ${track.title} (requested by ${track.sender.displayName})`);
			}

			command.channel.send(`There are **${command.botGuild.tracksQueue.length}** requests in the queue: \n\`\`\`${tracksList.join("\n")}\`\`\` Page ${page} of ${nbPages}`);
		}
	}
}