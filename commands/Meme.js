const https = require("https");
const Discord = require("discord.js");
const memesSub = "dankmemes";

module.exports = {
	name: "meme",
	group: "fun",
	description: `Get some hot memes directly from the [r/${memesSub}](https://www.reddit.com/r/${memesSub}) subreddit.`,

	execute: command => {
		command.galaxybot.reddit.randomPost(memesSub, command.botGuild.id).then(post => {
			let embed = command.galaxybot.reddit.createEmbed(post);
			embed.color = command.botGuild.color;

			command.channel.send({
				embed: embed
			});
			command.botGuild.log("Sent a reddit post: " + post.permalink);
		}).catch(error => {
			command.channel.send("There's been an error while obtaining reddit posts: ```" + error + "```");
			command.botGuild.log("Error while obtaining reddit posts: " + error);
		});
	}
}