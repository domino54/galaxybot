/**
 * The Guild class.
 * Stores information about current music player status in given guild.
 */
class Guild {
	/**
	 * Create a guild object.
	 *
	 * @param {Snowflake} guildId - Id of the new quild to register.
	 */
	constructor(guildId) {
		this.id = guildId;
		this.name = '';
		this.lastTextChannel = false;
		this.voiceConnection = false;
		this.voiceDispatcher = false;
		this.currentTrack = false;
		this.tracksQueue = [];
	}

	// TODO: Put functions handling tracks queue here?
}

module.exports = Guild;
