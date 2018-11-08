module.exports = {
	name: "reloadcmds",
	description: "Reloads commands from the `./commands/` direcotry. Owner access only.",
	hidden: true,
	owner: true,

	execute: command => {
		command.galaxybot.loadCommands().then(count => {
			command.channel.send(`**${count} command${count != 1 ? "s" : ""}** have been loaded.`);
			command.botGuild.log(`${count} commands have been loaded.`);
		}).catch(error => {
			command.channel.send(`An error has occured while reloading the commands: \`\`\`${error}\`\`\``);
			command.botGuild.log(`An error has occured while reloading the commands: ${error}`);
		});
	}
}