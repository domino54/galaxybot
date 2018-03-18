module.exports = {
	name: "dommy",
	description: "Mention `Dommy#7014` with a thinking GIF. 🤔",
	serverOnly: true,

	execute: command => {
		command.channel.send("<@" + command.galaxybot.config.dommy + "> https://giphy.com/gifs/movie-mrw-see-2H67VmB5UEBmU");
		command.botGuild.log("Spammed Dommy with a nice GIF.");
	}
}