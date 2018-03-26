const ManiaPlanet = require("./../integrations/ManiaPlanet.js");
const Track = require("./Track.js");
const Discord = require("discord.js");
const ytdl = require("ytdl-core");
const yt_search = require("youtube-search");
const yt_playlist = require("youtube-playlist-info");
const fs = require("fs");
const settingsDir = "./guilds/";

// List of all available settings of a guild.
const availableSettings = new Map([
	["prefix",			"Character used to indicate commands."],
	["embed-mx",		"Detect and send Mania Exchange links."],
	["embed-titles",	"Detect and send ManiaPlanet titles links."],
	["embed-maps",		"Detect and send ManiaPlanet maps links."],
	["roles",			"Roles with permissions to manage the GalaxyBot settings and music player."],
	["max-duration",	"Maximum duration (in seconds) of music tracks users without full permissions can play. 0 = no limit."],
	["music-cmd-ch",	"The only channels, where music player commands are accepted."],
	["stalk-edits",		"Mock members for editing their messages."],
	["limit-access",	"Disable music player commands for users without enough rights."],
	["enable-filter",	"Enable or disable the words filtering feature of the GalaxyBot. Requires GalaxyBot to have the **Manage messages** permission in text channels for messages and roles filtering, as well as **Manage nicknames** for nicknames filtering."],
	["filtered-words",	"Remove messages, reactions and nicknames containing one (or more) of following words."],
	["filter-admins",	"Whether the word filter should work on administrators and GalaxyBot managers."],
	["text-responses",	"Let GalaxyBot react with some preprogrammed responses to messages."],
	["mocking-joy",		"Make fun of people, who tend to overuse the 😂 joy emoji."],
	["servers-status",	"Text channel, where GalaxyBot will post and update statuses of selected ManiaPlanet servers, added using the `addserver` command. Up to 10 latest messages sent in the channel will show a status below them."]
]);

/**
 * The Guild class.
 * Stores information about current music player status in given guild.
 */
class Guild {
	/**
	 * Create a guild object.
	 *
	 * @param {Guild} guild - Discord Guild object.
	 * @param {GalaxyBot} galaxybot - GalaxyBot, obviously.
	 */
	constructor(guild, galaxybot) {
		this.id = guild.id;
		this.guild = guild;
		this.galaxybot = galaxybot;
		this.type = "guild";

		// Music player.
		this.lastTextChannel = undefined;
		this.voiceConnection = undefined;
		this.voiceDispatcher = undefined;
		this.activeStream = undefined;

		// Tracks queue.
		this.currentTrack = undefined;
		this.tracksQueue = [];
		this.pendingTimers = [];
		this.lastStop = 0;

		// Behaviour.
		this.latestTimeMinute = -1;
		this.sameTimeStreak = 0;
		this.lastServersUpdate = 0;
		this.nextPurgeAllowed = 0;

		// Guild settings file.
		this.settings = new Object();
		this.settingsPath = settingsDir + this.id + ".json";
		this.readSettings();
	}

	/**
	 * Reloads guild settings from the disk.
	 */
	readSettings() {
		fs.readFile(this.settingsPath, "utf8", (error, data) => {
			if (error) {
				//console.log(error);
				return;
			}

			try {
				this.settings = JSON.parse(data);
				if (typeof this.settings !== "object") this.settings = new Object();
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
		var contents = JSON.stringify(this.settings);
		if (contents === undefined) contents = "{}";

		fs.writeFile(this.settingsPath, contents, error => {
			if (error) console.log(error);
		});

		return this.settingsPath;
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
	 * Get the color of the GalaxyBot highest role.
	 *
	 * @returns {number} The GalaxyBot color.
	 */
	get color() {
		if (!this.guild) return undefined;

		const member = this.guild.members.get(this.galaxybot.client.user.id);
		return member && member.displayColor > 0 ? member.displayColor : undefined;
	}

	/**
	 * Check if a member is the guild administrator.
	 *
	 * @param {GuildMember} member - The member to check.
	 * @returns {boolean} `true`, if member is an administrator, `false` otherwise.
	 */
	isAdministrator(member) {
		if (!member || !this.guild.members.has(member.id)) return false;
		return member.id == this.ownerID || member.hasPermission("ADMINISTRATOR");
	}

	/**
	 * Check if a member is a GalaxyBot manager.
	 *
	 * @param {GuildMember} member - The member to check.
	 * @returns {boolean} `true`, if member can manage GalaxyBot, `false` otherwise.
	 */
	isGalaxyBotManager(member) {
		if (!member) return false;
		if (this.isAdministrator(member) || member.id == this.galaxybot.config.dommy) return true;
		if (!this.settings || !this.settings.roles) return false;

		for (const roleId of this.settings.roles) {
			if (member.roles.has(roleId)) return true;
		}
	}

	createRolesList() {
		if (!this.settings || !this.settings.roles) return undefined;

		var rolesNames = [];

		this.guild.roles.forEach((role, snowflake) => {
			if (this.settings.roles.includes(snowflake)) rolesNames.push(role.name);
		});

		if (rolesNames.length <= 0) return undefined;
		return rolesNames;
	}

	/**
	 * Check if the music player has limited access.
	 *
	 * @returns {boolean} `true`, if the music player is limited, `false` otherwise.
	 */
	isPlayerLimitedAccess() {
		return this.settings && this.settings["limit-access"] === true;
	}

	/**
	 * Set if the music player has limited access.
	 *
	 * @param {boolean} limitAccess - If `true`, music player will be limited.
	 */
	setPlayerLimitedAccess(limitAccess) {
		// Enable.
		if (limitAccess === true) this.settings["limit-access"] = true;
		
		// Disable.
		else if (this.settings["limit-access"]) {
			delete this.settings["limit-access"];
		}

		var savedToFile = this.saveSettings();
	}

	/**
	 * Looks for next track in the queue and it finds any, plays it.
	 */
	playNextTrack() {
		if (this.currentTrack !== undefined) return;

		this.log("Next track playback requested.");

		// Leave voice channel if queue is empty.
		if (this.tracksQueue.length <= 0) {
			if (this.voiceConnection) {
				this.voiceConnection.disconnect();
				this.log("Queue empty, leaving the voice channel.");
			}
			return;
		}

		// Pick first track from the queue.
		this.currentTrack = this.tracksQueue.shift();

		// This can happen. Often.
		if (this.voiceConnection === undefined) {
			this.lastTextChannel.send("I'm not in a voice channel. Something must've gone wrong...");
			this.log("Not in a voice channel.");
			return;
		}

		// Create a voice dispatcher.
		try {
			this.log("Creating a new voice dispatcher.");
			const streamOptions = { passes: 3, bitrate: 44100 };

			switch (this.currentTrack.class) {
				// Create a stream of YouTube video.
				case "youtube" : {
					this.activeStream = ytdl(this.currentTrack.url, (this.currentTrack.isLivestream ? null : { filter: "audioonly" }));

					this.voiceDispatcher = this.voiceConnection.playStream(this.activeStream, streamOptions);

					this.activeStream.on("error", error => {
						console.log(error);
					});

					break;
				}

				// Offline file.
				case "offline" : {
					this.voiceDispatcher = this.voiceConnection.playFile(this.currentTrack.sourceURL, streamOptions);
					break;
				}

				// All other services are online files.
				default : {
					this.voiceDispatcher = this.voiceConnection.playArbitraryInput(this.currentTrack.sourceURL, streamOptions);
				}
			}
		}

		// Super handy error logging.
		catch (error) {
			this.lastTextChannel.send(`Something must've gone wrong with last ${this.currentTrack.type}, I couldn't play it... \`\`\`${error}\`\`\``);
			this.log("A problem has occured while trying to play track: " + error);
			this.currentTrack = undefined;
			
			setTimeout(() => { this.playNextTrack(); }, 250);
			return;
		}

		// Play next track once voice dispatcher ends.
		this.voiceDispatcher.on("end", reason => {
			this.log("Voice dispatcher end: " + reason);
			if (this.activeStream) this.activeStream.destroy();

			this.currentTrack = undefined;
			this.voiceDispatcher = undefined;
			this.activeStream = undefined;

			// Delay is necessary for slower connections to don't skip next track immediately.
			setTimeout(() => { this.playNextTrack(); }, 250);
		});

		this.voiceDispatcher.on("error", error => {
			console.log(error);
		});

		// Show what's currently being played.
		var header = this.currentTrack.isLivestream
			? `I'm tuned up for the livestream, <@${this.currentTrack.senderId}>! :red_circle:`
			: `I'm playing your ${this.currentTrack.type} now, <@${this.currentTrack.senderId}>! :metal:`;

		this.lastTextChannel.send(header, this.currentTrack.embed);
		this.log("Now playing: " + this.currentTrack.title);
	}

	/**
	 * Fired when a new track has been created.
	 *
	 * @param {Track} track - Newly created track.
	 * @param {GuildMember} member - Member, which has requested the track.
	 * @param {string} url - The URL of the track source.
	 * @param {Object} options - The track creation options.
	 */
	onTrackCreated(track, member, url, options) {
		if (!member || (!this.voiceConnection && !member.voiceChannel)) return;
		if (this.lastStop > 0 && Date.now() - this.lastStop < 1000) return; // Playlist spam prevention.

		// Queue has reached the limit.
		const maxQueueLength = !isNaN(this.galaxybot.config.maxqueue) ? this.galaxybot.config.maxqueue : 0;
		if (maxQueueLength > 0 && this.tracksQueue.length >= maxQueueLength) return;

		var errorMessage, hasPermissions = this.isGalaxyBotManager(member);

		// Track options.
		const isSilent	= options && options.silent === true;
		const isNext	= options && options.next === true;
		const isNow		= options && options.now === true;

		// The possible error codes upon track creation.
		switch (track) {
			// Let's just ignore the fact we're in "onTrackCreated" method - track has been not created.
			case undefined : {
				errorMessage = `Sorry ${member}, but I can't play anything from that link. :shrug:`;
				this.log(`Track "${url}" not added: no information.`);
				break;
			}

			// Unsupported link type.
			case "unsupported" : {
				errorMessage = `I can't play that resource, ${member}. Make sure you're requesting something from SoundCloud, Mixcloud, YouTube, Vimeo, Dailymotion, Facebook, Streamable, a YouTube playlist or uploading a music file attachment. :rolling_eyes:\n\`\`\`Error code: ${track}\`\`\``;
				this.log(`Track "${url}" not added: unsupported host.`);
				break;
			}

			// ytdl-core failed us again.
			case "ytdl-no-info" : {
				errorMessage = `Sorry ${member}, I couldn't obtain information about your YouTube video. :cry:\n\`\`\`Error code: ${track}\`\`\``;
				this.log(`Track "${url}" not added: failed to obtain YouTube video information.`);
				break;
			}

			// No information from Facebook.
			case "fb-no-info" : {
				errorMessage = `Sorry ${member}, I couldn't obtain information about your Facebook video. :cry:\n\`\`\`Error code: ${track}\`\`\``;
				this.log(`Track "${url}" not added: failed to obtain Facebook video information.`);
				break;
			}

			// No access to the file.
			case "file-no-access" : {
				errorMessage = `Sorry ${member}, looks like I don't have access to this file, or it doesn't exist. :|\n\`\`\`Error code: ${track}\`\`\``;
				this.log(`Track "${url}" not added: no file access.`);
				break;
			}

			// No music metadata.
			case "file-no-metadata" : {
				errorMessage = `Sorry ${member}, I couldn't obtain the file's metadata. :cry:\n\`\`\`Error code: ${track}\`\`\``;
				this.log(`Track "${url}" not added: failed to obtain file metadata.`);
				break;
			}
		}

		// Send the error message.
		if (errorMessage && !isSilent) {
			this.lastTextChannel.send(errorMessage);
		}

		if (typeof track !== "object") return;

		// The track is currently playing.
		if (this.currentTrack && this.currentTrack.uniqueID == track.uniqueID) {
			if (!isSilent) this.lastTextChannel.send(`I'm playing **${track.title}** right now, ${member}. You can request something else. :wink:`);
			this.log(`Track "${track.title}" not added: the same ID is currently played.`);
			return;
		}

		// The track already exists in the queue.
		var alreadyAdded = -1;

		for (var i = 0; i < this.tracksQueue.length; i++) {
			const request = this.tracksQueue[i];

			if (request.uniqueID != track.uniqueID) continue;

			alreadyAdded = i;
			break;
		}

		if (alreadyAdded >= 0) {
			if (!isSilent) this.lastTextChannel.send(`**${track.title}** is already **#${alreadyAdded + 1}** in the queue, ${member}. You can request something else. :wink:`);
			this.log(`Track "${track.title}" not added: exists in the queue with the same ID.`);
			return;
		}

		// User without permissions attempts to play livestream.
		if (track.isLivestream && !hasPermissions) {
			if (!isSilent) this.lastTextChannel.send(`Sorry ${member}, you don't have permissions to add livestreams. :point_up:`);
			this.log(`Track "${track.title}" not added: no permission to play livestream.`);
			return;
		}

		// Track has unspecified duration.
		if (!hasPermissions && track.duration <= 0) {
			if (!isSilent) this.lastTextChannel.send(`Sorry ${member}, you don't have permissions to add requests with unspecified duration. :rolling_eyes:`);
			this.log(`Track "${track.title}" not added: duration unspecified.`);
			return;
		}

		// Track is too long and user has no permission to surpass the limit.
		const maxDuration = this.getSetting("max-duration");

		if (!hasPermissions && maxDuration > 0 && track.duration > maxDuration) {
			if (!isSilent) this.lastTextChannel.send(`Sorry ${member}, **${track.title}** is too long! (${Track.timeToText(track.duration)} / ${Track.timeToText(maxDuration)}) :rolling_eyes:`);
			this.log(`Track "${track.title}" not added: too long (${track.duration} / ${maxDuration}).`);
			return;
		}

		// DES-PA-CITO.
		if (track.title && track.title.match(/despacito/i)) {
			if (!isSilent) this.lastTextChannel.send("Anything related to \"Despacito\" is FUCKING BLACKLISTED. :middle_finger:");
			this.log(`Track "${track.title}" not added: blacklisted.`);
			return;
		}

		this.log("Track successfully added: " + track.title);

		// Queue new track.
		if (isNext && hasPermissions) {
			if (isNow) this.lastTextChannel.send(`Okay ${member}, let's play it right now! :smirk:`);
			this.log("Track is forced next in the queue.");
			this.tracksQueue.unshift(track);
		}

		// No permissions to insert at the beginning of the queue.
		else {
			if (isNext) this.lastTextChannel.send(`Sorry ${member}, you can't queue ${track.type} next, nor play it immediately. :rolling_eyes:`);
			this.tracksQueue.push(track);
		}

		// Create a new voice connection, if there is none.
		if (this.voiceConnection === undefined) {
			/*
			member.voiceChannel.join().then(connection => {
				this.voiceConnection = connection;
				this.playNextTrack();
				this.log("Created new voice connection.");
				
				connection.on("disconnect", () => {
					this.voiceConnection = undefined;
					this.log("Disconnected from voice.");
				});

				connection.on("failed", error => {
					console.log(error);
				});

				connection.on("error", error => {
					console.log(error);
				});
			})
			.catch(error => {
				console.log(error);
			});
			*/

			// Workaround for the instant skip problem.
			member.voiceChannel.join();
			this.voiceConnection = this.guild.voiceConnection;

			this.voiceConnection.on("ready", () => {
				this.playNextTrack();
				this.log("Created new voice connection.");
			});
				
			this.voiceConnection.on("disconnect", () => {
				this.voiceConnection = undefined;
				this.log("Disconnected from voice.");
			});

			this.voiceConnection.on("error", error => {
				console.log(error);
			});
		}

		// Somehow we are in a voice channel, but nothing is being played.
		else if (!this.currentTrack) this.playNextTrack();

		// Play the track right now.
		else if (options && options.isNow === true && hasPermissions && this.voiceDispatcher) {
			this.voiceDispatcher.end();
			this.log("Skipping directly to the requested track.");
		}
		
		// Show queue message.
		else if (!isSilent) {
			var position = this.tracksQueue.indexOf(track) + 1;
			this.lastTextChannel.send(`${member}, your ${track.type} is **#${position}** in the queue:`, track.embed);
		}
	}

	/**
	 * Load videos of a YouTube playlist as tracks.
	 *
	 * @param {string} playlistID - The YouTube playlist ID.
	 * @param {GuildMember} member - Member, who started adds the playlist.
	 * @returns {Promise<number>} A promise with number of tracks in playlist.
	 */
	loadPlaylist(playlistID, member) {
		return new Promise((resolve, reject) => {
			// Can't search in YouTube: API token not provided.
			if (!this.galaxybot.isYouTubeAvailable) {
				reject("yt unavailable");
				return;
			}

			const maxResults = this.galaxybot.config.youtube.maxplaylist;
			const options = { maxResults: (maxResults > 0 ? maxResults : 0) };

			yt_playlist(this.galaxybot.config.youtube.token, playlistID, options).then(items => {
				this.log(`Found ${items.length} videos in playlist ${playlistID}.`);

				for (var i = 0; i < items.length; i++) {
					const videoURL = "https://www.youtube.com/watch?v=" + items[i].resourceId.videoId;
					const delay = i * 100;

					let timer = setTimeout(() => {
						var track = new Track(videoURL, member, track => {
							this.onTrackCreated(track, member, videoURL, { silent: true });
						});

						timer.stopped = true;
						this.pendingTimers = this.pendingTimers.filter(item => !item.stopped);
					}, delay);

					timer.senderID = member.id;
					timer.stopped = false;

					this.pendingTimers.push(timer);
				}

				resolve(items.length);
			}).catch(error => {
				console.log(error);
				reject(error);
			});
		});
	}

	/**
	 * Search for a video or a playlist in YouTube and add first result.
	 *
	 * @param {string} query - The YouTube search query.
	 * @param {GuildMember} member - Member, who started the search.
	 * @returns {Promise<number>} A promise with number of tracks in playlist, 0 if a single video.
	 */
	searchYouTube(query, member) {
		return new Promise((resolve, reject) => {
			// Query is too short.
			if (typeof query !== "string" || query.length <= 0) {
				reject("bad query");
				return;
			}

			// Can't search in YouTube: API token not provided.
			if (!this.galaxybot.isYouTubeAvailable) {
				reject("yt unavailable");
				return;
			}

			var options = {
				maxResults: 10,
				key: this.galaxybot.config.youtube.token
			};

			yt_search(query, options, (error, results) => {
				if (error) {
					console.log(error);
					reject("search error");
					return;
				}

				var hasResult = false;

				// Iterate the results.
				for (const result of results) {
					// Play first found video.
					if (result.kind === "youtube#video") {
						var track = new Track(result.link, member, track => {
							this.onTrackCreated(track, member, result.link);
						});

						resolve(0);
						break;
					}

					// Add first found playlist.
					else if (result.kind === "youtube#playlist") {
						this.loadPlaylist(result.id, member).then(nbItems => {
							resolve(nbItems);
						}).catch(error => {
							reject(error);
						});

						hasResult = true;
						break;
					}
				}

				if (!hasResult) reject("no results");
			});
		});
	}

	/**
	 * Update the statuses of the ManiaPlanet servers in the guild.
	 */
	updateServersStatuses() {
		// Get the setting.
		const channelId = this.getSetting("servers-status");
		if (channelId === undefined) return;

		// Guild has a timeout.
		const timestamp = Date.now();
		if (timestamp <= this.galaxybot.lastServersUpdate + this.galaxybot.config.mpstatus.timeout) return;
		this.galaxybot.lastServersUpdate = timestamp;

		// Get the target channel.
		var targetChannel = this.guild.channels.get(channelId);

		if (targetChannel === undefined || targetChannel.type != "text") return;

		// Fetch channel messages.
		targetChannel.fetchMessages({ length: 10 }).then(messages => {
			messages.forEach((message, messageId) => {
				if (message.author.id != this.galaxybot.client.user.id || !message.content.startsWith("mpserver:")) return;

				var serverLogin = message.content.replace("mpserver:", "");

				// Obtain information about the server.
				ManiaPlanet.serverInfo(serverLogin, response => {
					// Server not found.
					if (response.length <= 0) {
						message.edit(message.content, new Discord.RichEmbed({
							title: "Server not found",
							color: 0xFF0000
						}));
						return;
					}
					
					const serverInfo = response[0];
					
					ManiaPlanet.title(serverInfo.title, titleInfo => {
						message.edit(message.content, ManiaPlanet.createServerEmbed(serverInfo, titleInfo));
					});
				});
			});
		})
		.catch(error => {
			console.log(error);
		});
	}

	/**
	 * Find occurences of the filtered words in a string.
	 *
	 * @param {String} content - The string to find occurences in.
	 * @param {Array} words - The array of words to find.
	 * @returns {Array} The array of words found.
	 */
	findFilteredWords(content, words) {
		if (typeof content !== "string" || !Array.isArray(words) || words.length <= 0) return [];

		var matchingWords = [];

		// Lowercase the content.
		const lowercaseContent = content.toLowerCase();

		for (var i = 0; i < words.length; i++) {
			const word = words[i].toLowerCase();
			if (!lowercaseContent.match(word) || matchingWords.indexOf(word) >= 0) continue;
			matchingWords.push(word);
		}

		return matchingWords;
	}

	/**
	 * Look for filtered words in a message and delete on match.
	 *
	 * @param {Message} message - The message sent.
	 * @returns {Boolean} `true` if the message was deleted.
	 */
	filterMessage(message) {
		if (!message || message.guild != this.guild || !message.deletable || message.author.id == this.galaxybot.client.id) return false;

		// Filter disabled.
		if (this.getSetting("enable-filter") !== true) return false;

		// Ignore admins.
		if (this.getSetting("filter-admins") !== true && this.isGalaxyBotManager(message.member)) return false;

		// Get filtered words list.
		const filteredWords = this.getSetting("filtered-words");
		const matchingWords = this.findFilteredWords(message.content, filteredWords);
		
		// Delete the message
		if (matchingWords.length > 0) {
			message.delete().then(() => {
				this.log(`Deleted ${message.author.tag} message containing filtered phrases: ${matchingWords.join(", ")}.`);
			})
			.catch(error => {
				this.log("Couldn't filter out a message: missing permissions.");
				// console.log(error);
			});

			return true;
		}

		return false;
	}

	/**
	 * Get the list of available guild settings.
	 *
	 * @return {Array.<string>} Array of available settings.
	 */
	getSettingsList() {
		var settings = [];

		availableSettings.forEach((description, name) => {
			settings.push(name);
		});

		return settings;
	}

	/**
	 * Get the guild setting.
	 *
	 * @param {string} settingName - Name of the setting to get.
	 * @returns {*} Value of the setting in guild. `undefined` if not found.
	 */
	getSetting(settingName) {
		if (!availableSettings.has(settingName)) return undefined;
		if (this.settings && this.settings[settingName] !== undefined) return this.settings[settingName];
		if (this.galaxybot.config.settings[settingName] !== undefined) return this.galaxybot.config.settings[settingName];
		return undefined;
	}

	/**
	 * Edit a guild setting.
	 *
	 * @apram {string} settingName - Name of the setting to edit.
	 * @apram {(string|undefined)} settingValue - The value given by the user.
	 * @apram {*} defaultValue -Default value of the setting.
	 * @apram {GuildMember} member - Member, who is editing the setting.
	 * @returns {Promise} Operation result.
	 * @resolve {Object} Information about the edited setting.
	 * @reject {string} Operation error code.
	 */
	editSetting(settingName, settingValue, defaultValue, member) {
		return new Promise((resolve, reject) => {
			// Unknown setting.
			if (!availableSettings.has(settingName)) {
				reject("unknown");
				return;
			}

			var savedToFile = false;

			// Modify a setting if value is given.
			if (settingValue !== undefined) {
				switch (settingName) {
					// These all are booleans, we can handle them in the same way.
					case "embed-mx" :
					case "embed-titles" :
					case "embed-maps" : 
					case "stalk-edits" : 
					case "limit-access" :
					case "enable-filter" :
					case "filter-admins" :
					case "filter-admins" :
					case "text-responses" :
					case "mocking-joy" : {
						// Value is not a boolean.
						if (!settingValue.match(/^(true|false)$/)) {
							reject("not boolean");
							return;
						}

						settingValue = settingValue == "true";

						break;
					}

					// Commands prefix.
					case "prefix" : {
						// Prefix doesn't match length requirements.
						if (settingValue.length > 5) {
							reject("prefix length");
							return;
						}

						break;
					}

					// Maximum music track duration.
					case "max-duration" : {
						settingValue = parseInt(settingValue);

						// Invalid number.
						if (settingValue < 0 || settingValue > 3600) {
							reject("invalid duration");
							return;
						}

						break;
					}

					// ManiaPlanet servers status update channel.
					case "servers-status" : {
						// Find the channel ID.
						settingValue = settingValue.match(/[0-9]+/);
						if (settingValue) settingValue = settingValue[0];

						var targetChannel = this.guild.channels.get(settingValue);

						if (targetChannel !== undefined) {
							settingValue = targetChannel.id;
						} else {
							settingValue = undefined;
						}

						break;
					}

					// Roles with permissions to manage GalaxyBot.
					case "roles" : {
						function escape(string) {
							return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
						};

						var explode = settingValue.split(" ");
						const action = explode.shift();
						const expression = new RegExp(escape(explode.join(" ")), "i");

						var targetRole;
						var currentRoles = this.settings.roles ? this.settings.roles : [];
						
						// Find a role with a matching name.
						this.guild.roles.forEach((role, snowflake) => {
							if (targetRole === undefined && role.name.match(expression)) targetRole = role;
						});

						// Remove roles, which don't exist anymore.
						currentRoles = currentRoles.filter(snowflake => this.guild.roles.has(snowflake));

						// Incorrect action given.
						if (!action.match(/^add|remove$/)) {
							reject("incorrect action");
							return;
						}

						// Role not found in the guild.
						if (targetRole === undefined) {
							reject("undefined role");
							return;
						}

						// Role is highest user role, or even higher.
						if (!this.isAdministrator(member) && member.id != this.galaxybot.config.dommy) {
							console.log(targetRole.calculatedPosition);
							console.log(member.highestRole.calculatedPosition);
							if (targetRole.calculatedPosition >= member.highestRole.calculatedPosition) {
								reject("higher role");
								return;
							}
						}

						// Add a new role.
						if (action == "add") {
							if (currentRoles.includes(targetRole.id)) {
								reject("role already set");
								return;
							}

							if (currentRoles.length >= 10) {
								reject("too many roles");
								return;
							}
							
							currentRoles.push(targetRole.id);
						}

						// Remove an existing role.
						if (action == "remove") {
							if (!currentRoles.includes(targetRole.id)) {
								reject("role not set");
								return;
							}
							
							currentRoles.splice(currentRoles.indexOf(targetRole.id), 1);
						}

						// Set the new value.
						if (currentRoles.length > 0) settingValue = currentRoles;

						// An empty array is unwanted.
						else settingValue = undefined;

						break;
					}

					// Music player commands channels.
					case "music-cmd-ch" : {
						var explode = settingValue.split(" ");
						var action = explode.shift();
						var channelId = explode.join(" ").match(/[0-9]+/);
						if (channelId) channelId = channelId[0];

						var targetChannel;
						var currentChannels = this.settings[settingName] ? this.settings[settingName] : [];
						
						// Find the channel with matching id.
						this.guild.channels.forEach((channel, snowflake) => {
							if (targetChannel === undefined && channel.id == channelId) targetChannel = channel;
						});

						// Remove channels, which don't exist anymore.
						currentChannels = currentChannels.filter(snowflake => this.guild.channels.has(snowflake));

						// Incorrect action given.
						if (!action.match(/^add|remove$/)) {
							reject("incorrect action");
							return;
						}

						// Channel not found in the guild.
						if (targetChannel === undefined) {
							reject("undefined channel");
							return;
						}

						// Add a new channel.
						if (action == "add") {
							if (currentChannels.includes(targetChannel.id)) {
								reject("channel already set");
								return;
							}

							if (currentChannels.length >= 10) {
								reject("too many channels");
								return;
							}
							
							currentChannels.push(targetChannel.id);
						}

						// Remove an existing channel.
						if (action == "remove") {
							if (!currentChannels.includes(targetChannel.id)) {
								reject("channel not set");
								return;
							}
							
							currentChannels.splice(currentChannels.indexOf(targetChannel.id), 1);
						}

						// Set the new value.
						if (currentChannels.length > 0) settingValue = currentChannels;

						// An empty array is unwanted.
						else settingValue = undefined;

						break;
					}

					// Word filter.
					case "filtered-words" : {
						// Look for invalid configuration.
						if (!this.galaxybot.config.filter || isNaN(this.galaxybot.config.filter.min) || isNaN(this.galaxybot.config.filter.max) || isNaN(this.galaxybot.config.filter.count)) {
							message.channel.send("Words filter configuration is invalid. Please contact the GalaxyBot owner!");
							reject("bad filter config");
							return;
						}

						var explode = settingValue.split(" ");
						var action = explode.shift();

						var targetWord = explode.join(" ");
						var currentWords = this.settings[settingName] ? this.settings[settingName] : [];

						// Incorrect action given.
						if (!action.match(/^add|remove$/)) {
							reject("incorrect action");
							return;
						}

						// Add a new word.
						if (action == "add") {
							if (currentWords.includes(targetWord)) {
								reject("word already set");
								return;
							}

							if (currentWords.length >= this.galaxybot.config.filter.count) {
								reject("too many words");
								return;
							}

							// Word too short or too long.
							if (targetWord.length < this.galaxybot.config.filter.min || targetWord.length > this.galaxybot.config.filter.max) {
								reject("word length");
								return;
							}
							
							currentWords.push(targetWord);
						}

						// Remove an existing word.
						if (action == "remove") {
							if (!currentWords.includes(targetWord)) {
								reject("word not set");
								return;
							}
							
							currentWords.splice(currentWords.indexOf(targetWord), 1);
						}

						// Set the new value.
						if (currentWords.length > 0) settingValue = currentWords;

						// An empty array is unwanted.
						else settingValue = undefined;

						break;
					}
				}

				// Delete the property, if matches the default value.
				if (settingValue === defaultValue) {
					delete this.settings[settingName];
				}

				// Set new value.
				else {
					if (typeof this.settings !== "object") this.settings = new Object();
					this.settings[settingName] = settingValue;
				}

				// Save settings to a file.
				savedToFile = this.saveSettings();

				// Saving failed.
				if (!savedToFile) {
					reject("saving failed");
					return;
				}
			}

			// Get the current value. If not set, take the default value.
			var currentValue = this.settings && this.settings[settingName] !== undefined ? this.settings[settingName] : defaultValue;

			// Format values of some settings into a readable form.
			if (currentValue !== undefined) { 
				switch (settingName) {
					// Names of the roles
					case "roles" : {
						var rolesNames = [];

						this.guild.roles.forEach((role, snowflake) => {
							if (currentValue.includes(snowflake)) rolesNames.push(role.name);
						});

						currentValue = rolesNames.join(", ");

						break;
					}

					// Servers status channel.
					case "servers-status" : {
						currentValue = "<#" + currentValue + ">";
						break;
					}

					// Music player commands channels.
					case "music-cmd-ch" : {
						var channelsTags = [];

						this.guild.channels.forEach((channel, snowflake) => {
							if (currentValue.includes(snowflake)) channelsTags.push("<#" + snowflake + ">");
						});

						currentValue = channelsTags.join(", ");

						break;
					}

					// Filtered words.
					case "filtered-words" : {
						var filteredWords = [];

						for (const word of currentValue) {
							filteredWords.push(word);
						}

						currentValue = filteredWords.join(", ");

						break;
					}
				}
			}

			// Resolve the promise with info about the setting.
			resolve({
				name: settingName,
				description: availableSettings.get(settingName),
				value: currentValue,
				default: defaultValue,
				saved: savedToFile
			});
		});
	}
}

module.exports = Guild;
