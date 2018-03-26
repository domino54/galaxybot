const Discord = require("discord.js");

module.exports = {
	name: "avatar",
	description: "Shows your avatar in the full size, or the avatar of requested server member.",

	execute: command => {
		var targetUser = command.user;
		var userColor = command.guild ? command.member.displayColor : undefined;

		if (command.guild && command.arguments.length >= 1) {
			function escape(string) {
				return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
			};

			const argument = command.galaxybot.escapeMentions(command.arguments.join(" "));
			const expression = new RegExp(escape(argument), "i");
			const targetId = argument.match(/[0-9]+/);
			var matchingMembers = [];

			// Find member of matching tag.
			command.guild.members.forEach((member, memberId) => {
				if (memberId == targetId || member.user.tag.match(expression) || member.displayName.match(expression)) {
					matchingMembers.push(member);
				}
			});

			// Found someone.
			if (matchingMembers.length > 0) {
				const member = matchingMembers[0];

				targetUser = member.user;
				userColor = member.displayColor > 0 ? member.displayColor : undefined;
			}
			
			// No users found.
			else {
				command.channel.send(`Sorry ${command.user}, I couldn't find the user **${argument}** on this server. :rolling_eyes:`);
				command.botGuild.log(`Could not find user "${argument}".`);
				return;
			}
		}

		// User has no avatar.
		if (!targetUser.avatarURL) {
			command.channel.send(`Looks like \`${command.galaxybot.escapeMentions(targetUser.tag, command.message.mentions)}\` doesn't have avatar image. :thinking:`);
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