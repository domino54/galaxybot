const Discord = require("discord.js");

module.exports = {
	name: "rename",
	aliases: ["name", "nick"],
	syntax: ["% <name>"],
	group: "util",
	description: "Changes the name of GalaxyBot in the server.",
	serverOnly: true,

	execute: command => {
		// No permissions to change the bot name.
		if (!command.botGuild.isGalaxyBotManager(command.member)) {
			command.channel.send(`Sorry ${command.user}, you don't have permissions to change my name. :no_entry:`);
			command.botGuild.log("No permissions to change GalaxyBot name: " + command.user.tag);
			return;
		}

		// GalaxyBot doesn't have "Change nickname" permission.
		const botMember = command.guild.members.get(command.galaxybot.client.user.id);

		if (!command.channel.permissionsFor(botMember).has("CHANGE_NICKNAME")) {
			command.channel.send(`Sorry ${command.user}, but I don't have the **Change nickname** permission in this server. Ask the server administrator to provide me this permission or do it yourself, if you can!`);
			command.botGuild.log("GalaxyBot has no Change nickname permission.");
			return;
		}

		// Special, detailed embed.
		if (command.arguments[0] === undefined) {
			command.channel.send(`Sorry ${command.user}, but if you want to rename me, you actually have to, well... specify a name, I suppose? :shrug:`);
			command.botGuild.log("No new name given: " + command.user.tag);
			return;
		}
		
		const targetName = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions);

		// Name too long or too short.
		if (targetName.length < 1 || targetName.length > 32) {
			command.channel.send(`Sorry ${command.user}, my new name must be between 1 and 32 characters long! :rolling_eyes:`);
			command.botGuild.log("Name doesn't match length criteria.");
			return;
		} 

		// Set the new name.
		botMember.setNickname(targetName).then(() => {
			command.channel.send(`From now on, call me **${targetName}**, ${command.user}!`);
			command.botGuild.log("New name set: " + targetName);
		})

		// Failed to change the nickname.
		.catch(error => {
			command.channel.send(`Sorry ${command.user}, but if you want to rename me, you actually have to, well... specify a name, I suppose? :shrug:`);
			command.botGuild.log("New name rejected: " + targetName);
		});
	}
}