const ManiaPlanet = require("./../integrations/ManiaPlanet.js");
const Track = require("./Track.js");
const Discord = require("discord.js");
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

		this.lastTextChannel = undefined;
		this.voiceConnection = undefined;
		this.voiceDispatcher = undefined;
		this.currentTrack = undefined;
		this.tracksQueue = [];

		this.latestTimeMinute = -1;
		this.sameTimeStreak = 0;

		this.lastServersUpdate = 0;

		// Guild settings file.
		this.settings = undefined;
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
		if (!this.settings) return false;

		fs.writeFile(this.settingsPath, JSON.stringify(this.settings), error => {
			if (error != null) console.log(error);
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
		if (this.isAdministrator(member) || member.id == this.galaxybot.config.dommy) return true;
		if (!this.settings.roles) return false;

		for (var roleId in this.settings.roles) {
			if (this.guild.roles.has(roleId)) return true;
		}
	}

	createRolesList() {
		if (!this.settings.roles) return undefined;

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
		return this.settings["limit-access"] === true;
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
		this.log("Next track playback requested.");

		// Leave voice channel if queue is empty.
		if (this.tracksQueue.length <= 0) {
			if (this.voiceConnection) this.voiceConnection.channel.leave();
			this.log("Queue empty, leaving the voice channel.");
			return;
		}

		// This can happen. Often.
		if (this.voiceConnection === undefined) {
			this.lastTextChannel.send("I'm not in a voice channel. Something must've gone wrong...");
			this.log("Not in a voice channel.");
			return;
		}

		// Pick first track from the queue.
		this.currentTrack = this.tracksQueue.shift();

		// Play stream or direct URL.
		try {
			var streamOptions = { passes: 3, bitrate: 44100 };

			if (this.currentTrack.stream) {
				this.voiceDispatcher = this.voiceConnection.playStream(this.currentTrack.stream, streamOptions);
			}
			else if (this.currentTrack.sourceURL) {
				this.voiceDispatcher = this.voiceConnection.playArbitrary(this.currentTrack.sourceURL, streamOptions);
			}
			else if (this.currentTrack.isLocalFile) {
				this.voiceDispatcher = this.voiceConnection.playFile(this.currentTrack.sourceURL, streamOptions);
			}

			this.log("Creating new voice dispatcher: " + this.currentTrack.title);
		}
		catch (error) {
			this.lastTextChannel.send("Something must've gone wrong with last track, I couldn't play it...");
			this.log("A problem has occured while trying to play track: " + this.currentTrack.title);
			this.playNextTrack();

			console.log(error);
			return;
		}

		if (this.voiceDispatcher) {
			this.voiceDispatcher.on("end", reason => {
				this.currentTrack = undefined;
				this.voiceDispatcher = undefined;
				this.log("Voice dispatcher end: " + reason);
				
				// Delay is necessary for slower connections to don't skip next track immediately.
				setTimeout(() => { this.playNextTrack(); }, 250);
			});

			this.voiceDispatcher.on("error", error => {
				console.log(error);
			});
		}

		// Show what's currently being played.
		var header = this.currentTrack.isLivestream
			? "I'm tuned up for the livestream, <@" + this.currentTrack.sender.id + ">! :red_circle:"
			: "I'm playing your track now, <@" + this.currentTrack.sender.id + ">! :metal:";

		this.lastTextChannel.send("I'm playing your track now, <@" + this.currentTrack.sender.id + ">! :metal:", this.currentTrack.embed);
		this.log("Now playing: " + this.currentTrack.title);
	}

	/**
	 * Fired when a new track has been created.
	 *
	 * @param {Track} track - Newly created track.
	 * @param {GuildMember} member - Member, which has requested the track.
	 * @param {string} url - The URL of the track source.
	 * @param {boolean} isNext - Whether the track should be played next.
	 * @param {boolean} isNow - Whether we should skip to this track.
	 */
	onTrackCreated(track, member, url, isNext, isNow) {
		if (!member || (!this.voiceConnection && !member.voiceChannel)) return;

		var hasPermissions = this.isGalaxyBotManager(member);

		// Let's just ignore the fact we're in "onTrackCreated" method - track has been not created.
		if (track === undefined) {
			this.lastTextChannel.send("Sorry <@" + member.id + ">, but I can't play anything from that link. :shrug:");
			this.log("Track " + url + " not added: no information.");
			return;
		}

		// The possible error codes upon track creation.
		switch (track) {
			// Unsupported link type.
			case "unsupported" : {
				this.lastTextChannel.send("I can't play that resource, <@" + member.id + ">. Make sure you're requesting something from YouTube, Facebook, Streamable or uploading a music file attachment. :rolling_eyes:\n```Error code: " + track + "```");
				this.log("Track " + url + " not added: unsupported host.");
			}

			// ytdl-core failed us again.
			case "ytdl-no-info" : {
				this.lastTextChannel.send("Sorry <@" + member.id + ">, I couldn't obtain information about your YouTube video. :cry:\n```Error code: " + track + "```");
				this.log("Track " + url + " not added: failed to obtain YouTube video information.");
			}

			// Couldn't create a YouTube stream.
			case "yt-stream-fail" : {
				this.lastTextChannel.send("Sorry <@" + member.id + ">, but it was impossible for me to stream your YouTube video. :cry:\n```Error code: " + track + "```");
				this.log("Track " + url + " not added: failed to create YouTube stream.");
			}

			// No information from Facebook.
			case "fb-no-info" : {
				this.lastTextChannel.send("Sorry <@" + member.id + ">, I couldn't obtain information about your Facebook video. :cry:\n```Error code: " + track + "```");
				this.log("Track " + url + " not added: failed to obtain Facebook video information.");
			}

			// No access to the file.
			case "file-no-access" : {
				this.lastTextChannel.send("Sorry <@" + member.id + ">, looks like I don't have access to this file, or it doesn't exist. :|\n```Error code: " + track + "```");
				this.log("Track " + url + " not added: no file access.");
			}

			// No music metadata.
			case "file-no-metadata" : {
				this.lastTextChannel.send("Sorry <@" + member.id + ">, I couldn't obtain the file's metadata. :cry:\n```Error code: " + track + "```");
				this.log("Track " + url + " not added: failed to obtain file metadata.");
			}
		}

		if (!track instanceof Track) return;

		// User without permissions attempts to play livestream.
		if (track.isLivestream && !hasPermissions) {
			this.lastTextChannel.send("Sorry <@" + member.id + ">, you don't have permissions to add livestreams. :point_up:");
			this.log("Track " + track.title + " not added: no permission to play livestream.");
			return;
		}

		// Track is too long and user has no permission to surpass the limit.
		const maxDuration = this.getSetting("max-duration");

		if (!hasPermissions && maxDuration > 0 && track.duration > maxDuration) {
			this.lastTextChannel.send("Sorry <@" + member.id + ">, **" + track.title + "** is too long! (" + Track.timeToText(track.duration) + "/" + Track.timeToText(maxDuration) + ") :rolling_eyes:");
			this.log("Track " + url + " not added: too long (" + track.duration + "/" + maxDuration + ").");
			return;
		}

		// DES-PA-CITO.
		if (track.title && track.title.match(/despacito/i)) {
			this.lastTextChannel.send("Anything related to \"Despacito\" is FUCKING BLACKLISTED. :middle_finger:");
			this.log("Track " + url + " not added: blacklisted.");
			return;
		}

		this.log("Track successfully added: " + track.title);

		// Queue new track.
		if (isNext === true && hasPermissions) {
			if (isNow === true) this.lastTextChannel.send("Okay <@" + member.id + ">, let's play it right now! :smirk:");
			this.tracksQueue.unshift(track);
			this.log("Track is forced next in the queue.");
		}

		// No permissions to insert at the beginning of the queue.
		else {
			if (isNext === true) this.lastTextChannel.send("Sorry <@" + member.id + ">, you can't queue track next, nor play it immediately. :rolling_eyes:");
			this.tracksQueue.push(track);
		}

		// Create a new voice connection, if there is none.
		if (this.voiceConnection === undefined) {
			member.voiceChannel.join().then(connection => {
				this.voiceConnection = connection;
				this.voiceConnection.on("disconnect", () => {
					this.voiceConnection = undefined;
					this.log("Disconnected from voice.");
				});

				this.playNextTrack();
				this.log("Created new voice connection.");
			});
		}

		// Somehow we are in a voice channel, but nothing is being played.
		else if (!this.currentTrack) this.playNextTrack();

		// Play the track right now.
		else if (isNow === true && hasPermissions && this.voiceDispatcher) {
			this.voiceDispatcher.end();
			this.log("Skipping directly to the requested track.");
		}
		
		// Show queue message.
		else {
			var position = this.tracksQueue.indexOf(track) + 1;
			this.lastTextChannel.send("<@" + member.id + ">, your track is **#" + position + "** in the queue:", track.embed);
		}
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
							settingValue = targetChannel;
						} else {
							settingValue = undefined;
						}
					}

					// Roles with permissions to manage GalaxyBot.
					case "roles" : {
						var explode = settingValue.split(" ");
						const action = explode.shift();
						const expression = new RegExp(explode.join(" "), "i");

						var targetRole;
						var currentRoles = this.settings.roles ? this.settings.roles : [];
						
						// Find a role with a matching name.
						this.guild.roles.forEach((role, snowflake) => {
							if (targetRole === undefined && role.name.match(expression)) targetRole = role;
						});

						// Remove roles, which don't exist anymore.
						currentRoles = currentRoles.filter(snowflake => this.guild.roles.has(snowflake));

						// Incorrect action given.
						if (!action.match(/add|remove/)) {
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
							if (member.highestRole === false || targetRole.calculatedPosition <= member.highestRole.calculatedPosition) {
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
						if (!action.match(/add|remove/)) {
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
						if (!this.config.filter || isNaN(this.config.filter.min) || isNaN(this.config.filter.max) || isNaN(this.config.filter.count)) {
							message.channel.send("Words filter configuration is invalid. Please contact the GalaxyBot owner!");
							reject("bad filter config");
							return;
						}

						var explode = settingValue.split(" ");
						var action = explode.shift();

						var targetWord = explode.join(" ");
						var currentWords = this.settings[settingName] ? this.settings[settingName] : [];

						// Incorrect action given.
						if (!action.match(/add|remove/)) {
							reject("incorrect action");
							return;
						}

						// Add a new word.
						if (action == "add") {
							if (currentWords.includes(targetWord)) {
								reject("word already set");
								return;
							}

							if (currentWords.length >= this.config.filter.count) {
								reject("too many words");
								return;
							}

							// Word too short or too long.
							if (word.length < this.config.filter.min || word.length > this.config.filter.max) {
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
					delete this.settings;
				}

				// Set new value.
				else this.settings[settingName] = settingValue;

				// Save settings to a file.
				savedToFile = this.saveSettings();

				// Saving failed.
				if (!savedToFile) {
					reject("saving failed");
					return;
				}
			}

			// Get the current value. If not set, take the default value.
			var currentValue = this.settings[settingName] !== undefined ? this.settings[settingName] : defaultValue;

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
