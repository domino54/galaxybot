module.exports = {
	name: "reloadcommands",
	aliases: ["reloadcmds", "rcmd", "rlc"],
	group: "own",
	description: "Reloads commands from the `./commands/` direcotry. Owner access only.",
	hidden: true,
	owner: true,

	execute: command => {
		command.galaxybot.loadCommands().then(counts => {
			command.channel.send(`**${counts.commands} command${counts.commands != 1 ? "s" : ""}** under **${counts.aliases} alias${counts.aliases != 1 ? "es" : ""}** have been loaded.`);
			command.botGuild.log(`${counts.commands} commands with ${counts.aliases} aliases have been loaded.`);// Load commands.

		}).catch(error => {
			command.channel.send(`An error has occured while reloading the commands: \`\`\`${error}\`\`\``);
			command.botGuild.log(`An error has occured while reloading the commands: ${error}`);
		});
	}
}