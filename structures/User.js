/**
 * The User class.
 * Stores information about an user of the bot.
 */
class User {
	/**
	 * Create an user object.
	 *
	 * @param {User} user - Discord User object
	 * @param {GalaxyBot} galaxybot - GalaxyBot, obviously.
	 */
	constructor(user, galaxybot) {
		this.id = user.id;
		this.user = user;
		this.galaxybot = galaxybot;
		this.type = "user";

		this.annoyanceTimestamp = 0; ///< Later computed into annoyance level
		this.warnedForJoyEmoji = false;

		// Spamming good bot and bad bot
		this.empathyGoodBot = false;
		this.empathyBadBot = false;
		this.empathyChangeStreak = 0;

		// Interactive reactions.
		this.askedToCryChannel = false; ///< Channel snowflake
	}

	/**
	 * Log guild action in GalaxyBot logger.
	 *
	 * @param {string} text - The message to log.
	 */
	log(text) {
		this.galaxybot.log(this, text);
	}

	/**
	 * Get the color of the GalaxyBot. Always undefined.
	 *
	 * @returns {undefined} Undefined.
	 */
	get color() {
		return undefined;
	}

	/**
	 * Get the GalaxyBot default setting.
	 *
	 * @param {string} settingName - Name of the setting to get.
	 * @returns {*} Default value of the setting. `undefined` if not found.
	 */
	getSetting(settingName) {
		if (this.galaxybot.config.settings[settingName] !== undefined) return this.galaxybot.config.settings[settingName];
		return undefined;
	}

	/**
	 * Lower the user karma for even worse text responses.
	 */
	lowerKarma() {
		const now = Math.floor(Date.now() / 1000);

		if (this.annoyanceTimestamp <= now) this.annoyanceTimestamp = now + 30;
		this.annoyanceTimestamp += 60;
	}

	/**
	 * Get how much GalaxyBot hates the user.
	 */
	get annoyanceLevel() {
		const now = Math.floor(Date.now() / 1000);

		// Annoyance level is 0
		if (this.annoyanceTimestamp <= now) return 0;

		var diff = this.annoyanceTimestamp - now;
		return Math.floor(diff / 60);
	}
}

module.exports = User;