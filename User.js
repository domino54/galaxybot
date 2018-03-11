/**
 * The User class.
 * Stores information about an user of the bot.
 */
class User {
	/**
	 * Create an user object.
	 *
	 * @param {Snowflake} userId - Id of the new user to register.
	 */
	constructor(userId) {
		this.id = userId;
		this.name = "";

		this.annoyanceTimestamp = 0; ///< Later computed into annoyance level
		this.warnedForJoyEmoji = false;

		// Spamming good bot and bad bot
		this.empathyGoodBot = false;
		this.empathyBadBot = false;
		this.empathyChangeStreak = 0;

		// Interactive reactions.
		this.askedToCryChannel = false; ///< Channel snowflake
	}

	lowerKarma() {
		const now = Math.floor(Date.now() / 1000);

		if (this.annoyanceTimestamp <= now) this.annoyanceTimestamp = now + 30;
		this.annoyanceTimestamp += 60;
	}

	get annoyanceLevel() {
		const now = Math.floor(Date.now() / 1000);

		// Annoyance level is 0
		if (this.annoyanceTimestamp <= now) return 0;

		var diff = this.annoyanceTimestamp - now;
		return Math.floor(diff / 60);
	}
}

module.exports = User;