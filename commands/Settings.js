const Discord = require("discord.js");

module.exports = {
	name: "settings",
	description: "Manage the GalaxyBot settings in the server. Anyone can view the bot settings, however only the GalaxyBot managers can edit them. See the documentation for the full settings list.",
	serverOnly: true,

	execute: command => {
		// No permissions to tweak guild settings.
		if (!command.botGuild.isGalaxyBotManager(command.member) && command.arguments[1]) {
			command.channel.send(`Sorry ${command.user}, you don't have permissions to edit my settings. :no_entry:`);
			command.botGuild.log("No permissions to change guild settings: " + command.user.tag);
			return;
		}

		// Get the setting params.
		const settingName = command.galaxybot.escapeMentions(command.arguments.shift());
		const settingValue = command.arguments[0] != undefined ? command.galaxybot.escapeMentions(command.arguments.join(" ")) : undefined;

		// Edit the guild setting.
		command.botGuild.editSetting(settingName, settingValue, command.galaxybot.config.settings[settingName], command.member).then(setting => {
			command.channel.send(new Discord.RichEmbed({
				title: setting.name,
				description: setting.description,
				fields: [{
					name: "Current value",
					value: setting.value !== undefined ? setting.value : "<undefined>",
					inline: true
				}, {
					name: "Default value",
					value: setting.default !== undefined ? setting.default : "<undefined>",
					inline: true
				}]
			}));

			if (setting.saved) {
				command.botGuild.log(`Saved settings of ${command.guild.name} to a file: "${setting.save}"`);
			}

			command.botGuild.log(`Showing value of the "${settingName}" setting.`);
		}).catch(error => {
			var errorMessage;

			switch (error) {
				// Unknown setting.
				case "unknown" :
					errorMessage = `Please provide a valid setting, ${command.user}. The available setting are: \`\`\`${command.botGuild.getSettingsList().join(", ")}\`\`\``;
					break;

				// Failed to save guild settings.
				case "saving failed" :
					errorMessage = "Failed to save the guild settings. Please contact my creator if this problem persists!";
					break;

				// Setting requires a boolean value.
				case "not boolean" :
					errorMessage = `This setting has to be a boolean, ${command.user}. Use \`true\` or \`false\`!`;
					break;

				// Incorrect prefix length.
				case "prefix length" :
					errorMessage = `Sorry ${command.user}, but the commands prefix should be between 1 and 5 characters long!`;
					break;

				// Duration exceeds the limit.
				case "invalid duration" :
					errorMessage = `The duration you specified doesn't fit the requirements, ${command.user}. Enter a value between \`0\` and \`3600\` seconds!`;
					break;

				// Setting required providing an action.
				case "incorrect action" :
					errorMessage = `Editing this setting requires you to specify the action you want to make, ${command.user}. Write enter \`add\` or \`remove\` before the target value!`;
					break;

				// Role not found in the guild.
				case "undefined role" :
					errorMessage = `Sorry ${command.user}, but I couldn't find the role you're trying to set. Make sure it exists and you've spelled its name correctly!`;
					break;

				// Target role is above the user's current role.
				case "higher role" :
					errorMessage = `Sorry ${command.user}, but it looks like you're trying to add or remove a role, which is your highest one, or even higher. You can only add or remove roles below your highest one.`;
					break;

				// Guild reached roles limit.
				case "too many roles" :
					errorMessage = `Sorry ${command.user}, but it seems like you've reached the roles limit in this server! You can only set up to 10 roles, which can manage me.`;
					break;

				// Role already is a GalaxyBot manager.
				case "role already set" :
					errorMessage = `Looks like this role is already able to manage GalaxyBot, ${command.user}.`;
					break;

				// Role is not a GalaxyBot manager.
				case "role not set" :
					errorMessage = `This role doen't have permissions to manage GalaxyBot, ${command.user}.`;
					break;

				// Channel not found in the guild.
				case "undefined channel" :
					errorMessage = `Sorry ${command.user}, but I couldn't find the channel you're trying to set. Make sure it exists, belongs to this server and you mentioned it properly!`;
					break;

				// Guild reached channels limit.
				case "too many channels" :
					errorMessage = `Sorry ${command.user}, but it seems like you've reached the channels limit for this setting! You can only set up to 10 channels, where music comands are whitelisted.`;
					break;

				// Channel is already whitelisted.
				case "channel already set" :
					errorMessage = `Looks like this music player commands are already whitelisted in this channel, ${command.user}.`;
					break;

				// Channel is not whitelisted.
				case "channel not set" :
					errorMessage = `Music player commands are not whitelisted in this channel, ${command.user}.`;
					break;

				// Bad words filter config.
				case "bad filter config" :
					errorMessage = "Incorrect words filter feature configuration. Please contact my creator to resolve this issue!";
					break;

				// Channel not found in the guild.
				case "word length" :
					errorMessage = `This word length doesn't match length requirement, try something between ${command.galaxybot.config.filter.min} and ${command.galaxybot.config.filter.max} characters.`;
					break;

				// Guild reached channels limit.
				case "too many words" :
					errorMessage = `Sorry ${command.user}, but it seems like you've reached the maximum number of filtered words (${command.galaxybot.config.filter.count}).`;
					break;

				// Channel is already whitelisted.
				case "word already set" :
					errorMessage = `This word is already set in the filter, ${command.user}.`;
					break;

				// Channel is not whitelisted.
				case "word not set" :
					errorMessage = `This word is not filtered, ${command.user}.`;
					break;

				// Unknown error.
				default : errorMessage = "An unknown error has occured while viewing or modifying guild settings. Please report the problem to my creator!";
			}

			// Send the error message.
			command.channel.send(errorMessage);
			command.botGuild.log("Error occured while editing settings: " + error);
		});
	}
}