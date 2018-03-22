module.exports = {
	name: "next",
	description: "Shows details of the next request in the queue. `me` shows your first upcoming request. `order` can tell which request is at specific position in the queue.",
	serverOnly: true,
	musicPlayer: true,

	execute: command => {
		// The tracks queue is completely empty.
		if (command.botGuild.tracksQueue.length <= 0) {
			command.channel.send(`The music player queue is empty. Will you make a step to change that, ${command.user}? :smirk:`);
			command.botGuild.log("Music player queue empty.");
			return;
		}

		// Get next track requested by the user.
		if (command.arguments[0] == "me") {
			for (const track of command.botGuild.tracksQueue) {
				if (track.sender.id != command.member.id) continue;
				const position = command.botGuild.tracksQueue.indexOf(track) + 1;

				command.channel.send(`Your next ${track.type} is **#${position}** in the queue, ${command.user}:`, track.embed);
				command.botGuild.log(`Showing next ${track.type} requested by ${command.user.tag}.`);
				return;
			}

			command.channel.send(`Looks like you don't have any upcoming requests, ${command.user}. :shrug:`);
			command.botGuild.log(`No upcoming requests by ${command.user.tag}.`);
			return;
		}


		// Get the order of the queued track to get.
		const orderArg = parseInt(command.arguments[0]);
		const trackOrder = orderArg > 1 ? orderArg - 1 : 0;
		
		// Queue is not that long
		if (!command.botGuild.tracksQueue[trackOrder]) {
			command.channel.send(`The music player is only **${command.botGuild.tracksQueue.length}** request${command.botGuild.tracksQueue.length > 1 ? "s" : ""} long. :shrug:`);
			command.botGuild.log("Given order exceeds the music player queue.");
			return;
		}

		var header = trackOrder > 0 ? `**#${trackOrder + 1}** in the queue:` : "Up next:";

		command.channel.send(header, command.botGuild.tracksQueue[trackOrder].embed);
		command.botGuild.log(`Showing #${trackOrder + 1} in the music player queue.`);
	}
}