const leetCharacters = new Map([
	["a", "4"], ["b", "ß"], ["c", "©"], ["d", "[)"], ["e", "3"], ["f", "ƒ"], ["i", "!"],
	["k", "К"], ["l", "1"], ["ł", "£"], ["m", "Ϻ"], ["n", "И"], ["o", "0"], ["r", "Я"],
	["s", "$"], ["t", "7"], ["w", "Ϣ"], ["x", "ECKS"], ["y", "¥"], ["z", "2"]
]);

module.exports = {
	name: "leet",
	description: "Turns a sentence into 1337 speech.",

	execute: command => {
		function leet(text) {
			let output = text.toUpperCase();

			leetCharacters.forEach((replacement, char) => {
				output = output.replace(new RegExp(char, "gi"), replacement);
			});

			return output;
		}

		// No sentence specified.
		if (command.arguments.length <= 0) {
			command.channel.send(`${leet("You gotta give me a sentence to 1337")}, ${command.user}.`);
			command.botGuild.log("No 1337 sentence to translate.");
			return;
		}

		let leetText = leet(command.galaxybot.escapeMentions(command.arguments.join(" ")));

		// It's so big.
		if (leetText.length > 2000) {
			command.channel.send(`Boi, the 1337 translation ended up exceeding Discord's 2000 characters limit in a message. ${command.user}, shorten it a bit!`);
			command.botGuild.log("1447 translation too long");
			return;
		}

		command.channel.send(leetText);
		command.botGuild.log("Sent a 1337 text.");
	}
}