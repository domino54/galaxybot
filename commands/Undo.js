module.exports = {
	name: "undo",
	description: "Removes the latest track you've requested. Specify `quantity` to remove a certain number of tracks, or `all` to remove all your requests.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// The tracks queue is completely empty.
		if (command.botGuild.tracksQueue.length <= 0) {
			command.channel.send(`How can I remove your requests, ${command.user}, if the tracks queue is empty? :P`);
			command.botGuild.log("Tracks queue empty.");
			return;
		}

		// Clear all timers created by adding a playlist.
		var stoppedTimers = 0;

		for (const timer of command.botGuild.pendingTimers) {
			if (timer.senderID != command.user.id) continue;

			clearTimeout(timer);
			timer.stopped = true;
			stoppedTimers++
		}

		// We cleared some timers.
		if (stoppedTimers > 0) {
			command.botGuild.pendingTimers = command.botGuild.pendingTimers.filter(timer => !timer.stopped);
			command.botGuild.lastStop = Date.now();

			command.channel.send(`I stopped adding **${stoppedTimers}** playlist items you've requested, ${command.user}.`);
			command.botGuild.log(`Stopped adding ${stoppedTimers} items requested by ${command.user.tag}.`);
			return;
		}

		var tracksToRemove = [];

		// Remove all tracks requested by the user.
		if (command.arguments[0] === "all") {
			for (const track of command.botGuild.tracksQueue) {
				if (track.sender.id == command.user.id) tracksToRemove.push(track);
			}
		}

		// Remove one or more tracks.
		else {
			const quantityArg = parseInt(command.arguments[0]);
			const quantity = quantityArg > 1 ? quantityArg : 1;

			for (var i = command.botGuild.tracksQueue.length - 1; i >= 0; i--) {
				const track = command.botGuild.tracksQueue[i];

				if (track.sender.id == command.user.id) tracksToRemove.push(track);
				if (tracksToRemove.length >= quantity) break;
			}
		}

		switch (tracksToRemove.length) {
			// None of the tracks were removed.
			case 0 : {
				command.channel.send(`Looks like there are no requests sent by you, ${command.user}. :shrug:`);
				command.botGuild.log(`No tracks requested by ${command.user.tag}.`);
				break;
			}

			// Only one track got removed.
			case 1 : {
				const track = tracksToRemove[0];
				command.channel.send(`I removed your latest ${track.type}, ${command.user}: **${track.title}**.`);
				command.botGuild.log(`Removed ${track.type} from queue: "${track.title}".`);
				break;
			}

			// Multiple requests removed.
			default : {
				command.channel.send(`I removed your **${tracksToRemove.length}** most recent requests, ${command.user}.`);
				command.botGuild.log(`Removed ${tracksToRemove.length} items requested by ${command.user.tag}.`);
			}
		}

		// Remove tracks from the queue.
		for (const track of tracksToRemove) {
			const index = command.botGuild.tracksQueue.indexOf(track);
			command.botGuild.tracksQueue.splice(index, 1);
		}
	}
}