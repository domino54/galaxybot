const Discord = require("discord.js");
const EmbedPlayer = require("./../structures/EmbedPlayer.js");

module.exports = {
	name: "embedplayer",
	aliases: ["ep"],
	group: "music",
	description: "Creates a graphic user interface for the music player. Can be used only by the GalaxyBot managers and when the music player is in use.",
	serverOnly: true,

	execute: command => {
		// Not a manager.
		if (!command.botGuild.isGalaxyBotManager(command.member)) {
			command.channel.send(`Sorry ${command.user}, you con't have permissions to create an embed music player! :no_entry:`);
			command.botGuild.log("User has not enough permissions to create embed players.");
			return;
		}

		// Nothing being played.
		if (!command.botGuild.currentTrack) {
			command.channel.send(`I'm not playing anything right now, ${command.user}. Embed music player works only when the music player is in use!`);
			command.botGuild.log("Nothing is being played.");
			return;
		}

		// Destroy already existing embed player.
		if (command.botGuild.embedPlayer !== false) {
			command.botGuild.embedPlayer.destructor();
		}

		command.botGuild.embedPlayer = new EmbedPlayer(command.galaxybot, command.botGuild, command.channel);
		
		// Initialize newly made player.
		command.botGuild.embedPlayer.init().then(() => {
			command.botGuild.embedPlayer.ready = true;
			command.botGuild.updateEmbedPlayer();
			command.botGuild.log("Embed player created");
		}).catch(error => {
			command.botGuild.embedPlayer.destructor();
			command.botGuild.embedPlayer = false;

			command.channel.send(`Embed player could not be created, ${command.user}. Here's why: \`\`\`${error}\`\`\``);
			command.botGuild.log(error);
		});
	}
}