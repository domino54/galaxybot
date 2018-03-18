const Discord = require("discord.js");

module.exports = {
	name: "help",
	description: "Sends a link to the commands reference or a description of the given command.",

	execute: command => {
		if (command.arguments[0]) {
			const commandName = command.arguments[0];

			// Command doesn't exist.
			if (!command.galaxybot.availableCommands.has(commandName)) {
				command.channel.send("Sorry <@" + command.user.id + ">, but I don't have a command named **" + commandName + "**. :rolling_eyes:");
				command.botGuild.log("Command \"" + commandName + "\" doesn't exist.");
				return;
			}

			// Send the command description.
			const commandModel = command.galaxybot.availableCommands.get(commandName);
			var member = command.guild ? command.guild.members.get(command.galaxybot.client.user.id) : undefined;

			command.channel.send(new Discord.RichEmbed({
				title: commandModel.name,
				description: commandModel.description,
				color: (member && member.displayColor > 0 ? member.displayColor : undefined)
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
		command.channel.send("You can find the full documentation of all my commands here, <@" + command.user.id + ">:\nhttps://github.com/domino54/galaxybot/blob/master/README.md");
		command.botGuild.log("GalaxyBot documentation URL sent.");
	}
}