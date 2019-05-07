module.exports = {
	name: "ping",
	group: "info",
	description: "See how long does it take for GalaxyBot to respond to a command.",

	execute: command => {
		command.channel.send("Pong.")
			.then(message => {
				const diff = message.createdAt.getTime() - command.message.createdAt.getTime();

				message.edit(`It took me **${diff} ms** to respond to your command, ${command.user}.`);
			})
			.catch(error => {
				console.log(error);
			});
	}
}