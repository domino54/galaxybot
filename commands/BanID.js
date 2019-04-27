module.exports = {
	name: "banid",
	syntax: ["% <id> [id] ..."],
	group: "util",
	description: "Allows moderators to ban users, who aren't members of the server by providing their user IDs.",
	serverOnly: true,

	execute: command => {
		// User doesn't have "Ban members" permission.
		if (!command.channel.permissionsFor(command.member).has("BAN_MEMBERS") && command.user.id != command.galaxybot.config.owner) {
			command.channel.send(`Sorry ${command.user}, you don't have the **Ban members** permission in this server! :no_entry:`);
			command.botGuild.log("User has no Ban members permission.");
			return;
		}

		// GalaxyBot doesn't have "Ban members" permission.
		const botMember = command.guild.members.get(command.galaxybot.client.user.id);

		if (!command.channel.permissionsFor(botMember).has("BAN_MEMBERS")) {
			command.channel.send(`Sorry ${command.user}, but I don't have the **Ban members** permission in this server. Ask the server administrator to provide me this permission or do it yourself, if you can!`);
			command.botGuild.log("GalaxyBot has no Ban members permission.");
			return;
		}

		// No user specified.
		if (command.arguments.length <= 0) {
			command.channel.send(`You know, I can't ban anyone, unless... you tell me who am I supposed to ban, ${command.user}. :rolling_eyes:`);
			command.botGuild.log("User not specified.");
			return;
		}

		let processedUsers = [];
		let bannedUsers = [];
		let failedUsers = [];
		let errors = [];

		command.channel.startTyping();

		/**
		 * This function triggers the banning sequence.
		 *
		 * @param {Snowflake[]} Array of user IDs to ban.
		 * @param {Snowflake[]} Array of user already banned.
		 */
		function banIDs(userIDs, alreadyBanned) {
			const casterHighestRole = command.member.highestRole.calculatedPosition;

			/**
			 * Casted when user is banned (or failed to ban). Triggers when all target users are processed.
			 */ 
			function finished() {
				if (processedUsers.length < userIDs.length) return;

				command.channel.stopTyping();

				// Multiple users.
				if (processedUsers.length > 1) {
					let mergedErrors = errors.join("\n");

					if (bannedUsers.length == 0) {
						command.channel.send(`**No users** have been banned from the server, ${command.user}. They gave these errors: \`\`\`${mergedErrors}\`\`\``);
						command.botGuild.log("Errors occured while banning users:\n" + mergedErrors);
					}

					else if (bannedUsers.length == processedUsers.length) {
						command.channel.send(`**${bannedUsers.length}** users have been successfully banned from the server, ${command.user}!`);
						command.botGuild.log("Banned users: " + bannedUsers.join(" "));
					}

					else {
						command.channel.send(`**${bannedUsers.length > 1 ? bannedUsers.length + " users** have" : "1 user has"} been successfully banned from the server, ${command.user}. The rest gave these errors: \`\`\`${mergedErrors}\`\`\``);
						command.botGuild.log("Banned users: " + bannedUsers.join(", "));
						command.botGuild.log("Errors occured while banning users:\n" + mergedErrors);
					}
				}

				// Single user.
				else {
					if (bannedUsers.length > 0) {
						command.channel.send(`User has been successfully banned from the server, ${command.user}!`);
						command.botGuild.log("Banned the user " + bannedUsers[0]);
					} else {
						command.channel.send(`Sorry ${command.user}, I couldn't ban this user: \`\`\`${errors[0]}\`\`\``);
						command.botGuild.log("An error occured while banning an user: " + errors[0]);
					}
				}
			}

			for (const userID of userIDs) {
				// User already banned.
				if (alreadyBanned && alreadyBanned.indexOf(userID) >= 0) {
					processedUsers.push(userID);
					failedUsers.push(userID);
					errors.push(userID + ": This user is already banned!");
					finished();
					continue;
				}

				// No self-bans.
				if (userID == command.user.id) {
					processedUsers.push(userID);
					failedUsers.push(userID);
					errors.push(userID + ": You cannot ban yourself!");
					finished();
					continue;
				}

				let serverMember = command.guild.members.get(userID);

				if (serverMember) {
					// Top role is higher.
					if (casterHighestRole <= serverMember.highestRole.calculatedPosition) {
						processedUsers.push(userID);
						failedUsers.push(userID);
						errors.push(userID + ": User has higher or the same top level role as you!");
						finished();
						continue;
					}

					// Cannot be banned.
					else if (!serverMember.bannable) {
						processedUsers.push(userID);
						failedUsers.push(userID);
						errors.push(userID + ": Cannot be banned by GalaxyBot!");
						finished();
						continue;
					}
				}

				// Attempt to ban.
				command.guild.ban(userID, { reason: `Banned through ID by ${command.galaxybot.client.user.tag}.` }).then(user => {
					processedUsers.push(userID);
					bannedUsers.push(userID);
					finished();
				}).catch(error => {
					processedUsers.push(userID);
					failedUsers.push(userID);
					errors.push(userID + ": " + error);
					finished();
				});
			}
		}

		// Check for users that are already banned.
		command.guild.fetchBans().then(bans => {
			banIDs(command.arguments, bans.keyArray());
		}).catch(error => {
			command.botGuild.log("An error occured while obtaining the ban list: " + error);
			banIDs(command.arguments);
		});
	}
}