const Discord = require("discord.js");

module.exports = {
	name: "about",
	description: "Shows some details about the GalaxyBot.",

	execute: command => {
		const user = command.galaxybot.client.user;
		var member = command.guild ? command.guild.members.get(command.galaxybot.client.user.id) : undefined;

		command.channel.send(new Discord.RichEmbed({
			author: {
				name: user.tag,
				icon_url: user.avatarURL
			},
			description:
				"A Discord bot providing multiple integrations for Nadeo games in ManiaPlanet platform, capable of playing some music and doing other useless stuff. Sometimes behaves extremely impolitely, but that's just her nature.\n\n" +
				`**[Documentation](${command.galaxybot.config.github})** • ` +
				`**[Add to your server](https://discordapp.com/oauth2/authorize?client_id=${command.galaxybot.client.user.id}&scope=bot&permissions=137456704)**`,
			color: (member && member.displayColor > 0 ? member.displayColor : undefined),
			thumbnail: {
				url: user.avatarURL
			},
			fields: [{
				name: "Version",
				value: command.galaxybot.config.version,
				inline: true
			}, {
				name: "Updated at",
				value: command.galaxybot.config.vdate,
				inline: true
			}, {
				name: "Active servers",
				value: command.galaxybot.activeGuilds.size,
				inline: true
			}, {
				name: "Hella?",
				value: "Hella.",
				inline: true
			}],
			footer: {
				text: "Created by Dommy#7014"
			}
		}));
		command.botGuild.log("Sent information about GalaxyBot.");
	}
}