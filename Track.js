const Discord = require('discord.js');
const ytdl = require('ytdl-core');
const HTTPS = require('https');
const URL = require('url');

/**
 * The Track class.
 * Contains information about music track playable by the bot.
 */
class Track {
	/**
	 * Create a track.
	 *
	 * @param {String} url - The URL of the track to create.
	 * @param {GuildMember} sender - Person, who requested the track.
	 * @param {Function} callback - Function we gonna call when track is loaded.
	 */
	constructor(url, sender, callback) {
		this.sender = sender;
		this.url = url;
		this.author = 'Unknown';
		this.title = 'Unknown';
		this.thumbnail = '';
		this.duration = 0;
		this.color = 0x000000;
		this.embed = null;

		var hostname = URL.parse(url).hostname;
		if (!hostname) callback(false);

		// YouTube
		else if (hostname.toLowerCase().indexOf('youtube') >= 0) this.loadYouTube(callback);

		// Streamable
		else if (hostname.toLowerCase().indexOf('streamable') >= 0) this.loadStreamable(callback);

		// Unknown.
		else callback(false);
	}

	/**
	 * Get track information from YouTube.
	 *
	 * @param {Function} callback - Function to call when YouTube info is obtained.
	 */
	loadYouTube(callback) {
		try {
			this.stream = ytdl(this.url, {filter: 'audioonly'}); ///< TODO: Fix livestreams crashing the whole bot.
			this.stream.on("info", (info, format) => {
				if (!format) {
					callback(false);
					return;
				}

				this.author = {
					name: info.author.name,
					url: info.author.user_url,
					icon_url: info.author.avatar
				}
				this.title = info.title;
				this.thumbnail = info.thumbnail_url;
				this.duration = info.length_seconds;
				this.color = 0xCC181E;
				this.embed = this.createEmbed();

				callback(this);
			});
		}
		catch (error) {
			callback(false);
		}
	}

	/**
	 * Get video information from Streamable.
	 *
	 * @param {Function} callback - Function to call when Streamable info is obtained.
	 */
	loadStreamable(callback) {
		var temp = this.url.split('/');
		var videoURL = 'https://api.streamable.com/videos/' + temp[temp.length-1];

		var request = HTTPS.get(videoURL, response => {
			var body = '';
			response.on('data', (data) => { body += data; })
			response.on('end', () => {
				try {
					var info = JSON.parse(body);
					if (!info.files['mp4-mobile']) return callback(false);
					var file = info.files['mp4-mobile'];

					this.author = {
						name: 'Streamable',
						url: 'https://streamable.com/',
						icon_url: 'https://pbs.twimg.com/profile_images/601124726832955393/GYp5MlPf_400x400.png'
					};
					this.sourceURL = 'https:' + file.url;
					this.title = info.title;
					this.thumbnail = 'https:' + info.thumbnail_url;
					this.duration = parseInt(file.duration);
					this.color = 0x0F90FA;
					this.embed = this.createEmbed();

					callback(this);
				}
				catch (error) {
					callback(false);
				}
			})
		});
	}

	/**
	 * Format seconds into time.
	 * Thx to someone from Stack Exchange...
	 *
	 * @param {Number} time - The time to format.
	 * @returns {String} Nicely formatted time.
	 */
	timeToText(time) {
		var hours = ~~(time / 3600);
		var mins = ~~((time % 3600) / 60);
		var secs = time % 60;
		var output = "";

		if (hours > 0) output += '' + hours + ':' + (mins < 10 ? '0' : '');
		output += '' + mins + ':' + (secs < 10 ? '0' : '');
		output += '' + secs;
		return output;
	}

	/**
	 * Create a fancy embed used to display track information with style.
	 *
	 * @returns {RichEmbed} Embed containing track information.
	 */
	createEmbed() {
		return new Discord.RichEmbed({
			author: this.author,
			title: this.title,
			url: this.url,
			color: this.color,
			thumbnail: {
				url: this.thumbnail
			},
			description: this.timeToText(this.duration),
			footer: {
				text: this.sender.displayName,
				icon_url: this.sender.user.avatarURL
			}
		});
	}
}

module.exports = Track;