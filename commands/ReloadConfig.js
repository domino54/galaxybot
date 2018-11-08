module.exports = {
	name: "reloadconfig",
	description: "Reloads GalaxyBot configuration from the `config.yml` file. Owner access only.",
	hidden: true,
	owner: true,

	execute: command => {
		command.galaxybot.loadConfig().then(count => {
			command.channel.send("GalaxyBot configuration has been reloaded.");
			command.botGuild.log("GalaxyBot configuration has been reloaded.");
		}).catch(error => {
			command.channel.send(`An error has occured while reloading the config file: \`\`\`${error}\`\`\``);
			command.botGuild.log("An error has occured while reloading the config file: " + error);
		});
	}
}