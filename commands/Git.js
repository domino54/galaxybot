module.exports = {
	name: "github",
	aliases: ["git"],
	group: "info",
	description: "Sends a link to the GitHub repository with source code of the GalaxyBot.",

	execute: command => {
		command.channel.send(`Wanna see how I was made? :smirk: Well, to satisfy your curiosity, you can browse my source free, ${command.user}:\n${command.galaxybot.github}`);
		command.botGuild.log("GitHub repository URL sent.");
	}
}