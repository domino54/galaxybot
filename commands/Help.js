const Discord = require("discord.js");

const commandGroupSort = ["info", "music", "mp", "util", "fun", "own", undefined];

const commandGroupNames = {
	"fun": "Fun commands",
	"music": "Music player",
	"mp": "ManiaPlanet",
	"info": "Information",
	"util": "Utilities",
	"own": "Owner only"
};

module.exports = {
	name: "help",
	aliases: ["h", "?"],
	syntax: ["% [command]"],
	group: "info",
	description: "List the available GalaxyBot commands or sends the description of the given command.",

	execute: command => {
		if (command.arguments[0]) {
			const commandQuery = command.galaxybot.escapeMentions(command.arguments[0], command.message.mentions);
			const commandModel = command.galaxybot.getCommandModel(commandQuery);

			// Command doesn't exist.
			if (!commandModel) {
				let suggestedCommand = command.galaxybot.getSimilarCommand(commandQuery);

				command.channel.send(`Sorry ${command.user}, but I don't have a command named **${commandQuery}**.${suggestedCommand ? " Are you looking for **"+suggestedCommand+"**?" : ""} :thinking:`);
				command.botGuild.log(`Command "${commandQuery}" doesn't exist.`);
				return;
			}

			// Send the command description.
			const commandWithPrefix = command.botGuild.getSetting("prefix") + commandModel.name;

			let commandAliases = [commandModel.name];
			let syntaxList = [commandWithPrefix];

			if (commandModel.aliases && commandModel.aliases.length > 0) {
				commandAliases = commandAliases.concat(commandModel.aliases);
			}

			if (commandModel.syntax && commandModel.syntax.length > 0) {
				syntaxList = [];

				for (var i = 0; i < commandModel.syntax.length; i++) {
					syntaxList.push(commandModel.syntax[i].replace("%", commandWithPrefix));
				}
			}

			command.channel.send(new Discord.RichEmbed({
				fields: [{
					name: commandAliases.join(", "),
					value: "`" + syntaxList.join("`\n`") + "`"
				}, {
					name: "Description",
					value: commandModel.description
				}],
				color: command.botGuild.color
			}));

			return;
		}

		let commandGroups = new Object();
		let fields = [];

		command.galaxybot.availableCommands.forEach((commandModel, commandName) => {
			if (commandModel.hidden === true) return;

			// Initialize group.
			let groupID = undefined;
			if (commandModel.group) groupID = commandModel.group;
			if (!commandGroups[groupID]) commandGroups[groupID] = [];
			
			let commandAliases = [commandModel.name];

			//if (commandModel.aliases && commandModel.aliases.length > 0) {
			//	commandAliases = commandAliases.concat(commandModel.aliases);
			//}

			commandGroups[groupID] = commandGroups[groupID].concat(commandAliases);
		});

		for (var i = 0; i < commandGroupSort.length; i++) {
			const groupID = commandGroupSort[i];

			if (commandGroups[groupID] && commandGroups[groupID].length > 0) {
				fields.push({
					name: commandGroupNames[groupID] ? commandGroupNames[groupID] : "Uncategorized commands",
					value: "`" + commandGroups[groupID].sort().join("` `") + "`"
				});
			}
		}

		command.channel.send(new Discord.RichEmbed({
			author: {
				name: `${command.galaxybot.client.user.username} commands list`,
				icon_url: command.galaxybot.client.user.displayAvatarURL
			},
			thumbnail: {
				url: command.galaxybot.client.user.displayAvatarURL
			},
			description: `List of the available commands. For detailed information, visit the [git repo page](${command.galaxybot.github}).`,
			fields: fields,
			color: command.botGuild.color,
			footer: {
				text: `For detailed description of a specific command, use "${command.botGuild.getSetting("prefix")}h command".`
			}
		}));
	}
}