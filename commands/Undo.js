module.exports = {
	name: "undo",
	description: "Removes the latest track you've requested.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// The tracks queue is completely empty.
		if (command.botGuild.tracksQueue.length <= 0) {
			command.channel.send("The tracks queue is empty, <@" + command.user.id + ">. :thinking:");
			command.botGuild.log("Tracks queue empty.");
			return;
		}

		// Get the latest track queued by user.
		var trackToRemove;

		for (var i = guild.tracksQueue.length - 1; i >= 0; i--) {
			var track = guild.tracksQueue[i];

			if (track.sender.id == command.user.id) {
				trackToRemove = track;
				break;
			}
		}

		// No tracks requested by the user.
		if (!trackToRemove) {
			message.channel.send("Looks like there are no tracks requested by you, <@" + command.user.id + ">. :shrug:");
			command.botGuild.log("No tracks requested by " + command.user.tag);
			return;
		}

		message.channel.send("I removed your latest request, <@" + message.member.id + ">: **" + trackToRemove.title + "**.");
		command.botGuild.tracksQueue.splice(command.botGuild.tracksQueue.indexOf(trackToRemove), 1);
		command.botGuild.log("Track removed from queue: " + trackToRemove.title);
	}
}