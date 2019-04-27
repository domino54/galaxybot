const fs = require("fs");

module.exports = {
	name: "logs",
	group: "own",
	description: "Sends the whole log file through a private message. Owner access only.",
	hidden: true,
	owner: true,

	execute: command => {
		fs.access(command.galaxybot.config.logfile, (err) => {
			if (err) {
				command.channel.send(`Failed to send logs file: \`\`\`${err}\`\`\``);
				command.botGuild.log("Failed to send logs file: " + err);
			}

			else {
				command.user.send({files: [{
					attachment: command.galaxybot.config.logfile,
					name: command.galaxybot.config.logfile
				}]});
				command.botGuild.log("Logs file sent.");
			}
		});
	}
}