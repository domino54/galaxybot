module.exports = {
	name: "git",
	description: "Sends a link to the GitHub repository with source code of the GalaxyBot.",

	execute: command => {
		command.channel.send(
			"Wanna see how I was made? :smirk: Well, to satisfy your curiosity, you can browse my source free, <@" + command.user.id + ">:\n" +
			"https://github.com/domino54/galaxybot/"
		);
		command.botGuild.log("GitHub repository URL sent.");
	}
}