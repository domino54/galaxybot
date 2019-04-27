const Discord = require("discord.js");

module.exports = {
	name: "user",
	aliases: ["member"],
	syntax: ["% [user]"],
	group: "info",
	description: "Display some information about your profile or the profile of a specific user. GalaxyBot owner can search for users in all servers.",

	execute: command => {
		let targetUser = command.user, targetMember = command.member, argument;
		const extendedSearch = command.user.id == command.galaxybot.config.owner;
		let searchByID = "";

		if (command.arguments.length >= 1) {
			argument = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions);
			searchByID = argument.match(/[0-9]*$/)[0];
		}

		function sendUserInfo(user, member) {
			// User not found.
			if (user === undefined) {
				command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}**. :rolling_eyes:`);
				command.botGuild.log(`Could not find user "${argument}".`);
				return;
			}

			// Initialize fields array with a creation date.
			let fields = [{
				name: (user.bot ? "Created at" : "Discord user since"),
				value: command.galaxybot.formatDate(user.createdAt),
				inline: true
			}];

			// If member of a guild, show how long the person is a member.
			if (member) {
				fields.push({
					name: "Server member since",
					value: command.galaxybot.formatDate(member.joinedAt),
					inline: true
				});

				let roles = [];

				member.roles.forEach((role, roleID) => {
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
					name: user.tag,
					icon_url: user.displayAvatarURL
				},
				description: (user.presence.game ? `${gameType[user.presence.game.type]} **${user.presence.game.name}**` : statuses[user.presence.status]),
				fields: fields,
				color: (member && member.displayColor > 0 ? member.displayColor : undefined),
				thumbnail: {
					url: user.displayAvatarURL
				},
				footer: {
					text: "ID: " + user.id
				}
			}));

			command.botGuild.log("Showing user information: " + user.tag);
		}

		// User search.
		if (argument) {
			targetUser = undefined;
			targetMember = undefined;

			// Find the matching member if in a guild and specified.
			if (command.guild) {
				targetMember = command.botGuild.findMember(argument, command.message.mentions);
				const showError = !extendedSearch && searchByID == "";

				if (targetMember) targetUser = targetMember.user;

				// User not found.
				if (targetMember === undefined && showError) {
					command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}** on this server. :rolling_eyes:`);
					command.botGuild.log(`Could not find user "${argument}".`);
					return;
				}
			}

			// Owner only: find any user.
			if (targetMember === undefined && extendedSearch) {
				targetUser = command.galaxybot.findUser(argument, command.message.mentions);
			}

			// Search by user ID
			if (targetUser === undefined && searchByID) {
				command.galaxybot.client.fetchUser(searchByID).then(user => {
					sendUserInfo(user);
				}).catch(error => {
					command.channel.send(`Sorry ${command.user}, I couldn't find the user with ID **${argument}**. :rolling_eyes:`);
					command.botGuild.log(`Could not find user "${argument}".`);
				});
			}
		}

		// User has been found.
		if (targetUser) {
			sendUserInfo(targetUser, targetMember);
		}
	}
}