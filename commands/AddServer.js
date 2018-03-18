module.exports = {
	name: "addserver",
	description: "Add a ManiaPlanet server status to the statuses channel. Up to 10 servers will be detected and updated.",
	serverOnly: true,

	execute: command => {
		// No permissions to add a server.
		if (!command.botGuild.isGalaxyBotManager(command.member)) {
			command.channel.send("Sorry <@" + command.user.id + ">, you're not permitted to add a ManiaPlanet server status. :no_entry:");
			command.botGuild.log("No permissions to add a ManiaPlanet server status.");
			return;
		}

		const channelId = command.botGuild.getSetting("servers-status");

		// The channel is not set.
		if (channelId === undefined || !command.guild.channels.has(channelId)) {
			const prefix = command.botGuild.getSetting("prefix");
			command.channel.send("Looks like the the channel for ManiaPlanet servers statuses is not set. Use `" + prefix + "settings servers-status #channel` to set the channel up!");
			command.botGuild.log("ManiaPlanet server status channel is not set.");
			return;
		}

		var targetChannel = command.guild.channels.get(channelId);

		const serverLogin = command.galaxybot.escapeMentions(command.arguments.join(" ").substring(0, 25));
		targetChannel.send("mpserver:" + serverLogin);
		command.botGuild.log("ManiaPlanet server status added: " + serverLogin);

		// Trigger the statuses update right now.
		command.botGuild.updateServersStatuses();
	}
}