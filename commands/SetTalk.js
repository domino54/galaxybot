module.exports = {
	name: "settalk",
	description: "Set the channel used to talk as the bot. For GalaxyBot creator only.",
	hidden: true,

	execute: command => {
		// Access denied.
		if (command.user.id != command.galaxybot.config.dommy) return;

		// No channel specified.
		if (command.arguments.length <= 0) {
			command.channel.send(`Sorry ${command.user}, but you have to give me ID of the channel.`);
			command.botGuild.log(`Channel not specified.`);
			return;
		}

		const channelId = command.arguments[0];
		const targetChannel = command.galaxybot.client.channels.get(channelId);

		// Channel not found.
		if (targetChannel === undefined) {
			command.channel.send(`Sorry ${command.user}, but the channel with ID **${channelId}** was not found. Make sure the ID is valid and I can access this channel.`);
			command.botGuild.log(`Channel with ID ${channelId} not found.`);
			return;
		}

		command.galaxybot.talkChannel = targetChannel;
		command.channel.send(`The talk channel has been set to ${targetChannel}.`);
		command.botGuild.log(`Talk channel set to #${targetChannel.name}.`);
	}
}