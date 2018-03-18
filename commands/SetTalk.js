module.exports = {
	name: "settalk",
	description: "Set the channel used to talk as the bot. For GalaxyBot creator only.",
	hidden: true,

	execute: command => {
		// Access denied.
		if (command.user.id != command.galaxybot.config.dommy) return;

		// No channel specified.
		if (command.arguments.length <= 0) {
			command.channel.send("Sorry <@" + command.user.id + ">, but you have to give me ID of the channel.");
			command.botGuild.log("Channel not specified.");
			return;
		}

		const channelId = command.arguments[0];
		var targetChannel;

		// Find the channel by its ID.
		this.activeGuilds.forEach((guild, guildId) => {
			if (targetChannel !== undefined) return;
			targetChannel = guild.guild.channels.get(channelId);
		});

		// Channel not found.
		if (targetChannel === undefined) {
			command.channel.send("Sorry <@" + command.user.id + ">, but the channel with ID **" + channelId + "** was not found. Make sure the ID is valid and I can access this channel.");
			command.botGuild.log("Channel not found: " + channelId);
			return;
		}

		command.galaxybot.talkChannel = targetChannel;
		command.channel.send("The talk channel has been set to <#" + channelId + ">.");
		command.botGuild.log("Talk channel set: #" + targetChannel.name);
	}
}