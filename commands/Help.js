const Discord = require("discord.js");

module.exports = {
	name: "help",
	description: "Sends a link to the commands reference or a description of the given command.",

	execute: command => {
		if (command.arguments[0]) {
			const commandName = command.galaxybot.escapeMentions(command.arguments[0], command.message.mentions);

			// Command doesn't exist.
			if (!command.galaxybot.availableCommands.has(commandName)) {
				command.channel.send(`Sorry ${command.user}, but I don't have a command named **${commandName}**. :rolling_eyes:`);
				command.botGuild.log(`Command "${commandName}" doesn't exist.`);
				return;
			}

			// Send the command description.
			const commandModel = command.galaxybot.availableCommands.get(commandName);
			
			command.channel.send(new Discord.RichEmbed({
				title: commandModel.name,
				description: commandModel.description,
				color: command.botGuild.color
			}));

			return;
		}

		/*
		var commands = [];
		command.galaxybot.availableCommands.forEach((commandModel, commandName) => {
			if (commandModel.hidden === true) return;
			commands.push(commandName);
		});

		command.channel.send("List of my currently available commands: ```" + commands.join(", ") + "```");
		*/

		// Commands documentation.
		command.channel.send(`You can find the full documentation of all my commands here, ${command.user}:\n${command.galaxybot.github}`);
		command.botGuild.log("GalaxyBot documentation URL sent.");
	}
}