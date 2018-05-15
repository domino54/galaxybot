const Discord = require("discord.js");

module.exports = {
	name: "reorder",
	description: "The most pointless command, which shuffles the order of all words in the previously sent message, because reasons.",

	execute: command => {
		function clamp(num, min, max) {
			return num <= min ? min : num >= max ? max : num;
		}

		// Get the order of the message.
		const parsedNumber = command.arguments[0] ? parseInt(command.arguments.shift()) : 1;
		const messageOrder = clamp(parsedNumber, 1, 50);

		command.channel.fetchMessages({ before: command.message.id, limit: messageOrder }).then(messages => {
			if (messages.size <= 0) {
				command.channel.send(`Sorry ${command.user}, I couldn't find any message to shuffle its words. :cry:`);
				command.botGuild.log("No messages found.");
				return;
			}

			const message = messages.get(messages.lastKey());
			
			// Message is empty.
			if (message.content.length <= 0) {
				command.channel.send(`Sorry ${command.user}, this message is empty. :shrug:`);
				command.botGuild.log("Message is empty.");
				return;
			}

			let messageWords = command.galaxybot.escapeMentions(message.content, message.mentions).split(" ");
			messageWords.sort(() => { return 0.5 - Math.random(); });
			let targetMessage = messageWords.join(" ");
			

			// Send the message.
			command.channel.send(targetMessage);
			command.botGuild.log(`Shuffled ${messageWords.length} words.`);
		})

		.catch(error => {
			command.channel.send(`Failed to obtain the message: \`\`\`${error}\`\`\``);
			command.botGuild.log("Failed to obtain the message: " + error);
		});
	}
}