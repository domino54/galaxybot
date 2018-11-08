const Discord = require("discord.js");

module.exports = {
	name: "reorder",
	description: "The most pointless command, which shuffles the order of all words in the previously sent message, because reasons.",

	execute: command => {
		function clamp(num, min, max) {
			return num <= min ? min : num >= max ? max : num;
		}

		function shuffle(array) {
			var currentIndex = array.length, temporaryValue, randomIndex;

			while (currentIndex !== 0) {
				randomIndex = Math.floor(Math.random() * currentIndex);
				currentIndex -= 1;

				temporaryValue = array[currentIndex];
				array[currentIndex] = array[randomIndex];
				array[randomIndex] = temporaryValue;
			}

			return array;
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

			let targetMessage = shuffle(command.galaxybot.escapeMentions(message.content, message.mentions).split(" ")).join(" ");

			// Send the message.
			command.channel.send(targetMessage);
			command.botGuild.log(`Shuffled a message.`);
		})

		.catch(error => {
			command.channel.send(`Failed to obtain the message: \`\`\`${error}\`\`\``);
			command.botGuild.log("Failed to obtain the message: " + error);
		});
	}
}