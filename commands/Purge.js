module.exports = {
	name: "purge",
	description: "Removes up to 100 messages in current text channel. Requires both the sender and GalaxyBot to have **Manage messages** permissions in the channel. `user` can be specified to delete messages of a specific user.",
	serverOnly: true,

	execute: command => {
		// User doesn't have "Manage messages" permission.
		if (!command.channel.permissionsFor(command.member).has("MANAGE_MESSAGES") && command.user.id != command.galaxybot.config.dommy) {
			command.channel.send(`Sorry ${command.user}, you don't have the **Manage messages** permission in this channel! :no_entry:`);
			command.botGuild.log("User has no Manage messages permission.");
			return;
		}

		// GalaxyBot doesn't have "Manage messages" permission.
		const botMember = command.guild.members.get(command.galaxybot.client.user.id);

		if (!command.channel.permissionsFor(botMember).has("MANAGE_MESSAGES")) {
			command.channel.send(`Sorry ${command.user}, but I don't have the **Manage messages** permission in this channel. Ask the server administrator to provide me this permission or do it yourself, if you can!`);
			command.botGuild.log("GalaxyBot has no Manage messages permission.");
			return;
		}

		// Command is locked due often usage.
		if (Date.now() < command.botGuild.nextPurgeAllowed) {
			const diff = command.botGuild.nextPurgeAllowed - Date.now();
			command.channel.send(`Sorry ${command.user}, you can't use this command right now. Try again in ${~~(diff / 1000)} second(s)!`);
			command.botGuild.log("Purge has a timeout.");
			return;
		}

		// Number of messages not specified.
		if (command.arguments.length < 1) {
			command.channel.send(`Sorry ${command.user}, but you have to tell me how many messages do you want me to remove (between 1 and 100).`);
			command.botGuild.log("Messages quantity not specified.");
			return;
		}

		function clamp(num, min, max) {
			return num <= min ? min : num >= max ? max : num;
		}

		// Get the number of messages to delete.
		const nbToDelete = clamp(parseInt(command.arguments.shift()), 1, 100);
		var targetMember, deletedMessages = 0;

		// Find the user to PURGE.
		if (command.arguments.length > 0) {
			function escape(string) {
				return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
			};

			const argument = command.galaxybot.escapeMentions(command.arguments.join(" "));
			const expression = new RegExp(escape(argument), "i");
			const targetId = argument.match(/[0-9]+/);
			var matchingMembers = [];

			// Find member of matching tag.
			command.guild.members.forEach((member, memberId) => {
				if (memberId == targetId || member.user.tag.match(expression) || member.displayName.match(expression)) {
					matchingMembers.push(member);
				}
			});

			// Found someone.
			if (matchingMembers.length > 0) {
				targetMember = matchingMembers.shift();
			}
			
			// No users found.
			else {
				command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}** on this server. :rolling_eyes:`);
				command.botGuild.log(`Could not find user "${argument}".`);
				return;
			}
		}

		const memberTag = targetMember ? ` sent by \`${targetMember.user.tag}\`` : "";
		command.channel.send(`Allright ${command.user}, let's **PURGE ${nbToDelete} messages**${memberTag} in this channel! :knife:`);
		command.botGuild.log(`PURGING ${nbToDelete} messages${memberTag}.`);
		command.botGuild.nextPurgeAllowed = Date.now() + nbToDelete * 1000;

		// Destroy the stuff.
		function fetch(message) {
			command.channel.fetchMessages({ limit: (targetMember ? 100 : nbToDelete), before: message.id }).then(messages => {
				var i = 0;

				messages.forEach((message, messageId) => {
					i++;
					if (deletedMessages >= nbToDelete) return;

					if (targetMember === undefined || message.author.id == targetMember.id) {
						message.delete().catch(error => {
							// console.log(error);
						});
						deletedMessages++;
					}

					if (i >= messages.size) fetch(message);
				});

			}).catch(error => {
				// console.log(error);
			});
		}

		fetch(command.message);
	}
}