const fs = require('fs');
const settingsDir = './guilds/';

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

		// Guild settings file.
		this.settings = false;
		this.settingsPath = settingsDir + this.id + '.json';
		this.readSettings();
	}

	/**
	 * Reloads guild settings from the disk.
	 */
	readSettings() {
		fs.readFile(this.settingsPath, 'utf8', (error, data) => {
			if (error) {
				//console.log(error);
				return;
			}

			try {
				var settings = JSON.parse(data);
				if (settings) this.settings = settings;
			}
			catch (exception) {
				console.log(exception);
			}
		});
	}

	/**
	 * Saves guild settings on disk.
	 */
	saveSettings() {
		if (!this.settings) {
			console.log('Could not save guild settings: ' + this.settingsPath);
			return;
		}

		fs.writeFile(this.settingsPath, JSON.stringify(this.settings), (error) => {
			if (error) {
				console.log(error);
				return;
			}
			console.log('Saved guild settings to file: ' + this.settingsPath);
		});
	}
}

module.exports = Guild;
