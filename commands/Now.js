const Track = require("./../structures/Track.js");
const Discord = require("discord.js");

module.exports = {
	name: "now",
	description: "Shows what is currently being played. Append `info` to see more detailed information.",
	serverOnly: true,
	musicPlayer: true,

	execute: command => {
		// Nothing is being played right now.
		if (!command.botGuild.currentTrack) {
			command.channel.send(`I'm not playing anything right now. Will you make a step to change that, ${command.user}? :smirk:`);
			command.botGuild.log("Nothing played in the guild.");
			return;
		}

		var embed = command.botGuild.currentTrack.embed;

		// Special, detailed embed.
		if (command.arguments[0] === "info") {
			embed.image = embed.thumbnail;
			embed.description = command.botGuild.currentTrack.description;

			delete embed.thumbnail; 
		}
		
		// Show the track listening progress.
		else if (!command.botGuild.currentTrack.isLivestream) {
			const current = Track.timeToText(parseInt(command.botGuild.voiceDispatcher.time / 1000));
			const total = Track.timeToText(parseInt(command.botGuild.currentTrack.duration));

			embed.description = current + " / " + total;
		}

		command.botGuild.lastTextChannel.send("Now playing:", embed);
		command.botGuild.log("Guild is playing: " + command.botGuild.currentTrack.title);
	}
}