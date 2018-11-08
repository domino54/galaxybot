const Discord = require("discord.js");

module.exports = {
	name: "8ball",
	description: "Ask the GalaxyBot a yes or no question, she knows the answer to everything.",

	execute: command => {
		// Question not given.
		if (command.arguments.length <= 0) {
			command.channel.send(`You gotta ask me a yes or no question, ${command.user}! :scales:`);
			command.botGuild.log("No question given.");
			return;
		}

		// Prepare the answer.
		let question = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions).replace(/`/g, "");
		let debug = question.toLowerCase().replace(/\W/g, ""), numericValue = 0;

		// Answer is determined by a sum of all char codes in the question.
		for (let i = 0; i < debug.length; i++) {
			numericValue += debug.charCodeAt(i);
		}

		const answers = ["Ewww... no.", "Absolutely not.", "Rather not.", "Very unlikely...", "I don't think so.", "Most likely!", "Very probable!", "Yes!", "Without a doubt!", "Yeah, pretty much!", "Yes, definitely!", "Just no."];
		let answer = answers[numericValue % answers.length];

		// Escape custom emoji.
		question = question.replace(/<:|<a:/g, "");
		question = question.replace(/:[0-9]+>/g, "");

		// Some exceptions.
		if (question.match(/pineapple|hawaii/i) && question.match(/pizza/i)) {
			answer = "PINEAPPLE DOESN'T GO ON PIZZA, YOU HORRIBLE PERSON.";
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