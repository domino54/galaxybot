const Discord = require("discord.js");

module.exports = {
	name: "emoji",
	aliases: ["e"],
	syntax: ["% <emoji>"],
	group: "info",
	description: "Shows detailed information about an emoji exising in the server.",
	serverOnly: true,

	execute: command => {
		// No emoji given.
		if (command.arguments.length <= 0) {
			command.channel.send(`Sorry ${command.user}, but if you want me to give you details of an emoji, you have to, well... give me an emoji to describe. :rolling_eyes:`);
			command.botGuild.log(`Emoji name not given.`);
			return;
		}

		const argument = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions);

		let matchingEmoji = [];
		const expression = new RegExp(command.galaxybot.regexEscape(argument.replace(/:/g, "")), "i");
		const targetID = argument.match(/[0-9]+/);

		command.guild.emojis.forEach((emoji, emojiID) => {
			if (emojiID == targetID || emoji.name.match(expression)) {
				matchingEmoji.push(emoji);
			}
		});

		// Emoji not found.
		if (matchingEmoji.length <= 0) {
			command.channel.send(`Sorry ${command.user}, I couldn't find the emoji **${argument}**. It may belong to some other server or just doesn't exist. :shrug:`);
			command.botGuild.log(`Could not find emoji "${argument}".`);
			return;
		}

		let header, targetEmoji = matchingEmoji[0];

		// Show the search matches
		if (matchingEmoji.length > 1) {
			let emojiList = [];
			for (const emoji of matchingEmoji) emojiList.push(`${emoji}`);
			header = `Showing the first of ${emojiList.length} matches: ${emojiList.join("")}`
		}

		// Emoji creation date and origin server.
		let fields = [{
			name: "Created at",
			value: command.galaxybot.formatDate(targetEmoji.createdAt),
			inline: true
		}, {
			name: "Origin server",
			value: targetEmoji.guild.name,
			inline: true
		}];

		// Roles allowed to use this emoji.
		let rolesList = [];

		targetEmoji.roles.forEach((role, roleID) => {
			rolesList.push(`${role}`);
		});

		if (rolesList.length > 0) fields.push({
			name: "Limited to roles",
			value: rolesList.join(", ")
		});

		// Emoji information.
		command.channel.send(header, new Discord.RichEmbed({
			author: {
				name: targetEmoji.name,
				icon_url: targetEmoji.url
			},
			fields: fields,
			thumbnail: {
				url: targetEmoji.url
			},
			footer: {
				text: "ID: " + targetEmoji.id
			}
		}));

		command.botGuild.log("Showing emoji information: " + targetEmoji.id);
	}
}