const Discord = require("discord.js");
const ManiaPlanet = require("./../integrations/ManiaPlanet.js");

module.exports = {
	name: "channel",
	description: "See what's currently being played on channels. Use `sm` for ShootMania channel and `tm` for TrackMania channel.",

	execute: command => {
		// Which channel?
		if (command.arguments.length <= 0) {
			command.channel.send(`Sorry ${command.user}, but I need to know if you want to view \`sm\` or \`tm\` channel. :thinking:`);
			command.botGuild.log("No channel specified.");
			return;
		}

		// Get channel.
		var channelId;

		switch (command.arguments[0]) {
			// ShootMania channel.
			case "sm" :
				channelId = "shootmania";
				break;
			
			// TrackMania channel.
			case "tm" :
				channelId = "trackmania";
				break;
			
			// Unknown channel.
			default : {
				command.channel.send(`Well, currently we have only two channels - \`sm\` and \`tm\`, ${command.user}. :shrug:`);
				command.botGuild.log(`Unknown channel: ${channelType}.`);
				return;
			}
		}

		// Get episodes from recent period.
		var endTime = parseInt(Date.now() / 1000);
		var startTime = endTime - 9000;

		command.botGuild.log(`Downloading current ${channelId} channel episodes.`);

		ManiaPlanet.episodes(channelId, startTime, endTime, episodes => {
			// No episodes found.
			if (!episodes || episodes.code || episodes.length <= 0) {
				command.channel.send(`Looks like there's nothing being played live in this channel right now. Or I ran into some issue again... :thinking:`);
				command.botGuild.log(`Channel ${channelId} empty or request error.`);
				return;
			}

			const program = episodes.pop().program;
			const programName = ManiaPlanet.stripFormatting(program.name);

			ManiaPlanet.title(program.title_uid, titleInfo => {
				// Title not found.
				if (!titleInfo || titleInfo.code == 404) {
					command.channel.send(`Sorry ${command.user}, I can't recognize the **${titleUid}** title... :shrug:`);
					command.botGuild.log(`Title "${titleUid}" not found.`);
					return;
				}

				var sentMessage = false;

				ManiaPlanet.servers({ "titleUids[]": program.title_uid, search: "channel:"}, serversInfos => {
					if (sentMessage || serversInfos.length <= 0) return;
					const serverInfo = serversInfos[0];

					// Send a fancy embed with current episode information.
					command.channel.send(new Discord.RichEmbed({
						author: {
							name: ManiaPlanet.stripFormatting(program.author.nickname),
							url: "https://www.maniaplanet.com/players/" + program.author.login
						},
						title: programName,
						url: "https://www.maniaplanet.com/programs/" + program.id,
						description: ManiaPlanet.stripFormatting(program.description),
						color: ManiaPlanet.getTitleColor(titleInfo.primary_color),
						image: {
							url: program.image_url
						},
						thumbnail: {
							url: titleInfo.card_url
						},
						fields: [{
							name: "Title pack",
							value: ManiaPlanet.stripFormatting(titleInfo.name),
							inline: true
						}, {
							name: "Players",
							value: serverInfo.player_count + " / " + serverInfo.player_max,
							inline: true
						}]
					}));

					command.botGuild.log(`Successfully sent ${programName} information.`);
					sentMessage = true;
				});
			});
		});
	}
}