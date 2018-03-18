module.exports = {
	name: "time",
	description: "Current time of the machine GalaxyBot is running on.",

	execute: command => {
		const date = new Date();
		const hours = date.getHours(), mins = date.getMinutes(), minute = mins + hours * 60;
		const time = hours + ":" + (mins >= 10 ? mins : "0" + mins);

		command.botGuild.log("GalaxyBot server hour: " + time);

		// Display time in direct messages.
		if (command.botGuild.type != "guild") {
			command.channel.send("It's **" + time + "** for me!");
			return;
		}

		// Bother with a few responses on servers.
		var diff = minute - command.botGuild.latestTimeMinute;
		command.botGuild.latestTimeMinute = minute;

		// Reset the repeating time streak.
		if (diff == 0) command.botGuild.sameTimeStreak += 1;
		else command.botGuild.sameTimeStreak = 0;
		
		// The AI is an asshole?
		switch (command.botGuild.sameTimeStreak) {
			case 0 : {
				if (diff == 1) {
					command.channel.send("Wow, it's **" + time + "** now. Who'd have guessed one minute has passed.");
				} else if (diff <= 5) {
					command.channel.send("Wow, it's **" + time + "** now. Who'd have guessed " + diff + " minutes have passed.");
				} else {
					command.channel.send("It's **" + time + "** for me!");
				}

				break;
			}

			case 1 :
				command.channel.send("It's still **" + time + "**.");
				break;

			case 2 :
				command.channel.send("Are you dumb or what?");
				break;

			case 3 :
				command.channel.send("Fuck off.");
				break;
		}
	}
}