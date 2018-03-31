module.exports = {
	name: "playing",
	description: "Current number of users seen by the GalaxyBot, which are playing the given `game`.",

	execute: command => {
		// No game name given.
		if (command.arguments.length <= 0) {
			command.channel.send(`You have to specify name of the game you're looking for, ${command.user}. :rolling_eyes:`);
			command.botGuild.log("Game name not given.");
			return;
		}

		// Limit the name to 64 characters.
		let gameName = command.arguments.join(" ").substring(0, 64);
		let playedGames = [];

		// Count the users playing the game and get the full name.
		command.galaxybot.client.users.forEach((user, userID) => {
			if (userID == command.galaxybot.client.user.id) return;
			
			if (user.presence.game && user.presence.game.name.toLowerCase().match(gameName.toLowerCase())) {
				let targetGame;

				for (const game of playedGames) {
					if (game.name != user.presence.game.name) continue;
					targetGame = game;
					break;
				}

				// Increment the count.
				if (targetGame) targetGame.players++;

				// Register a new game.
				else playedGames.push({
					name: user.presence.game.name,
					type: user.presence.game.type,
					players: 1
				});
			}
		});

		// Get the most played game.
		let targetGame, nbPlayers = 0;

		for (const game of playedGames) {
			if (game.players < nbPlayers) continue;

			targetGame = game;
			nbPlayers = game.players;
			gameName = game.name;
		}

		// Escape forbidden stuff.
		gameName = gameName.replace(/\*/g, "");
		gameName = command.galaxybot.escapeMentions(gameName);

		// Get the target action.
		let actionType = ["playing", "streaming", "listening to", "watching"][targetGame ? targetGame.type : 0];

		switch (nbPlayers) {
			// We don't know anyone playing this.
			case 0 :
				command.channel.send(`I don't know any users ${actionType} **${gameName}** right now, ${command.user}. :rolling_eyes:`);
				break;
			
			// There is one user playing such game.
			case 1 :
				command.channel.send(`I know **one** user ${actionType} **${gameName}** right now, ${command.user}.`);
				break;
			
			// Moar users.
			default :
				command.channel.send(`I know **${nbPlayers}** users ${actionType} **${gameName}** right now, ${command.user}.`);
		}
		
		command.botGuild.log(`${nbPlayers} users playing requested game.`);
	}
}