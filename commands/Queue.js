module.exports = {
	name: "queue",
	description: "Lists up to 10 upcoming entries in the music player queue. `me` can be used to list upcoming tracks requested by you.",
	serverOnly: true,
	musicPlayer: true,

	execute: command => {
		// The tracks queue is completely empty.
		if (command.botGuild.tracksQueue.length <= 0) {
			command.channel.send(`The tracks queue is empty. Will you make a step to change that, ${command.user}? :smirk:`);
			command.botGuild.log("Tracks queue empty.");
			return;
		}

		// Show upcoming tracks requested by the user.
		if (command.arguments[0] === "me") {
			var upcomingTracks = [];

			for (const track of command.botGuild.tracksQueue) {
				if (track.senderId == command.user.id) upcomingTracks.push(track);
			}

			command.botGuild.log(`${command.user.tag} has ${upcomingTracks.length} track requests.`);

			switch (upcomingTracks.length) {
				// No tracks requested by the user.
				case 0 :
					command.channel.send(`Looks like there are no upcoming tracks requested by you, ${command.user}.`);
					break;

				// Only one track requested by the user.
				case 1 :
					command.channel.send(`You have one upcoming track, ${command.user}:`, upcomingTracks[0].embed);
					break;

				// Create the tracks list.
				default : {
					var tracksList = [];

					for (const track of upcomingTracks) {
						if (tracksList.length >= 10) break;
						const position = command.botGuild.tracksQueue.indexOf(track) + 1;
						tracksList.push(`${position}. ${track.title}`);
					}

					command.channel.send(`You have **${upcomingTracks.length}** tracks waiting in the queue, ${command.user}: \n\`\`\`${tracksList.join("\n")}\`\`\``);
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
			const offset = (page - 1) * 10;

			// Queue is not that long
			if (offset > command.botGuild.tracksQueue.length) {
				command.channel.send(`The tracks queue is only **${command.botGuild.tracksQueue.length}** tracks long, ${command.user}. :shrug:`);
				command.botGuild.log("Given order exceeds the tracks queue length.");
				return;
			}

			var tracksList = [];

			for (var i = offset; i < command.botGuild.tracksQueue.length; i++) {
				if (tracksList.length >= 10) break;
				const track = command.botGuild.tracksQueue[i];
				tracksList.push(`${i + 1}. ${track.title} (requested by ${track.sender.displayName})`);
			}

			command.channel.send(`There are **${command.botGuild.tracksQueue.length}** tracks in the queue: \n\`\`\`${tracksList.join("\n")}\`\`\``);
		}
	}
}