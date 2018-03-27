const Discord = require("discord.js");

module.exports = {
	name: "user",
	description: "Display some information about your profile or the profile of a specific user.",

	execute: command => {
		let targetUser = command.user, targetMember = command.member;

		// Find the matching member if in a guild and specified.
		if (command.guild && command.arguments.length >= 1) {
			const argument = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions);

			let matchingMembers = [];

			// From a mention.
			if (command.message.mentions.members != null && command.message.mentions.members.size > 0) {
				command.message.mentions.members.forEach((member, memberID) => {
					matchingMembers.push(member);
				});
			}

			// Search.
			else {
				/**
				 * Escape characters in regular expression.
				 *
				 * @param {string} string - The string to escape.
				 * @returns {string} The escaped string.
				 */
				function escape(string) {
					return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
				};

				const expression = new RegExp(escape(argument), "i");
				const targetId = argument.match(/[0-9]+/);

				// Find member of matching tag.
				command.guild.members.forEach((member, memberId) => {
					if (memberId == targetId || member.user.tag.match(expression) || member.displayName.match(expression)) {
						matchingMembers.push(member);
					}
				});
			}

			// Found someone.
			for (const member of matchingMembers) {
				targetUser = member.user;
				targetMember = member;
				break;
			}
			
			// No users found.
			if (matchingMembers.length <= 0) {
				command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}** on this server. :rolling_eyes:`);
				command.botGuild.log(`Could not find user "${argument}".`);
				return;
			}
		}

		/**
		 * Format a date into a readable format.
		 *
		 * @param {Date} date - The date to format.
		 * @returns {string} The formatted date.
		 */
		function formatDate(date) {
			if (!date instanceof Date) return "Invalid date";

			/**
			 * Append precending zeroes to an integer.
			 *
			 * @param {number} num - The integer to format.
			 * @param {number} length - The target length of the string.
			 * @returns {string} The formatted integer.
			 */
			function formatInt(num, length) {
				let string = Math.floor(num).toString();
				while (string.length < length) string = "0" + string;
				return string;
			}

			const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
			let daysSince = Math.floor((Date.now() - date.getTime()) / 86400000);

			return date.getUTCDate() + " " + months[date.getUTCMonth()] + " " + date.getUTCFullYear() + ", " +
				formatInt(date.getUTCHours(), 2) + ":" + formatInt(date.getUTCMinutes(), 2) + "\n" +
				"(" + (daysSince > 0 ? (daysSince > 1 ? `${daysSince} days ago` : "Yesterday") : "Today") + ")";
		}

		// Initialize fields array with a creation date.
		let fields = [{
			name: (targetUser.bot ? "Created at" : "Discord user since"),
			value: formatDate(targetUser.createdAt),
			inline: true
		}];

		if (targetMember) {
			// If member of a guild, show how long the person is a member.
			fields.push({
				name: "Server member since",
				value: formatDate(targetMember.joinedAt),
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
	}
}