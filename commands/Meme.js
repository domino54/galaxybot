const https = require("https");
const Discord = require("discord.js");

module.exports = {
	name: "meme",
	description: "Get some hot memes directly from the [r/dankmemes](https://www.reddit.com/r/dankmemes) subreddit.",

	execute: command => {
		const cachedPostsCount = 100;

		/**
		 * Creates a nice embed of the reddit post.
		 *
		 * @param {Object} post - The reddit post to send.
		 */
		function sendRedditPost(post) {
			command.channel.send(new Discord.RichEmbed({
				author: {
					name: "u/" + post.author,
					url: "https://www.reddit.com/user/" + post.author
				},
				title: post.title,
				description: post.selftext.substring(0, 2000),
				url: "https://www.reddit.com/" + post.permalink,
				image: {
					url: post.url
				},
				footer: {
					text: post.score + " point" + (post.score != 1 ? "s" : "") + " • " + post.num_comments + " comment" + (post.num_comments != 1 ? "s" : "")
				},
				timestamp: new Date(post.created_utc * 1000).toISOString(),
				color: command.botGuild.color
			}));

			command.botGuild.log("Sent a reddit post: " + post.permalink);
		}

		/**
		 * Pick a random post from the meme cache.
		 */
		function randomPost() {
			if (!command.galaxybot.memecache) return null;

			if (command.galaxybot.memecache.indices.length <= 0) {
				for (var i = 0; i < command.galaxybot.memecache.memes.length; i++) {
					command.galaxybot.memecache.indices.push(i);
				}
			}

			let index = command.galaxybot.memecache.indices.splice(Math.floor(Math.random() * command.galaxybot.memecache.indices.length), 1)[0];

			return command.galaxybot.memecache.memes[index]["data"];
		}

		// If no memes are cached or the cache expired, get new memes.
		if (!command.galaxybot.memecache || Date.now() > command.galaxybot.memecache.timeout) {
			command.channel.startTyping();
			command.botGuild.log("Updating the meme database...");

			https.get(
				"https://www.reddit.com/r/dankmemes/hot.json?limit=" + cachedPostsCount, {headers: {"User-Agent": "GalaxyBot"}}, res => {
				let result = "";

				res.on("data", chunk => {
					result += chunk;
				});

				res.on("end", () => {
					command.channel.stopTyping();

					try {
						const response = JSON.parse(result);
						const posts = response["data"]["children"];

						if (posts && posts.length > 0) {
							// Cache the memes.
							command.galaxybot.memecache = {
								timeout: Date.now() + 3600000,
								memes: posts,
								indices: []
							};

							sendRedditPost(randomPost());
						}
					}

					catch (error) {
						command.channel.send("There's been an error while obtaining reddit posts: ```" + error + "```");
						command.botGuild.log("Error while obtaining reddit posts: " + error);
					}
				});
			}).on("error", error => {
				command.channel.send("There's been an error while obtaining reddit posts: ```" + error + "```");
				command.botGuild.log("Error while obtaining reddit posts: " + error);
				command.channel.stopTyping();
			});
		}

		// Pick a random cached meme.
		else {
			sendRedditPost(randomPost());
		}
	}
}