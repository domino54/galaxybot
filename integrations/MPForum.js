const Discord = require("discord.js");
const https = require("https");
const querystring = require("querystring");
const html2md = require("html-markdown");
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

/**
 * ManiaPlanet Forum parser.
 */
class MPForum {
	constructor() {

	}

	/**
	 * Create https request.
	 *
	 * @param {string} url - Request path. 
	 * @returns {Promise<string>} A promise with the request result.
	 */ 
	static httpsGet(url) {
		return new Promise((resolve, reject) => {
			https.get(url, response => {
				var body = "";

				response.on("data", data => {
					body += data;
				});

				response.on("end", () => {
					resolve(body);
				});

				response.on("error", error => {
					reject(error);
				});
			});
		});
	}

	/**
	 * Convert HTML into a readable Markdown.
	 *
	 * @param {string} string - The string to format.
	 * @returns {string} Formatted string.
	 */
	static convertFormat(string) {
		string = string.replace(/<br>/g, "");				// Remove line breaking tags.
		string = html2md.html2mdFromString(string);			// Parse HTML into Markdown.
		string = string.replace(/<[a-zA-Z\/][^>]*>/g, "");	// Remove all remaining HTML.
		return string;
	}

	/**
	 * Create a Discord embed from given post data.
	 *
	 * @param {Object} post - The post to format.
	 * @returns {RichEmbed} The Discord embed.
	 */
	static createEmbed(post) {
		if (post === undefined) return undefined;

		let content = post.content.substring(0, 512);
		if (content != post.content) content += "...";

		// Post contents.
		let embed = new Discord.RichEmbed({
			title: post.title,
			description: this.convertFormat(content),
			url: post.url,
			footer: {
				text: "ManiaPlanet Forum",
			}
		});

		// Post time.
		try {
			embed.timestamp = new Date(post.time).toISOString();
		}
		catch (error) {
			embed.footer.text += " • " + post.time;
		}

		// Post author.
		if (post.author) {
			embed.author = {
				name: post.author.username,
				icon_url: post.author.avatarURL,
				url: post.author.url,
			};

			embed.thumbnail = {
				url: post.author.avatarURL
			};
		}

		// Post image.
		if (post.imageURL) {
			embed.image = {
				url: post.imageURL
			};
		}
		
		return embed;
	}

	/**
	 * Obtain information about a post from the forum.
	 *
	 * @param {string} url - URL of the post to get.
	 * @returns {Promise<object>} A promise with the post information.
	 */
	static getPost(url) {
		return new Promise((resolve, reject) => {
			let postID, escapedQuery = url.split("?").pop();
			let explode = escapedQuery.split("#");

			// From JavaScript action.
			if (explode.length > 1) {
				const match = explode[1].match(/[0-9]+/);
				if (match && match[0]) {
					postID = match[0];
				}
			}

			// From URL query.
			else {
				const query = querystring.parse(escapedQuery);
				postID = query["p"];
			}

			this.httpsGet(url).then(data => {
				const document = new JSDOM(data).window.document;
				let parsingNode, post = new Object();

				// Post specified in the URL.
				if (postID) parsingNode = document.getElementById("p" + postID);

				// First post on the page.
				if (!parsingNode) {
					const postsCol = document.getElementsByClassName("post");

					for (let i = 0; i < postsCol.length; i++) {
						const node = postsCol[i];
						if (node.nodeName !== "DIV") continue;
						parsingNode = node;
						break;
					}
				}

				// Parse the post information.
				if (parsingNode) {
					post.id = parsingNode.id.match(/[0-9]+/)[0];
					post.title = parsingNode.getElementsByTagName("H3")[0].firstChild.innerHTML;
					post.content = parsingNode.getElementsByClassName("content")[0].innerHTML;
					post.url = "https://forum.maniaplanet.com/viewtopic.php?p=" + post.id + "#p" + post.id;
					post.imageURL = null;
					post.author = null;

					// Get the very first image in the post.
					const images = post.content.match(/(https?:\/\/.*\.(?:png|jpg|jpeg|webp|gif))/gi); // Ignore gif
					if (images && images[0]) post.imageURL = images[0];

					const profileNode = parsingNode.getElementsByClassName("postprofile")[0];
					const authorNode = parsingNode.getElementsByClassName("author")[0];

					// Post author.
					if (profileNode) {
						const avatarCol = parsingNode.getElementsByClassName("avatar");
						let usernameNode = parsingNode.getElementsByClassName("username-coloured")[0];
						if (!usernameNode) usernameNode = parsingNode.getElementsByClassName("username")[0];

						let avatarURL = "";
						let userID = querystring.parse(usernameNode.getAttribute("href"))["u"];

						for (let i = 0; i < avatarCol.length; i++) {
							const node = avatarCol[i];
							if (node.nodeName !== "IMG") continue;
							avatarURL = node.getAttribute("src").replace("./", "https://forum.maniaplanet.com/");
							break;
						}

						// Post author details.
						post.author = {
							username: usernameNode.innerHTML,
							avatarURL: avatarURL,
							url: "https://forum.maniaplanet.com/memberlist.php?mode=viewprofile&u=" + userID
						};
					}

					// Post time.
					if (authorNode) {
						let time = authorNode.innerHTML.split(">").pop();
						post.time = time.replace(/\\./g, "");
					}

					// Return the post.
					resolve(post);
				}

				// No posts were found.
				else {
					reject("Post not found.");
				}
			})

			// Error.
			.catch(error => {
				reject(error);
			});
		});
	}
}

module.exports = MPForum;