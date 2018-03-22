const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const youtubedl = require("youtube-dl");
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
		this.url = url;
		this.sourceURL = undefined;
		this.sender = sender;
		this.senderId = sender.id;
		this.class = undefined;
		this.type = "track";
		this.color = 0;
		this.embed = undefined;

		this.title = "Unknown";
		this.uniqueID = undefined;
		this.author = undefined;
		this.description = "";
		this.duration = 0;
		this.thumbnail = "";
		this.isLivestream = false;
		this.isLocalFile = false;

		// YouTube
		if (url.match(/https?:\/\/(www\.)?(youtube\.com\/(watch\?v=|embed\/)|youtu\.be\/)[\w-]{11}/i)) this.loadYouTube(callback);

		// SoundCloud
		else if (url.match(/https?:\/\/(www\.)?soundcloud\.com\//i)) this.loadSoundCloud(callback);

		// Mixcloud
		else if (url.match(/https?:\/\/(www\.)?mixcloud\.com\//i)) this.loadMixcloud(callback);

		// Vimeo
		else if (url.match(/https?:\/\/(www\.)?vimeo\.com\/[0-9]+/i)) this.loadVimeo(callback);

		// Dailymotion
		else if (url.match(/https?:\/\/(www\.)?dailymotion\.com\/video\/+/i)) this.loadDailymotion(callback);

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
	 * Get file information from local drive.
	 *
	 * @param {Function} callback - Function to call when the file info is obtained.
	 */
	loadLocalFile(callback) {
		this.sourceURL = this.url;
		this.class = "offline";
		this.type = "file";
		this.title = this.url.split(/\/|\\/).pop();
		this.isLocalFile = true;
		this.url = undefined;

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

				// File information.
				this.title = this.constructor.escapeMentions(this.title);
				this.duration = metadata.format.duration;

				// Create embed.
				this.embed = this.createEmbed();

				callback(this);
			}).catch(error => {
				callback("file-no-metadata");
			});
		});
	}

	/**
	 * Get video information from YouTube.
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

			// Video information.
			this.class = "youtube";
			this.type = info.livestream ? "livestream" : "video";
			this.title = this.constructor.escapeMentions(info.title);
			this.uniqueID = info.video_id;
			this.author = {
				name: info.author.name,
				url: info.author.user_url,
				icon_url: info.author.avatar
			}
			this.description = info.description;
			this.duration = info.length_seconds;
			this.thumbnail = "http://img.youtube.com/vi/" + info.video_id + "/mqdefault.jpg";
			this.isLivestream = info.livestream;

			// Create embed.
			this.color = 0xFF0000;
			this.embed = this.createEmbed();

			callback(this);
		});
	}

	/**
	 * Get media information via youtube-dl.
	 *
	 * @param {Function} callback - Function to call when information is obtained.
	 */
	loadCommon(callback) {
		youtubedl.getInfo(this.url, (error, info) => {
			if (error || !info.formats || info.formats.length <= 0) {
				callback(error, undefined);
				return;
			}

			console.log(info);

			// Track information.
			this.title = info.title;
			this.uniqueID = info.display_id;
			this.author = {
				name: info.uploader,
				url: info.uploader_url
			};
			this.description = info.description;
			this.thumbnail = info.thumbnail;

			// Translate duration into seconds.
			if (info.duration) {
				var explode = info.duration.split(":");
				var multiplier = 1;

				for (var i = explode.length - 1; i >= 0; i--) {
					var seg = parseInt(explode[i]) * multiplier;
					this.duration += seg;
					multiplier *= 60;
				}
			}

			callback(undefined, info);
		});
	}

	/**
	 * Get track information from SoundCloud.
	 *
	 * @param {Function} callback - Function to call when SoundCloud info is obtained.
	 */
	loadSoundCloud(callback) {
		this.loadCommon((error, info) => {
			if (error) {
				console.log(error);
				callback(false);
				return;
			}

			// Pick the best available format.
			var highestBitrate = 0;

			for (const format of info.formats) {
				if (format.abr < highestBitrate) continue;

				this.sourceURL = format.url;
				highestBitrate = format.abr;
			}

			// Track information.
			this.class = "soundcloud";
			this.author.icon_url = "https://cdn.iconscout.com/public/images/icon/free/png-512/soundcloud-social-media-3d8748562dbd11dc-512x512.png";

			// Create embed.
			this.color = 0xFF6600;
			this.embed = this.createEmbed();

			callback(this);
		});
	}

	/**
	 * Get video information from Vimeo.
	 *
	 * @param {Function} callback - Function to call when Vimeo info is obtained.
	 */
	loadVimeo(callback) {
		this.loadCommon((error, info) => {
			if (error) {
				console.log(error);
				callback(false);
				return;
			}

			// Pick the best available format.
			var highestBitrate = 0;

			for (const format of info.formats) {
				if (format.vcodec == "none" || format.asr < highestBitrate) continue;

				this.sourceURL = format.url;
				highestBitrate = format.abr;
			}

			// No formats available with audio only.
			if (!this.sourceURL) this.sourceURL = info.formats[0].url;

			// Track information.
			this.class = "vimeo";
			this.type = "video";
			this.author.icon_url = "https://www.iconsdb.com/icons/preview/caribbean-blue/vimeo-4-xxl.png";

			// Create embed.
			this.color = 0x1AB7EA;
			this.embed = this.createEmbed();

			callback(this);
		});
	}

	/**
	 * Get video information from Dailymotion.
	 *
	 * @param {Function} callback - Function to call when Dailymotion info is obtained.
	 */
	loadDailymotion(callback) {
		this.loadCommon((error, info) => {
			if (error) {
				console.log(error);
				callback(false);
				return;
			}

			// Pick the best available format.
			var highestBitrate = 0;

			for (const format of info.formats) {
				if (format.vcodec == "none" || format.asr < highestBitrate) continue;

				this.sourceURL = format.url;
				highestBitrate = format.abr;
			}

			// No formats available with audio only.
			if (!this.sourceURL) this.sourceURL = info.formats[0].url;

			// Track information.
			this.class = "dailymotion";
			this.type = "video";
			this.author.icon_url = "https://static1.dmcdn.net/images/dailymotion-logo-ogtag.png";

			// Create embed.
			this.color = 0x0064E0;
			this.embed = this.createEmbed();

			callback(this);
		});
	}

	/**
	 * Get mix information from Mixcloud.
	 *
	 * @param {Function} callback - Function to call when Mixcloud info is obtained.
	 */
	loadMixcloud(callback) {
		this.loadCommon((error, info) => {
			if (error) {
				console.log(error);
				callback(false);
				return;
			}

			// Pick the best available format.
			var highestBitrate = 0;
			
			for (const format of info.formats) {
				// Compute the duration.
				if (format.fragments) {
					console.log(format.fragments.length);
					for (const fragment of format.fragments) if (fragment.duration) this.duration += fragment.duration;
				}

				if (format.tbr < highestBitrate) continue;

				this.sourceURL = format.url;
				highestBitrate = format.tbr;
			}

			// Track information.
			this.class = "mixcloud";
			this.type = "mix";
			this.author.icon_url = "https://www.demand-its.com/wp-content/uploads/2014/12/mixcloud.png";

			// Create embed.
			this.color = 0x52AAD8;
			this.embed = this.createEmbed();

			callback(this);
		});
	}

	/**
	 * Get video information from Facebook.
	 *
	 * @param {Function} callback - Function to call when Facebook info is obtained.
	 */
	loadFacebook(callback) {
		const temp = this.url.match(/\/videos\/[0-9]+/)[0];
		const explode = temp.split("/");
		const videoID = explode.pop();

		FB.api("/" + videoID, { fields: ["source", "length", "from", "title", "picture", "live_status"] }, response => {
			if (!response || response.error) {
				console.log(!response ? "Facebook: Error occurred while getting track info." : response.error);
				callback("fb-no-info");
				return;
			}

			// Video information.
			this.class = "facebook";
			this.type = response.live_status ? "livestream" : "video";
			this.sourceURL = response.source;
			this.title = this.constructor.escapeMentions(response.title);
			this.uniqueID = videoID;
			this.author = {
				name: response.from.name,
				url: "https://www.facebook.com/" + response.from.id,
				icon_url: "http://graph.facebook.com/" + response.from.id + "/picture?type=normal"
			};
			this.duration = response.length;
			this.thumbnail = response.picture;
			this.isLivestream = response.live_status;

			// Create embed.
			this.color = 0x3B5998;
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
		const explode = this.url.split("/");
		const videoID = explode.pop();
		const videoURL = "https://api.streamable.com/videos/" + videoID;
		
		HTTPS.get(videoURL, response => {
			var body = "";
			response.on("data", (data) => { body += data; })
			response.on("end", () => {
				try {
					const info = JSON.parse(body);
					if (!info.files["mp4-mobile"]) {
						callback(undefined);
						return;
					}
					const file = info.files["mp4-mobile"];

					// Video information.
					this.class = "streamable";
					this.type = "video";
					this.sourceURL = "https:" + file.url;
					this.title = this.constructor.escapeMentions(info.title);
					this.uniqueID = videoID;
					this.author = {
						name: "Streamable",
						url: "https://streamable.com/",
						icon_url: "https://pbs.twimg.com/profile_images/601124726832955393/GYp5MlPf_400x400.png"
					};
					this.duration = file.duration;
					this.thumbnail = "https:" + info.thumbnail_url;

					// Create embed.
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

		// Track information.
		this.class = "online";
		this.type = "file";
		this.sourceURL = this.url;
		this.uniqueID = this.url;
		this.title = this.url.split("/").pop().replace(/_/g, " ");
		
		// Create embed.
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
			description: (this.isLivestream ? "Livestream" : "Duration: " + (this.duration > 0 ? this.constructor.timeToText(parseInt(this.duration)) : "unknown")),
			footer: {
				text: this.sender.displayName,
				icon_url: this.sender.user.avatarURL
			}
		}

		// Color only if not black.
		if (this.color > 0) embed.color = this.color;

		// Embed author if exists.
		if (this.author) embed.author = this.author;

		// URL only if valid.
		if (this.url) embed.url = this.url;

		return new Discord.RichEmbed(embed);
	}
}

module.exports = Track;