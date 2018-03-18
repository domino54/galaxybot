const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const metadata = require("music-metadata");
const HTTPS = require("https");
const URL = require("url");
const FB = require("fb");
const fs = require("fs");

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
	 * @param {Object} options - Function we gonna call when track is loaded.
	 */
	constructor(url, sender, callback, options) {
		// Available track properties.
		this.sender = sender;
		this.url = url;
		this.author = false;
		this.title = "Unknown";
		this.description = "";
		this.thumbnail = "";
		this.duration = 0;
		this.color = 0x000000;
		this.isLivestream = false;
		this.isLocalFile = false;
		this.embed = null;

		// YouTube
		if (url.match(/https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]{11}/i)) this.loadYouTube(callback);

		// Facebook
		else if (url.match(/https?:\/\/(www\.|web\.)?facebook\.com\/.*\/videos\/[0-9]+/i)) this.loadFacebook(callback);

		// Streamable
		else if (url.match(/https?:\/\/streamable\.com\/[a-z0-9]{5}/i)) this.loadStreamable(callback);

		// Local file.
		else if (url.match(/^[A-Z]:(\/|\\)/)) this.loadLocalFile(callback);
		
		// Online file.
		else if (url.match(/\.(mp3|ogg|wav|flac|m4a|aac|webm)$/i)) this.loadArbitrary(callback);

		// Unsupported.
		else callback("unsupported");
	}

	/**
	 * Get track information from local drive.
	 *
	 * @param {Function} callback - Function to call when the file info is obtained.
	 */
	loadLocalFile(callback) {
		this.sourceURL = this.url;
		this.title = this.url.split(/\/|\\/).pop();
		this.isLocalFile = true;
		this.url = false;

		// Check if we can access the file.
		fs.access(this.sourceURL, fs.constants.R_OK, fserror => {
			if (fserror) {
				console.log(fserror);
				callback("file-no-access");
				return;
			}

			// Obtain the track metadata.
			metadata.parseFile(this.sourceURL, { duration: true, skipCovers: true}).then(metadata => {
				// Track title.
				if (metadata.common.title) this.title = metadata.common.title;

				// Artist(s) name(s).
				var artistName = false;
				if (metadata.common.artist) artistName = metadata.common.artist;
				if (metadata.common.artists) artistName = metadata.common.artists.join(", ");
				if (artistName !== false) this.title = artistName + " - " + this.title;

				this.title = this.constructor.escapeMentions(this.title);
				this.duration = metadata.format.duration;
				this.embed = this.createEmbed();

				callback(this);
			}).catch(error => {
				callback("file-no-metadata");
			});
		});
	}

	/**
	 * Get track information from YouTube.
	 *
	 * @param {Function} callback - Function to call when YouTube info is obtained.
	 */
	loadYouTube(callback) {
		ytdl.getInfo(this.url, (error, info) => {
			if (error) {
				console.log(error);
				callback("ytdl-no-info");
				return;
			}

			// Create stream.
			try {
				this.stream = ytdl(this.url, (info.live_playback ? null : { filter: "audioonly" }));
				this.stream.on("info", info => {
					callback(this);
				});
			}
			catch (exception) {
				console.log(exception);
				callback("yt-stream-fail");
				return;
			}

			// Video information.
			this.author = {
				name: info.author.name,
				url: info.author.user_url,
				icon_url: info.author.avatar
			}
			this.title = this.constructor.escapeMentions(info.title);
			this.description = info.description;
			this.thumbnail = "http://img.youtube.com/vi/" + info.video_id + "/mqdefault.jpg";;
			this.duration = info.length_seconds;
			this.color = 0xCC181E;
			this.isLivestream = info.live_playback;
			this.embed = this.createEmbed();
		});
	}

	/**
	 * Get track information from Facebook.
	 *
	 * @param {Function} callback - Function to call when Facebook info is obtained.
	 */
	loadFacebook(callback) {
		var temp = this.url.match(/\/videos\/[0-9]+/)[0];
		var explode = temp.split("/");
		var videoId = explode.pop();

		FB.api("/"+videoId, { fields: ["source", "length", "from", "title", "picture", "live_status"] }, response => {
			if (!response || response.error) {
				console.log(!response ? "Facebook: Error occurred while getting track info." : response.error);
				callback("fb-no-info");
				return;
			}
			
			this.author = {
				name: response.from.name,
				url: "https://www.facebook.com/" + response.from.id,
				icon_url: "http://graph.facebook.com/" + response.from.id + "/picture?type=normal"
			};
			this.sourceURL = response.source;
			this.title = this.constructor.escapeMentions(response.title);
			this.thumbnail = response.picture;
			this.duration = response.length;
			this.color = 0x4267B2;
			this.isLivestream = response.live_status;
			this.embed = this.createEmbed();

			callback(this);
		});
	}

	/**
	 * Get video information from Streamable.
	 *
	 * @param {Function} callback - Function to call when Streamable info is obtained.
	 */
	loadStreamable(callback) {
		var explode = this.url.split("/");
		var videoURL = "https://api.streamable.com/videos/" + explode.pop();
		
		HTTPS.get(videoURL, response => {
			var body = "";
			response.on("data", (data) => { body += data; })
			response.on("end", () => {
				try {
					var info = JSON.parse(body);
					if (!info.files["mp4-mobile"]) {
						callback(undefined);
						return;
					}
					var file = info.files["mp4-mobile"];

					this.author = {
						name: "Streamable",
						url: "https://streamable.com/",
						icon_url: "https://pbs.twimg.com/profile_images/601124726832955393/GYp5MlPf_400x400.png"
					};
					this.sourceURL = "https:" + file.url;
					this.title = this.constructor.escapeMentions(info.title);
					this.thumbnail = "https:" + info.thumbnail_url;
					this.duration = file.duration;
					this.color = 0x0F90FA;
					this.embed = this.createEmbed();

					callback(this);
				}
				catch (error) {
					callback("streamable-error");
				}
			})
		});
	}

	/**
	 * Add an arbitrary file.
	 *
	 * @param {Function} callback - Function to call when track info is ready.
	 */
	loadArbitrary(callback) {
		if (!URL.parse(this.url).hostname) {
			callback(undefined);
			return;
		}

		this.sourceURL = this.url;
		this.title = this.url.split("/").pop().replace(/_/g, " ");
		this.color = 0x1A96CA;
		this.embed = this.createEmbed();

		callback(this);
	}

	/**
	 * Format seconds into time.
	 * Thx to someone from Stack Exchange...
	 *
	 * @param {Number} time - The time to format.
	 * @returns {String} Nicely formatted time.
	 */
	static timeToText(time) {
		var hours = ~~(time / 3600);
		var mins = ~~((time % 3600) / 60);
		var secs = time % 60;
		var output = "";

		if (hours > 0) output += "" + hours + ":" + (mins < 10 ? "0" : "");
		output += "" + mins + ":" + (secs < 10 ? "0" : "");
		output += "" + secs;
		return output;
	}

	/**
	 * Remove mentions from the string.
	 *
	 * @param {String} text - The text to escape.
	 * @returns {String} The escaped string.
	 */
	static escapeMentions(text) {
		if (typeof text !== "string") return "";
		
		var output = text;
		output = output.replace(/@everyone/i, "everyone");
		output = output.replace(/@here/i, "here");
		return output;
	}

	/**
	 * Create a fancy embed used to display track information with style.
	 *
	 * @returns {RichEmbed} Embed containing track information.
	 */
	createEmbed() {
		var embed = {
			title: this.title,
			thumbnail: {
				url: this.thumbnail
			},
			description: (this.isLivestream ? "Livestream" : "Duration: " + this.constructor.timeToText(parseInt(this.duration))),
			footer: {
				text: this.sender.displayName,
				icon_url: this.sender.user.avatarURL
			}
		}

		// Color only if not black.
		if (this.color != 0x000000) embed.color = this.color;

		// Embed author if exists.
		if (this.author !== false) embed.author = this.author;

		// URL only if valid.
		if (this.url !== false) embed.url = this.url;

		return new Discord.RichEmbed(embed);
	}
}

module.exports = Track;