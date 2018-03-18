module.exports = {
	name: "next",
	description: "Shows details of the next track in the queue. `me` shows upcoming song requested by you. `order` can tell which track is at specific position in the queue.",
	serverOnly: true,
	musicPlayer: true,

	execute: command => {
		// The tracks queue is completely empty.
		if (command.botGuild.tracksQueue.length <= 0) {
			command.channel.send("The tracks queue is empty. Will you make a step to change that, <@" + command.user.id + ">? :smirk:");
			command.botGuild.log("Tracks queue empty.");
			return;
		}

		// Get the order of the queued track to get.
		var trackOrder = 0;

		if (command.arguments[0]) {
			// Get next track requested by the user.
			if (command.arguments[0] == "me") {
				for (const track of command.botGuild.tracksQueue) {
					if (track.sender.id != command.member.id) continue;

					command.channel.send("Your next track is **#" + (i + 1) + "** in the queue, <@" + command.user.id + ">:", track.embed);
					command.botGuild.log("Showing next track requested by " + command.user.tag);
					return;
				}

				command.channel.send("Looks like there are no upcoming tracks requested by you, <@" + command.user.id + ">. :shrug:");
				command.botGuild.log("No upcoming tracks requested by " + command.user.tag);
				return;
			}

			else trackOrder = parseInt(command.arguments[0]) - 1;
		}

		// Invalid order.
		if (trackOrder < 0) {
			command.channel.send("Aren't you supposed to enter a number greater or equal to 1, <@" + command.user.id + ">? :face_palm:");
			command.botGuild.log("Invalid track order given.");
			return;
		}

		// Queue is not that long
		if (!command.botGuild.tracksQueue[trackOrder]) {
			command.channel.send("The tracks queue is only **" + command.botGuild.tracksQueue.length + "** track" + (command.botGuild.tracksQueue.length > 1 ? "s" : "") + " long. :shrug:");
			command.botGuild.log("Given order exceeds the tracks queue.");
			return;
		}

		var header = trackOrder > 0 ? "**#" + (trackOrder + 1) + "** in the queue:" : "Up next:";

		command.channel.send(header, command.botGuild.tracksQueue[trackOrder].embed);
		command.botGuild.log("Showing #" + (trackOrder + 1) + " in the tracks queue.");
	}
}