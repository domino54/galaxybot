const Discord = require("discord.js");

module.exports = {
	name: "avatar",
	description: "Shows your avatar in the full size, or the avatar of requested server member.",

	execute: command => {
		var targetUser = command.user;
		var userColor = undefined;

		// Find the matching member if in a guild and specified.
		if (command.guild && command.arguments.length >= 1) {
			const argument = command.galaxybot.escapeMentions(command.arguments.join(" "), command.message.mentions);

			// Find the target user.
			let targetMember = command.botGuild.findMember(argument, command.message.mentions);
			
			// User not found.
			if (!targetMember) {
				command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}** on this server. :rolling_eyes:`);
				command.botGuild.log(`Could not find user "${argument}".`);
				return;
			}

			targetUser = targetMember.user;
			userColor = targetMember.displayColor;
		}

		// User has no avatar.
		if (!targetUser.avatarURL) {
			command.channel.send(`Looks like \`${targetUser.tag.replace(/`/g, "")}\` doesn't have avatar image. :thinking:`);
			command.botGuild.log(`${targetUser.tag} has no avatar image.`);
			return;
		} 

		// Create a fancy embed.
		var embed = new Discord.RichEmbed({
			author: {
				name: targetUser.tag,
				icon_url: targetUser.avatarURL
			},
			image: {
				url: targetUser.avatarURL
			}
		})

		// Append the color.
		if (userColor) embed.setColor(userColor);

		// Send avatar.
		command.channel.send(embed);
		command.botGuild.log(`Sent avatar URL of ${targetUser.tag}.`);
	}
}