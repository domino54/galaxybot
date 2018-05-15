const Discord = require("discord.js");

module.exports = {
	name: "user",
	description: "Display some information about your profile or the profile of a specific user.",

	execute: command => {
		let targetUser = command.user, targetMember = command.member, argument;
		const extendedSearch = command.user.id == command.galaxybot.config.dommy;

		if (command.arguments.length >= 1) {
			argument = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions);
		}

		// User search.
		if (argument) {
			// Find the matching member if in a guild and specified.
			if (command.guild) {
				targetUser = undefined;
				targetMember = command.botGuild.findMember(argument, command.message.mentions);

				if (targetMember) targetUser = targetMember.user;

				// User not found.
				if (targetMember === undefined && !extendedSearch) {
					command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}** on this server. :rolling_eyes:`);
					command.botGuild.log(`Could not find user "${argument}".`);
					return;
				}
			}

			// Owner only: find any user.
			if (extendedSearch) {
				targetUser = command.galaxybot.findUser(argument, command.message.mentions);
			}
		}

		// User not found.
		if (targetUser === undefined) {
			command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}**. :rolling_eyes:`);
			command.botGuild.log(`Could not find user "${argument}".`);
			return;
		}

		// Initialize fields array with a creation date.
		let fields = [{
			name: (targetUser.bot ? "Created at" : "Discord user since"),
			value: command.galaxybot.formatDate(targetUser.createdAt),
			inline: true
		}];

		// If member of a guild, show how long the person is a member.
		if (targetMember) {
			fields.push({
				name: "Server member since",
				value: command.galaxybot.formatDate(targetMember.joinedAt),
				inline: true
			});

			let roles = [];

			targetMember.roles.forEach((role, roleID) => {
				if (role.calculatedPosition <= 0) return;
				roles.push(`${role}`);
			});

			// Show the roles of that person.
			if (roles.length > 0) fields.push({
				name: "Roles",
				value: roles.join(", ")
			});
		}

		// Format the presence text.
		const statuses = { online: "Online", offline: "Offline", idle: "Idle", dnd: "Do Not Disturb" };
		const gameType = ["Playing", "Streaming", "Listening to", "Watching"];

		command.channel.send(new Discord.RichEmbed({
			author: {
				name: targetUser.tag,
				icon_url: targetUser.displayAvatarURL
			},
			description: (targetUser.presence.game ? `${gameType[targetUser.presence.game.type]} **${targetUser.presence.game.name}**` : statuses[targetUser.presence.status]),
			fields: fields,
			color: (targetMember && targetMember.displayColor > 0 ? targetMember.displayColor : undefined),
			thumbnail: {
				url: targetUser.displayAvatarURL
			},
			footer: {
				text: "ID: " + targetUser.id
			}
		}));

		command.botGuild.log("Showing user information: " + targetUser.tag);
	}
}