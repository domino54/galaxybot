const Track = require("./../structures/Track.js");

module.exports = {
	name: "now",
	description: "Shows what is currently being played.",
	serverOnly: true,
	musicPlayer: true,

	execute: command => {
		// Nothing is being played right now.
		if (!command.botGuild.currentTrack) {
			command.channel.send("I'm not playing anything right now. Will you make a step to change that, <@" + command.user.id + ">? :smirk:");
			command.botGuild.log("Nothing played in the guild.");
			return;
		}
		
		// Show the track listening progress.
		if (!command.botGuild.currentTrack.isLivestream) {
			const current = Track.timeToText(parseInt(command.botGuild.voiceDispatcher.time / 1000));
			const total = Track.timeToText(command.botGuild.currentTrack.duration);

			command.botGuild.currentTrack.embed.description = current + " / " + total;
		}

		command.botGuild.lastTextChannel.send("Now playing:", command.botGuild.currentTrack.embed);
		command.botGuild.log("Guild is playing: " + command.botGuild.currentTrack.title);
	}
}