module.exports = {
	name: "queue",
	description: "Lists up to 10 upcoming entries in the music player queue. `me` can be used to list upcoming tracks requested by you.",
	serverOnly: true,
	musicPlayer: true,

	execute: command => {
		// The tracks queue is completely empty.
		if (command.botGuild.tracksQueue.length <= 0) {
			command.channel.send("The tracks queue is empty. Will you make a step to change that, <@" + command.user.id + ">? :smirk:");
			command.botGuild.log("Tracks queue empty.");
			return;
		}

		// Show upcoming tracks requested by the user.
		if (command.arguments[0] === "me") {
			var upcomingTracks = [];

			for (const track of command.botGuild.tracksQueue) {
				if (track.sender.id == command.user.id) upcomingTracks.push(track);
			}

			command.botGuild.log(upcomingTracks.length + " tracks in queue by " + command.user.tag);

			// No tracks requested by the user.
			if (upcomingTracks.length <= 0) {
				command.channel.send("Looks like there are no upcoming tracks requested by you, <@" + command.user.id + ">.");
			}

			// Only one track requested by the user.
			else if (upcomingTracks.length == 1) {
				command.channel.send("You have one upcoming track, <@" + command.user.id + ">:", upcomingTracks[0].embed);
			}

			else {
				var tracksList = [];

				for (const track of upcomingTracks) {
					if (tracksList.length >= 10) break;
					const position = command.botGuild.tracksQueue.indexOf(track) + 1;
					tracksList.push(position + ". " + track.title);
				}

				command.channel.send("There " + (upcomingTracks.length > 1 ? "are " + upcomingTracks.length + " tracks" : "is one track") + " requested by you, <@" + command.user.id + ">:\n```" + tracksList.join("\n") + "```");
			}
		}

		// Show tracks requested by everyone.
		else {
			command.botGuild.log(upcomingTracks.length + " tracks in queue.");

			// Only one track in the queue.
			if (upcomingTracks.length == 1) {
				command.channel.send("Up next:", command.botGuild.tracksQueue[0].embed);
			}

			else {
				var tracksList = [];

				for (const track of command.botGuild.tracksQueue) {
					if (tracksList.length >= 10) break;
					const position = command.botGuild.tracksQueue.indexOf(track) + 1;
					tracksList.push(position + ". " + track.title + "(requested by " + track.sender.displayName + ")");
				}

				command.channel.send("Up next:\n```" + tracksList.join("\n") + "```");
			}
		}
	}
}