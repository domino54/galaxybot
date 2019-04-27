module.exports = {
	name: "purge",
	syntax: ["% <count> [user]"],
	group: "util",
	description: "Removes up to 100 messages in the current text channel. Requires both the sender and GalaxyBot to have **Manage messages** permissions in the channel. Name can be specified at the end of the command to target messages of the given user.",
	serverOnly: true,

	execute: command => {
		// User doesn't have "Manage messages" permission.
		if (!command.channel.permissionsFor(command.member).has("MANAGE_MESSAGES") && command.user.id != command.galaxybot.config.owner) {
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

		// Get the number of messages to delete.
		const parsedNumber = command.arguments[0] ? parseInt(command.arguments.shift()) : 0;

		// Number of messages not specified.
		if (isNaN(parsedNumber) || parsedNumber < 1) {
			command.channel.send(`Sorry ${command.user}, but you have to tell me how many messages do you want me to remove (between 1 and 50).`);
			command.botGuild.log("Messages quantity not specified.");
			return;
		}

		function clamp(num, min, max) {
			return num <= min ? min : num >= max ? max : num;
		}

		// Get the number of messages to delete.
		const nbToDelete = clamp(parsedNumber, 1, 50);
		var targetMember, deletedMessages = 0;

		// Find the user to PURGE their messages.
		if (command.arguments.length > 0) {
			const argument = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions);

			// Find the target user.
			targetMember = command.botGuild.findMember(argument, command.message.mentions);
			
			// User not found.
			if (!targetMember) {
				command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}** on this server. :rolling_eyes:`);
				command.botGuild.log(`Could not find user "${argument}".`);
				return;
			}
		}

		const memberTag = targetMember ? ` sent by \`${targetMember.user.tag}\`` : "";
		command.channel.send(`Alright ${command.user}, let's **PURGE ${nbToDelete} messages**${memberTag} in this channel! :knife:`);
		command.botGuild.log(`PURGING ${nbToDelete} messages${memberTag}.`);
		command.botGuild.nextPurgeAllowed = Date.now() + nbToDelete * 1000;

		// Destroy the stuff.
		function fetch(msg) {
			command.channel.fetchMessages({ limit: (targetMember ? 50 : nbToDelete), before: msg.id }).then(messages => {
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