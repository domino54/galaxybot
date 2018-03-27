var Discord = require("discord.js");

module.exports = {
	name: "8ball",
	description: "Ask the GalaxyBot a yes or no question, it knows the answer to everything.",

	execute: command => {
		// Question not given.
		if (command.arguments.length <= 0) {
			command.channel.send(`You gotta ask me a yes or no question, ${command.user}! :scales:`);
			command.botGuild.log("No question given.");
			return;
		}

		// Prepare the answer.
		var question = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions).replace(/`/g, "");
		var answers = ["Very unlikely...", "Absolutely not.", "Rather not.", "Ewww... no.", "I don't think so.", "Just no.", "Yes!", "Most likely!", "Yeah, pretty much!", "Without a doubt!", "Yes, definitely!", "Very probable!"];
		var answer = answers[Math.floor(Math.random() * answers.length)];

		// Escape custom emoji.
		question = question.replace(/<:|<a:/g, "");
		question = question.replace(/:[0-9]+>/g, "");

		// Some exceptions.
		if (question.match(/pineapple|hawaii/i) && question.match(/pizza/i)) {
			answer = "PINEAPPLE DOESN'T GO ON PIZZA.";
		}
		
		// Send a beautiful embed.
		/*
		command.channel.send(`${command.user}`, new Discord.RichEmbed({
			title: question.substring(0, 256),
			description: answer,
			color: command.botGuild.color
		}));
		*/

		command.channel.send(`${command.user} \`${question}\` ${answer}`);
		command.botGuild.log(`8ball: ${answer}`);
	}
}