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

		this.rateLimitCount	= 0;
		this.rateLimitTriggered = false;
		this.rateLimitWarned = false;

		this.serverBrowsers = [];

		this.annoyanceTimestamp = 0; ///< Later computed into annoyance level
		this.warnedForJoyEmoji = false;

		// Spamming good bot and bad bot.
		this.empathyTowardsBot = 0;
		this.empathyChangeStreak = 0;

		// Interactive reactions.
		this.badBotResponseCh = false;
		this.helpResponseCh = false;
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

	/**
	 * Check if the user is being rate limited.
	 *
	 * @param {Number} increment - Seconds added to the rate limit per used command.
	 * @param {Number} max - Maximum seconds of rate limit before user commands are locked.
	 * @returns {Number} Number of seconds before user can send commands again.
	 */
	countRateLimit(increment, max) {
		const now = Date.now();

		// User is being rate limited once max limit duration is reached.
		if (this.rateLimitCount >= now + max) {
			this.rateLimitTriggered = true;
			return this.rateLimitCount - now;
		}

		// Rate limit still applies.
		else if (this.rateLimitTriggered && now < this.rateLimitCount) {
			return this.rateLimitCount - now;
		}

		// Reset warning.
		this.rateLimitWarned = false;
		this.rateLimitTriggered = false;

		// Restart rate limit counter.
		if (now > this.rateLimitCount) {
			this.rateLimitCount = now + increment;
		}

		// Increment rate limit counter.
		else {
			this.rateLimitCount += increment;
		}

		return 0;
	}

	/**
	 * Get whether we warned the user for being rate limited or not.
	 *
	 * @returns {Boolean} true, if the user has been warned for current rate limit excession.
	 */
	get wasRateWarned() {
		if (this.rateLimitWarned) return true;
		this.rateLimitWarned = true;
		return false;
	}
}

module.exports = User;