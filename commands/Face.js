const request = require("request");
const faceapp = require("faceapp");

module.exports = {
	name: "face",
	aliases: ["faceapp", "fa"],
	syntax: ["%", "% <filter> [url]"],
	group: "fun",
	description: "Apply a FaceApp filter on provided image. Type empty command to get the list of available filters.",

	execute: command => {
		// Get the filters list.
		if (command.arguments.length <= 0) {
			faceapp.listFilters(true).then(filters => {
				if (filters.length > 0) {
					filters = filters.sort();

					command.channel.send(
						"Provide `filter_name` to use this command with previously sent image. You can also send the command with an image attached or specify the URL directly. Example:" +
						`\`\`\`${command.botGuild.getSetting("prefix")}face smile http://i.imgur.com/xxxxx\`\`\`` +
						`The available filters are:\n\`\`\`${filters.join(" ")}\`\`\``
					);
				}

				else {
					command.channel.send(`Well, it looks like no filters are currently available, ${command.user}. :frowning:`);
				}

				command.botGuild.log(`Found ${filters.length} filters.`);
			})

			.catch(error => {
				command.channel.send(
					"An error occured while obtaining the list of filters:" +
					"```" + error + "```" +
					"If the problem persists, please contact my creator!"
				);
				command.botGuild.log("Error while obtaining filters list: " + error);
			});

			return;
		}

		/**
		 * Process the URL in FaceApp.
		 *
		 * @param {String} url - The URL to process.
		 */
		function face(url) {
			command.channel.startTyping();
			command.botGuild.log("Processing face: " + url);

			request({url: url, encoding: null}, (err, res, buffer) => {
				if (err) {
					command.channel.stopTyping();
					command.channel.send("A request error has occured while processing the image: ```" + err + "```");
					command.botGuild.log("A request error has occured while processing the image: " + err);
					return;
				}

				if (typeof buffer === "object") {
					faceapp.process(buffer, command.arguments[0]).then(image => {
						command.channel.stopTyping();
						command.channel.send({
							files: [{
								attachment: image,
								name: "result.jpg"
							}]
						});
					}).catch(error => {
						command.channel.stopTyping();
						command.channel.send("An API error has occured while processing the image: ```" + error + "```");
						command.botGuild.log("An API error has occured while processing the image: " + error);
					});
				}
			});
		}

		/**
		 * Find attachments or embeds and process one.
		 *
		 * @param {Message} message - The message to find an attachment or embed.
		 */
		function fetchMessage(message) {
			if (!message) return false;

			let imageFound = false;

			// Use an attachment of this message.
			message.attachments.forEach((attachment, attachmentID) => {
				if (imageFound) return;

				if (attachment.height > 0 && attachment.width > 0) {
					face(attachment.url);
					imageFound = true;
				}
			});

			if (imageFound) return true;

			// Use an embed of this message.
			for (const embed of message.embeds) {
				if (!embed.image) return;

				face(embed.image.url);
				imageFound = true;
				break;
			}

			return imageFound;
		}

		// Take the URL specified in the command.
		if (command.arguments.length >= 2) {
			face(command.arguments[1]);
		}

		else {
			// Use an attachment or embed of the command message.
			if (fetchMessage(command.message)) return;

			// Use an attachment or embed of previous message.
			command.channel.fetchMessages({limit: 20, before: command.message.id}).then(messages => {
				let imageFound = false;

				messages.forEach((message, messageID) => {
					if (imageFound) return;
					imageFound = fetchMessage(message);
				});

				if (!imageFound) {
					command.channel.send(`I couldn't find any recent message containing an image, ${command.user}. :shrug:`);
					command.botGuild.log("No recent messages with images.");
				}
			})
		}
	}
}