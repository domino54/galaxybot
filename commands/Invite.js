module.exports = {
	name: "invite",
	description: "Sends a link, which allows the user to add GalaxyBot to their server.",

	execute: command => {
		command.channel.send(
			`Want me to spice up things on your Discord server, ${command.user}? Use the link below! :sunglasses:\n` +
			`https://discordapp.com/oauth2/authorize?client_id=${command.galaxybot.client.user.id}&scope=bot&permissions=137456704`
		);
		command.botGuild.log("Sent a bot server invite URL.");
	}
}