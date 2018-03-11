const Discord = require("discord.js");
const yt_search = require("youtube-search");
const querystring = require("querystring");
const yaml = require("js-yaml");
const FB = require("fb");

const https = require("https");
const URL = require("url");
const fs = require("fs");

// Local classes.
const Track = require("./Track");
const Guild = require("./Guild");
const User = require("./User");
const ManiaPlanet = require("./ManiaPlanet");
const ManiaExchange = require("./ManiaExchange");
const Units = require("./Units");

/**
 * The GalaxyBot itself.
 */
class GalaxyBot {
	/**
	 * Creates a new GalaxyBot.
	 */
	constructor() {
		this.client = new Discord.Client();
		this.client.on("ready", () => { this.onReady(); });
		this.client.on("message", message => { this.onMessage(message); });
		this.client.on("messageUpdate", (messageOld, messageNew) => { this.onEditedMessage(messageOld, messageNew); });
		this.client.on("messageReactionAdd", (reaction, user) => { this.onNewReaction(reaction, user); });
		this.client.on("channelDelete", channel => { this.onChannelDeleted(channel); });
		this.client.on("guildMemberUpdate", (oldMember, newMember) => { this.onMemberUpdate(oldMember, newMember); });
		this.client.on("guildDelete", guild => { this.onGuildDelete(guild); })

		process.on("SIGINT", () => { this.end(); });
		process.on("SIGTERM", () => { this.end(); });
		process.on("SIGHUP", () => { this.end(); });
		process.on("SIGBREAK", () => { this.end(); });

		this.maniaplanet = new ManiaPlanet();
		this.maniaexchange = new ManiaExchange();
		this.units = new Units();
		this.config = false;
		this.activeGuilds = [];
		this.activeUsers = [];
		this.logsStream = false;

		this.statusesList = [];
		this.lastStatus = false;

		this.talkChannel = false;

		this.start();
	}

	/**
	 * Prints a log in the console.
	 *
	 * @param {Guild} botGuild - The quild log is refering to.
	 * @param {String} text - The log content.
	 */
	log(botGuild, text) {
		var time = new Date().toLocaleString();
		var guildName = "GLOBAL";
		if (botGuild) guildName = botGuild.name;

		var message = "["+time+"] ["+guildName+"] " + text;
		console.log(message);

		if (this.logsStream !== false) {
			this.logsStream.write(message + "\n");
		}
	}

	/**
	 * Start the GalaxyBot.
	 */
	start() {
		this.log(false, "Initializing GalaxyBot...");

		// Load help page.
		fs.readFile("./helppage.md", "utf8", (error, data) => {
			if (error) {
				console.log(error);
				return;
			}
			this.helpPage = data;
		});
		
		// Load YAML config.
		try {
			this.config = yaml.safeLoad(fs.readFileSync("./config.yml", "utf8"));
		}
		catch (e) { console.log(e); }

		// Config file not found.
		if (!this.config) {
			console.log("Configuration error: config.yml not found or empty!");
			return;
		}

		// Initialize logs.
		if (typeof(this.config.logfile) === "string") {
			this.logsStream = fs.createWriteStream(this.config.logfile, { flags: "a" });
			this.log(false, "Logs will be saved to: " + this.config.logfile);
		}

		// Discord token not specified.
		if (!this.config.discord || !this.config.discord.token) {
			this.log(false, "Configuration error: Discord token is not specified in config.yml!");
		}
		
		// Log in to Discord.
		else this.client.login(this.config.discord.token);

		// Connect to Facebook
		if (this.config.facebook && this.config.facebook.appid && this.config.facebook.secret) {
			FB.api("oauth/access_token", {
				client_id: this.config.facebook.appid,
				client_secret: this.config.facebook.secret,
				grant_type: "client_credentials"
			}, response => {
				if (!response || response.error) {
					this.log(false, "A problem has occured while connecting to Facebook API.");
					console.log(!response ? "Facebook: Authentication error." : response.error);
					return;
				}
				FB.setAccessToken(response.access_token);
			});
		}
	}

	/**
	 * Fired when GalaxyBot is ready for action.
	 */
	onReady() {
		this.log(false, "GalaxyBot is ready!");
		//this.client.user.setActivity("over you", { type: "WATCHING" });

		// Random statuses.
		this.pickNextStatus();
		setInterval(() => { this.pickNextStatus(); }, 30000);

		// Register already existing guilds.
		var nbGuildsTotal = 0;
		this.client.guilds.forEach((guild, guildId) => {
			var botGuild = this.getBotGuild(guild);
			nbGuildsTotal++;
		});
		this.log(false, "Active in " + nbGuildsTotal + " guilds.");
	}

	/**
	 * Fired when terminal or console is killed.
	 */
	end() {
		this.log(false, "Stopping GalaxyGot...");
		this.client.destroy();

		// Stop logs stream.
		if (this.logsStream !== false) {
			this.logsStream.end();
			this.logsStream = false;
		}

		process.exit();
	}

	/**
	 * Cycle through multiple available status messages randomly.
	 */
	pickNextStatus() {
		if (!this.config.statuses || this.config.statuses.length <= 0) return;

		// Refill the statuses list.
		if (this.statusesList.length <= 0) {
			this.statusesList = this.config.statuses.slice();
		}

		var statusText = "";

		for (;;) {
			var index = Math.floor(Math.random() * (this.statusesList.length - 1));
			statusText = this.statusesList[index];
			if (statusText != this.lastStatus || this.statusesList.length <= 1) break;
		}

		this.statusesList.splice(index, 1);
		this.client.user.setActivity(statusText);
		this.lastStatus = statusText;
	}

	/**
	 * Replace all accurences of a phrase in string.
	 *
	 * @param {String} string - The string to replace stuff in.
	 * @param {String} toReplace - Phrase to be replaced.
	 * @param {String} replacement - Replacement phrase.
	 * @returns {String} The output string.
	 */
	replaceAll(string, toReplace, replacement) {
		var output = string;
		while (output.indexOf(toReplace) >= 0) output = output.replace(toReplace, replacement);
		return output;
	}

	/**
	 * Get the bot guild object of given guild.
	 *
	 * @param {Guild} guild - The quild to get bot guild.
	 * @returns {Guild} Bot guild object (no matter how stupid it sounds).
	 */
	getBotGuild(guild) {
		if (!guild) return false;
		for (const botGuild of this.activeGuilds) {
			if (guild.id == botGuild.id) return botGuild;
		}

		// Create new bot guild if doesn't exist yet.
		var botGuild = new Guild(guild.id);
		this.activeGuilds.push(botGuild);
		// this.log(false, "New guild registered: " + guild.name);
		return botGuild;
	}

	/**
	 * Get the bot user object of given user.
	 *
	 * @param {User} user - The user too get the object.
	 * @returns {User} The bot user object.
	 */
	getBotUser(user) {
		if (!user) return false;
		for (const botUser of this.activeUsers) {
			if (user.id == botUser.id) return botUser;
		}

		// Create a new bot user if doesn't exist yet.
		var botUser = new User(user.id);
		this.activeUsers.push(botUser);
		return botUser;
	}

	/**
	 * Check if a member has full control over the bot.
	 * Dommy and server administrators bypass all permission levels.
	 *
	 * @param {GuildMember} member - The user to check their rights.
	 * @returns {Boolean} True, if the user can control the bot.
	 */
	hasControlOverBot(member) {
		if (!member) return false;
		if (member.id == this.config.dommy) return true; ///< I'm the god of this module.
		if (member.id == member.guild.ownerID || member.hasPermission("ADMINISTRATOR")) return true;

		var botGuild = this.getBotGuild(member.guild);
		var modRoles = this.getSetting(botGuild, "roles");
		var matchingRoles = 0;

		member.roles.forEach((role, snowflake) => {
			if (modRoles.indexOf(snowflake) != -1) matchingRoles++;
		});

		return matchingRoles > 0;
	}

	/**
	 * Looks for next track in the queue and it finds any, plays it.
	 *
	 * @param {Guild} botGuild - The bot quild we decide to play next track in.
	 */
	playNextTrack(botGuild) {
		this.log(botGuild, "Next track playback requested.");

		// Leave voice channel if queue is empty.
		if (botGuild.tracksQueue.length <= 0) {
			if (botGuild.voiceConnection) botGuild.voiceConnection.channel.leave();
			this.log(botGuild, "Queue empty, leaving the voice channel.");
			return;
		}
		
		// This can happen. Often.
		if (!botGuild.voiceConnection) {
			botGuild.lastTextChannel.send("I'm not in a voice channel. Something must've gone wrong...");
			this.log(botGuild, "Not in a voice channel.");
			return;
		}

		// Pick first track from the queue.
		botGuild.currentTrack = botGuild.tracksQueue[0];
		botGuild.tracksQueue.shift();

		// Play stream or direct URL.
		try {
			var streamOptions = { passes: 3, bitrate: 44100 };

			if (botGuild.currentTrack.stream) {
				botGuild.voiceDispatcher = botGuild.voiceConnection.playStream(botGuild.currentTrack.stream, streamOptions);
			}
			else if (botGuild.currentTrack.sourceURL) {
				botGuild.voiceDispatcher = botGuild.voiceConnection.playArbitraryInput(botGuild.currentTrack.sourceURL, streamOptions);
			}
			else if (botGuild.currentTrack.isLocalFile) {
				botGuild.voiceDispatcher = botGuild.voiceConnection.playFile(botGuild.currentTrack.sourceURL, streamOptions);
			}

			this.log(botGuild, "Creating new voice dispatcher: " + botGuild.currentTrack.title);
		}
		catch (error) {
			botGuild.lastTextChannel.send("Something must've gone wrong with last track, I couldn't play it...");
			this.log(botGuild, "A problem has occured while trying to play track: " + botGuild.currentTrack.title);
			console.log(error);
			this.playNextTrack(botGuild);
			return;
		}

		if (botGuild.voiceDispatcher) {
			botGuild.voiceDispatcher.on("end", reason => {
				botGuild.currentTrack = false;
				botGuild.voiceDispatcher = false;

				this.log(botGuild, "Voice dispatcher end: " + reason);
				
				// Delay is necessary for slower connections to don't skip next track immediately.
				setTimeout(() => { this.playNextTrack(botGuild); }, 250);
			});

			botGuild.voiceDispatcher.on("error", error => {
				console.log(error);
			});
		}

		this.nowPlaying(botGuild, true);
		this.log(botGuild, "Now playing: " + botGuild.currentTrack.title);
	}

	/**
	 * Sends a message with current track information.
	 *
	 * @param {Guild} botGuild - The guild we"re telling current track info.
	 * @param {Boolean} withMention - If true, user who requested the track is mentioned.
	 */
	nowPlaying(botGuild, withMention) {
		if (!botGuild.lastTextChannel) return;

		// Nothing is being played right now.
		if (!botGuild.currentTrack) {
			botGuild.lastTextChannel.send("I'm not playing anything right now. Go ahead and request some beats! :butterfly:");
			this.log(botGuild, "Nothing played in the guild.");
			return;
		}
		
		// We are playing something.
		var header = "Now playing:";

		if (withMention) {
			if (botGuild.currentTrack.isLivestream) {
				header = "I'm tuned up for the livestream, <@" + botGuild.currentTrack.sender.id + ">! :red_circle:";
			} else {
				header = "I'm playing your track now, <@" + botGuild.currentTrack.sender.id + ">! :metal:";
			}
		}

		// Current play point.
		if (!botGuild.currentTrack.isLivestream && !withMention) {
			const current = botGuild.currentTrack.timeToText(parseInt(botGuild.voiceDispatcher.time / 1000));
			const total = botGuild.currentTrack.timeToText(botGuild.currentTrack.duration);

			botGuild.currentTrack.embed.description = current+" / "+total;
		}

		botGuild.lastTextChannel.send(header, botGuild.currentTrack.embed);
		this.log(botGuild, "Guild is playing: " + botGuild.currentTrack.title);
	}

	/**
	 * Fired when a new track has been created.
	 *
	 * @param {Guild} botGuild - Guild in which track has been crated.
	 * @param {Track} track - Newly created track.
	 * @param {GuildMember} member - User, which created the track.
	 * @param {String} url - The URL of the track source.
	 * @param {String} param - Play parameter specified after URL.
	 */
	onTrackCreated(botGuild, track, member, url, param) {
		if (!botGuild || !member) return;
		if (!botGuild.voiceConnection && !member.voiceChannel) return;
		var hasPermissions = this.hasControlOverBot(member);

		// (Let's just ignore the fact we're in "onTrackCreated" method) Track not created.
		if (!track) {
			botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, but I can't play anything from that link. :shrug:");
			this.log(botGuild, "Track " + url + " not added: no information.");
			return;
		}

		// Unsupported link type.
		if (track === "unsupported") {
			botGuild.lastTextChannel.send("I can't play that link, <@" + member.id + ">. Make sure you're requesting something from YouTube, Facebook or Streamable. :rolling_eyes:\n```Error code: " + track + "```");
			this.log(botGuild, "Track " + url + " not added: unsupported host.");
			return;
		}

		// ytdl-core failed us again.
		if (track === "ytdl-no-info") {
			botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, I couldn't obtain information about your YouTube video. :cry:\n```Error code: " + track + "```");
			this.log(botGuild, "Track " + url + " not added: failed to obtain YouTube video information.");
			return;
		}

		// Couldn't create a YouTube stream.
		if (track === "yt-stream-fail") {
			botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, but it was impossible for me to stream your YouTube video. :cry:\n```Error code: " + track + "```");
			this.log(botGuild, "Track " + url + " not added: failed to create YouTube stream.");
			return;
		}

		// No information from Facebook.
		if (track === "fb-no-info") {
			botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, I couldn't obtain information about your Facebook video. :cry:\n```Error code: " + track + "```");
			this.log(botGuild, "Track " + url + " not added: failed to obtain Facebook video information.");
			return;
		}

		// No access to the file.
		if (track === "file-no-access") {
			botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, looks like I don't have access to this file, or it doesn't exist. :|\n```Error code: " + track + "```");
			this.log(botGuild, "Track " + url + " not added: no file access.");
			return;
		}

		// No music metadata.
		if (track === "file-no-metadata") {
			botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, I couldn't obtain the file's metadata. :cry:\n```Error code: " + track + "```");
			this.log(botGuild, "Track " + url + " not added: failed to obtain file metadata.");
			return;
		}

		// User without permissions attempts to play livestream.
		if (track.isLivestream && !hasPermissions) {
			botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, you don't have permissions to add livestreams. :point_up:");
			this.log(botGuild, "Track " + track.title + " not added: no permission to play livestream.");
			return;
		}

		// Track is too long and user has no permission to surpass the limit.
		const maxDuration = this.getSetting(botGuild, "max-duration");
		if (!hasPermissions && maxDuration > 0 && track.duration > maxDuration) {
			botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, **" + track.title + "** is too long! (" + track.timeToText(track.duration) + "/" + track.timeToText(maxDuration) + ") :rolling_eyes:");
			this.log(botGuild, "Track " + url + " not added: too long (" + track.duration + "/" + maxDuration + ").");
			return;
		}

		// DES-PA-CITO.
		if (track.title && track.title.toLowerCase().indexOf("despacito") >= 0) {
			botGuild.lastTextChannel.send("Anything related to \"Despacito\" is FUCKING BLACKLISTED. :middle_finger:");
			this.log(botGuild, "Track " + url + " not added: blacklisted.");
			return;
		}

		this.log(botGuild, "Track successfully added: " + track.title);

		// Queue new track.
		const isNext = (param === "now" || param === "next") && botGuild.tracksQueue.length > 0;
		const isNow = param === "now" && hasPermissions;

		if (isNext && hasPermissions) {
			if (isNow) botGuild.lastTextChannel.send("Okay <@" + member.id + ">, let's play it right now! :smirk:");
			botGuild.tracksQueue.unshift(track);
			this.log(botGuild, "Track is forced next in the queue.");
		} else {
			if (isNext) botGuild.lastTextChannel.send("Sorry <@" + member.id + ">, you can't queue track next, nor play it immediately. :rolling_eyes:");
			botGuild.tracksQueue.push(track);
		}

		// Create voice connection for current guild, if doesn"t exist.
		if (!botGuild.voiceConnection) {
			member.voiceChannel.join().then(connection => {
				botGuild.voiceConnection = connection;
				botGuild.voiceConnection.on("disconnect", () => {
					botGuild.voiceConnection = false;
					this.log(botGuild, "Disconnected from voice.");
				});
				this.playNextTrack(botGuild);
				this.log(botGuild, "Created new voice connection.");
			});
		}

		// Somehow we are in voice channel, but nothing is being played.
		else if (!botGuild.currentTrack) this.playNextTrack(botGuild);

		// Play the track right now.
		else if (isNow && botGuild.voiceDispatcher) {
			botGuild.voiceDispatcher.end();
			this.log(botGuild, "Skipping directly to the requested track.");
		}
		
		// Show queue message.
		else {
			var position = botGuild.tracksQueue.indexOf(track) + 1;
			botGuild.lastTextChannel.send("<@" + member.id + ">, your track is **#" + position + "** in the queue:", track.embed);
		}
	}

	/**
	 * Check if the music player has limited access.
	 *
	 * @param {Guild} botGuild - The guild to get setting.
	 * @returns {Boolean} `true`, if the music player is  limited.
	 */
	isPlayerLimitedAccess(botGuild) {
		if (!botGuild) return false;

		return this.getSetting(botGuild, "limit-access") === true;
	}

	/**
	 * Set if the music player has limited access.
	 *
	 * @param {Guild} botGuild - The guild to update settings.
	 * @param {Boolean} limitAccess - If `true`, music player will be limited.
	 */
	setPlayerLimitedAccess(botGuild, limitAccess) {
		if (!botGuild) return;

		// Enable.
		if (limitAccess === true) botGuild.settings["limit-access"] = true;
		
		// Disable.
		else if (botGuild.settings["limit-access"]) {
			delete botGuild.settings["limit-access"];
		}

		botGuild.saveSettings();
	}

	/**
	 * Basic commands handling.
	 *
	 * @param {Guild} botGuild - The guild command was sent in.
	 * @param {Message} message - The message command was sent in.
	 * @param {String} name - Name of the command used.
	 * @param {Array} args - Arguments provided with the command.
	 */
	onCommand(botGuild, message, name, args) {
		if (!message) return;

		// Log command.
		this.log(botGuild, "Command sent by " + message.author.username + ": " + name);

		// Server-only command in DM.
		if (!botGuild) {
			const guildCommands = ["dommy", "play", "undo", "now", "next", "queue", "skip", "stop", "pause", "limitaccess", "setting"];

			if (guildCommands.indexOf(name) != -1) {
				message.channel.send("Sorry, this command works only on servers!");
				this.log(botGuild, "Command is server-only.");
				return;
			}
		}

		// Update latest text channel for music commands
		const musicCommands = ["play", "undo", "now", "next", "queue", "skip", "stop", "pause", "limitaccess"];

		if (musicCommands.indexOf(name) != -1) {
			// Ignore command if not seend in exclusive channel
			var musicTextChannels = this.getSetting(botGuild, "music-cmd-ch");

			if (musicTextChannels && musicTextChannels.length > 0 && musicTextChannels.indexOf(message.channel.id) == -1) {
				var channelsTags = [];

				for (var i = 0; i < musicTextChannels.length; i++) {
					var channelId = musicTextChannels[i];
					channelsTags.push("<#" + channelId + ">");
				}

				message.channel.send("Can't use music player commands in this channel. Try in " + channelsTags.join(", ") + "!");
				this.log(botGuild, "Music commands not allowed in #" + message.channel.name + ".");
				return;
			}

			// Save the last used text channel.
			botGuild.lastTextChannel = message.channel;
		}

		// Commands only available for users with certain permissions.
		const playerControlCommands = ["play", "undo", "skip", "stop"];

		if (playerControlCommands.indexOf(name) != -1 && this.isPlayerLimitedAccess(botGuild) && !this.hasControlOverBot(message.member)) {
			var rolesText = "";
			var rolesSetting = this.getSetting(botGuild, "roles");

			if (rolesSetting) {
				var rolesNames = [];

				message.guild.roles.forEach((role, snowflake) => {
					if (rolesSetting.indexOf(snowflake) < 0) return;
					rolesNames.push(role.name);
				});

				if (rolesNames.length > 0) rolesText = " and members with one of following roles: " + rolesNames.join(", ");
			}

			message.channel.send("<@" + message.member.id + ">, you can't control the music player right now. I only accept commands from the server administrators" + rolesText + "!");
			this.log(botGuild, "Music player has limited access.");
			return;
		}
		
		switch (name) {
			// Show available commands list.
			case "help" : {
				var commandPrefix = this.getSetting(botGuild, "prefix");
				message.channel.send("Full documentation of my commands can be found here:\nhttps://github.com/domino54/galaxybot/blob/master/README.md");
				this.log(botGuild, "Documentation link sent.");
				break;
			}

			// Mention Dommy.
			case "dommy" : {
				message.channel.send("<@" + this.config.dommy + "> https://giphy.com/gifs/movie-mrw-see-2H67VmB5UEBmU");
				this.log(botGuild, "Dommy mentioned.");
				break;
			}

			// Source code on GitHub.
			case "git" : {
				message.channel.send(
					"Maybe I can't explain you how to understand women, but you can look at my source code instead! :hugging:\n" +
					"https://github.com/domino54/galaxybot"
				);
				this.log(botGuild, "Pasted GitHub repo link.");
				break;
			}

			// Redirects to page, where user can add this bot to their server.
			case "invite" : {
				message.channel.send(
					"Want me to party hard with you on your server? Use the link below! :sunglasses:\n" +
					"https://discordapp.com/oauth2/authorize?client_id=" + this.client.user.id + "&scope=bot&permissions=137456704"
				);
				this.log(botGuild, "Pasted bot invitation link.");
				break;
			}

			// Show user avatar.
			case "avatar" : {
				var targetUser = message.author;

				if (args.length >= 1 && message.guild) {
					var matchingUsers = [];
					var name = args[0].toLowerCase();

					// Find member of matching tag.
					message.guild.members.forEach((member, memberId) => {
						if (member.user.tag.toLowerCase().indexOf(name) == -1) return;
						matchingUsers.push(member.user);
					});

					// Found someone.
					if (matchingUsers.length > 0) targetUser = matchingUsers[0];
					
					// No users found.
					else {
						message.channel.send("Sorry <@" + message.author.id + ">, I couldn't find user named **" + name + "**. :rolling_eyes:");
						this.log(botGuild, "Could not find user " + name);
						return;
					}
				}

				// Send avatar.
				message.channel.send(new Discord.RichEmbed({
					author: {
						name: targetUser.username,
						icon_url: targetUser.avatarURL
					},
					image: {
						url: targetUser.avatarURL
					}
				}));
				this.log(botGuild, "Sent avatar URL of " + targetUser.username);
				break;
			}

			// Send servers list of a specific title.
			case "servers" : {
				// Title id not specified.
				if (args.length <= 0) {
					message.channel.send("<@" + message.author.id + ">, you need to specify `titleUid` in this command. Type `titleUid` after command or use one of these short codes: " + this.maniaplanet.getTitleCodes().join(", ") + ".");
					this.log(botGuild, "No UID specified.");
					return;
				}

				// Get title id.
				var titleUid = args[0];
				titleUid = this.maniaplanet.getTitleUid(titleUid);
				
				this.maniaplanet.servers({"titleUids[]": titleUid, length: 11}, result => {
					this.serversList(message, result, titleUid);
				});
				this.log(botGuild, "Checking servers of " + titleUid);
				break;
			}

			// Show info about a title.
			case "title" : {
				// Title id not specified.
				if (args.length <= 0) {
					message.channel.send("<@" + message.author.id + ">, you need to specify `titleUid` in this command. Type `titleUid` after command or use one of these short codes: " + this.maniaplanet.getTitleCodes().join(", ") + ".");
					this.log(botGuild, "No UID specified.");
					return;
				}

				// Get title id.
				var titleUid = args[0];
				titleUid = this.maniaplanet.getTitleUid(titleUid);
				this.showTitleInfo(message, titleUid);
				break;
			}

			// Show info about a map.
			case "map" : {
				// Map UID not specified.
				if (args.length <= 0) {
					message.channel.send("<@" + message.author.id + ">, you need to specify the map `UID` in this command.");
					this.log(botGuild, "No UID specified.");
					return;
				}

				this.showMapInfo(message, args[0]);
				break;
			}

			// Show current program live in a channel.
			case "channel" : {
				// Which channel?
				if (args.length <= 0) {
					message.channel.send("<@" + message.author.id + ">, I need to know if you mean `sm` or `tm` channel. :thinking:");
					this.log(botGuild, "No channel specified.");
					return;
				}

				// Get channel.
				var channelId = "";
				switch (args[0]) {
					case "sm" : {
						channelId = "shootmania";
						break;
					}
					case "tm" : {
						channelId = "trackmania";
						break;
					}
					// Unknown.
					default : {
						message.channel.send("<@" + message.author.id + ">, currently there are only two channels: `sm` and `tm`. :shrug:");
						this.log(botGuild, "Unknown channel.");
						return;
					}
				}

				this.showCurrentEpisode(message, channelId);
				break;
			}

			// Mania Exhange
			case "mx" : {
				// Which Exchange?
				if (args.length <= 0) {
					message.channel.send("<@" + message.author.id + ">, please specify which Mania Exchange do you want me to use: `sm` or `tm`. :point_up:");
					this.log(botGuild, "No Exchange specified.");
					return;
				}

				// Get Exchange.
				const exchange = args[0].toLowerCase();
				if (exchange != "tm" && exchange != "sm") {
					message.channel.send("<@" + message.author.id + ">, we have only `sm` and `tm` Mania Exchange. :shrug:");
					this.log(botGuild, "Unknown Exchange.");
					return;
				}

				// No more params specified.
				if (args.length < 2) {
					message.channel.send("<@" + message.author.id + ">, would be really nice if you told me the `mxid` or search for a map name. :shrug:");
					this.log(botGuild, "No mxid or search query specified.");
					return;
				}

				// Get map information by mxid.
				const mxid = parseInt(args[1]);
				if (args.length == 2 && mxid > 0) {
					this.log(botGuild, "Searching for mxid " + mxid + " in " + exchange + " Exchange...");

					this.maniaexchange.maps(exchange, [mxid], mapInfo => {
						// Not found
						if (!mapInfo || mapInfo.length <= 0) {
							message.channel.send("Sorry <@" + message.author.id + ">, I couldn't find map with id **" + mxid + "**. :cry:");
							this.log(botGuild, "MX map not found: " + mxid);
							return;
						}

						this.showMXInfo(message, exchange, mapInfo[0]);
					});
				}

				// Search by map name.
				else {
					args.shift();
					const mapName = args.join(" ");
					this.log(botGuild, "Searching for \"" + mapName + "\" in " + exchange + " Exchange...");

					this.maniaexchange.search(exchange, { trackname: mapName, limit: 1 }, mapsInfo => {
						// No results.
						if (!mapsInfo || !mapsInfo.results || mapsInfo.results.length <= 0) {
							message.channel.send("Sorry <@" + message.author.id + ", I couldn't find any map called **" + mapName + "**. :cry:");
							this.log(botGuild, "No MX results found: " + mapName);
							return;
						}

						this.log(botGuild, mapsInfo.results.length + " results found for " + mapName);
						this.showMXInfo(message, exchange, mapsInfo.results[0]);
					});
				}

				break;
			}

			// Show the user currently played track.
			case "now" : {
				this.nowPlaying(botGuild, false);
				break;
			}

			// Show the user next track in the queue.
			case "next" : {
				// Nothing next in the queue.
				if (botGuild.tracksQueue.length <= 0) {
					message.channel.send("The queue is empty. Go ahead and request some beats! :butterfly:");
					break;
				}

				// Get the order of the track from queue to get.
				var trackOrder = 0;
				if (args[0]) {
					// Get next track requested by the user.
					if (args[0] == "me") {
						for (const track of botGuild.tracksQueue) {
							if (track.sender != message.member) continue;
							message.channel.send("Your next track is **#" + (i+1) + "** in the queue, <@" + message.member.id + ">:", track.createEmbed());
							return;
						}
						message.reply("looks like there are no upcoming tracks requested by you.");
						break;
					}
					else trackOrder = parseInt(args[0]) - 1;
				}

				// Invalid order.
				if (trackOrder < 0) {
					message.channel.send("Aren't you supposed to enter number greater or equal to 1? :face_palm:");
					break;
				}

				// Queue is not that long
				if (!botGuild.tracksQueue[trackOrder]) {
					message.channel.send("Queue is only **" + botGuild.tracksQueue.length + "** track" + (botGuild.tracksQueue.length > 1 ? "s" : "") + " long. :shrug:");
					break;
				}

				var header = "Up next:";
				if (trackOrder > 0) header = "**#" + (trackOrder + 1) + "** in the queue:";
				message.channel.send(header, botGuild.tracksQueue[trackOrder].createEmbed());
				break;
			}

			// List max. 10 upcoming tracks.
			case "queue" : {
				// Nothing next in the queue.
				if (botGuild.tracksQueue.length <= 0) {
					message.channel.send("The queue is empty. Go ahead and request some beats! :butterfly:");
					break;
				}

				// List next tracks
				var tracksInfos = [];
				for (var i = 0; i < botGuild.tracksQueue.length && i < 10; i++) {
					var track = botGuild.tracksQueue[i];
					tracksInfos.push(((i<9) ? "0" : "") + (i+1) + ". " + track.title + " (requested by " + track.sender.displayName + ")");
				}
				message.channel.send("Up next:\n```" + tracksInfos.join("\n") + "```");
				break;
			}

			// Skip currently played track.
			case "skip" : {
				// Not playing anything in the server.
				if (!botGuild.currentTrack) {
					message.channel.send("Nothing is being played right now. :shrug:");
					return;
				}

				// No permission to skip current track.
				if (!this.hasControlOverBot(message.member) && message.member != botGuild.currentTrack.sender) {
					message.channel.send("You are not permitted to skip tracks requested by other users. :no_good:");
					return;
				}

				message.channel.send("Allright, skipping current track! :thumbsup:");
				this.log(botGuild, "Current track skipped through command.");

				if (botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
				break;
			}

			// Stop everything.
			case "stop" : {
				if (!this.hasControlOverBot(message.member)) {
					var modRoles = this.getSetting(botGuild, "roles").split(",");
					message.channel.send("Only server administrators and people with at least one of following roles can stop me: " + modRoles.join(", ") + ". :point_up:");
					return;
				}

				if (!botGuild.currentTrack) return;

				message.channel.send("Abort! Playback has been stopped and queue emptied. :no_good:");
				this.log(botGuild, "Stopped playback on admin command.");

				botGuild.tracksQueue = [];
				// if (botGuild.voiceConnection) botGuild.voiceConnection.channel.leave();
				if (botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
				break;
			}

			// Remove latest track added by the user.
			case "undo" : {
				// Tracks queue is empty.
				if (botGuild.tracksQueue.length <= 0) {
					message.channel.send("Tracks queue is empty. :shrug:");
					return;
				}

				// Get the latest track queued by user.
				var trackToRemove = false;
				for (var i = botGuild.tracksQueue.length - 1; i >= 0; i--) {
					var track = botGuild.tracksQueue[i];
					if (track.sender != message.member) continue;
					trackToRemove = track;
					break;
				}

				// No track found.
				if (!trackToRemove) {
					message.channel.send("Looks like there are no upcoming tracks requested by you. :thinking:");
					return;
				}

				// Remove latest track.
				message.channel.send("<@" + message.member.id + ">, I removed your latest track, **" + trackToRemove.title+ "**.");
				botGuild.tracksQueue.splice(botGuild.tracksQueue.indexOf(trackToRemove), 1);
				break;
			}

			// Request bot to play a song.
			case "play" : {
				// URL not specified
				if (args.length <= 0) {
					message.channel.send("First of all, you need to tell me what should I play. :shrug:");
					break;
				}

				// Music player not running and user is not in a voice channel.
				if (!botGuild.voiceConnection && !message.member.voiceChannel) {
					message.channel.send("You need join a voice channel before I can start playing anything. :loud_sound:");
					this.log(botGuild, "User not in any voice channel.");
					break;
				}

				// User not in our voice channel.
				if (botGuild.voiceConnection && message.member.voiceChannel != botGuild.voiceConnection.channel && !this.hasControlOverBot(message.member)) {
					message.channel.send("You need to join my voice channel if you want to request something. :point_up:");
					this.log(botGuild, "User not in voice channel with bot.");
					break;
				}

				// Create a new track object for the speicifed URL.
				var query = args.join(" ");
				var url = args[0].replace(/<|>/g, "");

				this.log(botGuild, "Track requested by " + message.member.displayName + ": " + query);

				// Try to load track from a local file.
				if (query.match(/^[A-Z]:(\/|\\)/)) {
					// Unauthorized.
					if (message.member.id != this.config.dommy) {
						message.channel.send("Only my creator is allowed to play music from the server storage. :no_entry:");
						this.log(botGuild, "Not authorized to use server resources.");
						break;
					}

					var track = new Track(query, message.member, track => {
						this.onTrackCreated(botGuild, track, message.member, query, false);
					});
				}

				// Try to load track from given URL.
				else if (URL.parse(url).hostname) {
					var track = new Track(url, message.member, track => {
						this.onTrackCreated(botGuild, track, message.member, url, args[1]);
					});
				}

				// Can't search in YouTube: API token not provided.
				else if (!this.config.youtube || !this.config.youtube.token) {
					message.channel.send("I can't search for tracks in YouTube, API token is missing in my configuration file! :rolling_eyes:");
					this.log(botGuild, "Wrong YouTube configuration: token not specified.");
					break;
				}

				// Search for the something in YouTube.
				else {
					var options = {
						maxResults: 1,
						key: this.config.youtube.token
					};
					yt_search(query, options, (error, results) => {
						if (error) return console.log(error);
						if (results.length > 0) {
						 	var track = new Track(results[0].link, message.member, track => {
								this.onTrackCreated(botGuild, track, message.member, url, false);
							});
						}
					});
				}

				break;
			}

			// Pause music playback.
			case "pause" : {
				// No permissions.
				if (!this.hasControlOverBot(message.member)) {
					message.channel.send("You don't have permissions to pause/resume music playback. :point_up:");
					this.log(botGuild, "No permissions to pause/resume music playback.");
					return;
				}

				// Nothing is being played.
				if (!botGuild.voiceDispatcher) {
					message.channel.send("Looks like I'm not playing anything right now. :shrug:");
					this.log(botGuild, "Nothing is being played.");
					return;
				}

				// Resume
				if (botGuild.voiceDispatcher.paused) {
					message.channel.send("Aaaand... back to the business. :arrow_forward:");
					this.log(botGuild, "Music playback resumed.");
					botGuild.voiceDispatcher.resume();
				}

				// Pause
				else {
					message.channel.send("We're taking a little break! :pause_button:");
					this.log(botGuild, "Music playback paused.");
					botGuild.voiceDispatcher.pause();
				}

				break;
			}

			// Toggle music player limited access.
			case "limitaccess" : {
				// No permissions.
				if (!this.hasControlOverBot(message.member)) {
					message.channel.send("Sorry <@" + message.member.id + ">, you don't have permissions to edit my settings. :no_entry:");
					this.log(botGuild, "No permissions to limit music access.");
					return;
				}

				const isLimitedAccess = !this.isPlayerLimitedAccess(botGuild);
				this.setPlayerLimitedAccess(botGuild, isLimitedAccess);

				// Enable the ristriction.
				if (isLimitedAccess) {
					var rolesText = "";
					var rolesSetting = this.getSetting(botGuild, "roles");

					if (rolesSetting) {
						var rolesNames = [];

						message.guild.roles.forEach((role, snowflake) => {
							if (rolesSetting.indexOf(snowflake) < 0) return;
							rolesNames.push(role.name);
						});

						if (rolesNames.length > 0) rolesText = " and members with one of following roles: " + rolesNames.join(", ");
					}

					message.channel.send("Sure <@" + message.member.id + ">, from now on I will respond only to the music player commands sent by the server administrators" + rolesText + ". :ok_hand:");
				}

				// Disable the ristriction.
				else {
					message.channel.send("All members have access to the music player now! :butterfly:");
				}

				break;
			}

			// List all guilds the bot is active in.
			case "guilds" : {
				var serversNames = [];
				this.client.guilds.forEach((guild, guildId) => {
					serversNames.push(guild == message.guild ? "**"+guild.name+"**" : guild.name);
				});
				var msg = "I'm active in **" + this.client.guilds.size + "** server" + (this.client.guilds.size == 1 ? "" : "s");

				// Complete guilds list in personal message for owner.
				if (message.author.id == this.config.dommy && message.channel.type == "dm") {
					message.channel.send(msg + ": " + serversNames.join(", ") + ".");
				}

				// Limited info for other users.
				else message.channel.send(msg + ".");
				break;
			}

			// Change bot settings in guild.
			case "settings" : {
				// No permissions to tweak settings
				if (!this.hasControlOverBot(message.member) && args.length > 1) {
					message.channel.send("Sorry <@" + message.member.id + ">, you don't have permissions to edit my settings. :no_entry:");
					this.log(botGuild, "No permissions to change guild settings: " + message.member.displayName);
					return;
				}

				// Command params.
				const settingName = args[0];
				args.shift();
				const settingValue = (args[0] ? args.join(" ") : false);

				// Edit setting.
				this.editSetting(message, settingName, settingValue);
				break;
			}

			// Bot local time.
			case "time" : {
				const date = new Date();
				const hours = date.getHours(), mins = date.getMinutes();
				const minute = mins + hours * 60;
				const time = hours + ":" + (mins >= 10 ? mins : "0" + mins);

				this.log(botGuild, "Bot local time is " + time);

				// Display time in direct messages
				if (!botGuild) {
					message.channel.send("It's **" + time + "** for me!");
				}

				else {
					var diff = minute - botGuild.latestTimeMinute;
					botGuild.latestTimeMinute = minute;

					if (diff == 0) botGuild.sameTimeStreak += 1;
					else botGuild.sameTimeStreak = 0;
					
					// The AI is an asshole?
					switch (botGuild.sameTimeStreak) {
						case 0 : {
							if (diff == 1) message.channel.send("Wow, it's **" + time + "** now. Who'd have guessed one minute has passed.");
							else if (diff <= 5) message.channel.send("Wow, it's **" + time + "** now. Who'd have guessed " + diff + " minutes have passed.");
							else message.channel.send("It's **" + time + "** for me!");
							break;
						}
						case 1 : { message.channel.send("It's still **" + time + "**."); break; }
						case 2 : { message.channel.send("Are you dumb or what?"); break; }
						case 3 : { message.channel.send("Fuck off."); break; }
					}
				}

				break;
			}

			// Server information.
			case "server" : {
				var embed = new Discord.RichEmbed({
					title: message.guild.name,
					thumbnail: {
						url: message.guild.iconURL
					},
					fields: [{
						name: "Owner",
						value: message.guild.owner.user.username + "#" + message.guild.owner.user.discriminator,
						inline: true
					}]
				});

				message.channel.send(embed);
			}

			// Set the text channel, in which the bot will talk.
			case "settalk" : {
				if (message.author.id != this.config.dommy || !args[0]) return;

				this.client.guilds.forEach((guild, guildId) => {
					guild.channels.forEach((channel, channelId) => {
						if (channelId == args[0]) {
							this.talkChannel = channel;
							message.channel.send("Channel set: <#" + channelId + ">");
						}
					});
				});

				break;
			}

			// Talk as the bot.
			case "talk" : {
				if (message.author.id != this.config.dommy) return;
				if (this.talkChannel !== false) this.talkChannel.send(args.join(" "));
				break;
			}
		}
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
	 * @param {Guild} botGuild - The guild message was sent in.
	 * @param {Message} message - The message sent.
	 * @returns {Boolean} `true` if the message was deleted.
	 */
	filterMessage(botGuild, message) {
		if (!botGuild || !message || !message.guild || message.author.id == this.client.id) return false;

		// Filter disabled.
		if (this.getSetting(botGuild, "enable-filter") !== true) return false;

		// Ignore admins.
		if (this.getSetting(botGuild, "filter-admins") !== true && this.hasControlOverBot(message.member)) return false;

		// Get filtered words list.
		const filteredWords = this.getSetting(botGuild, "filtered-words");
		const matchingWords = this.findFilteredWords(message.content, filteredWords);
		
		// Delete the message
		if (matchingWords.length > 0) {
			const username = message.author.username;

			message.delete()
				.then(() => {
					this.log(botGuild, "Deleted " + username + " message containing filtered phrases: " + matchingWords.join(", "));
					return true;
				})
				.catch(error => {
					this.log(botGuild, "Couldn't filter out a message: missing permissions.");
					// console.log(error);
					return false;
				});
		}
	}

	/**
	 * Reply with some preprogrammed text responses.
	 *
	 * @param {Guild} botGuild - The guild message was sent in.
	 * @param {Message} message - The message sent.
	 */
	premadeResponses(botGuild, message) {
		if (!botGuild || !message || !message.guild || message.author.id == this.client.id) return;

		// Responses disabled.
		if (this.getSetting(botGuild, "text-responses") !== true) return;

		// Get message user object.
		var botUser = this.getBotUser(message.author);

		// Pineapple does NOT go on pizza.
		if (message.content.match(/pizza/i) && message.content.match(/pineapple/i)) {
			this.log(botGuild, message.author.username + " is an idiot, who puts pineapple on their pizza.");
			message.reply("I really hope you don't have pineapple on your pizza.");
		}

		// I'm a good bot!
		else if (message.content.match(/good bot/i)) {
			this.log(botGuild, message.author.username + " likes me!");
			var replyContent = "";

			// They changed their mind.
			if (botUser.empathyBadBot) {
				switch (botUser.empathyChangeStreak) {
					case 0 : { replyContent = "Changed your mind, <@" + message.author.id + ">?"; break; }
					case 1 : { replyContent = "I see you're having fun."; break; }
					default : return;
				}

				botUser.empathyChangeStreak += 1;
			}

			// Reply depending on annoyance level.
			else {
				switch (botUser.annoyanceLevel) {
					case 0 : { replyContent = "Thank you, <@" + message.author.id + ">! :heart:"; break; }
					case 1 : { replyContent = "Thanks, <@" + message.author.id + ">!"; break; }
					case 2 : { replyContent = "Thank you."; break; }
					case 3 : { replyContent = "I get it, okay."; break; }
					case 4 : { replyContent = "You're so annoying..."; break; }
					case 5 : { replyContent = "I WON'T marry you."; break; }
					case 6 : { replyContent = "FUCK OFF."; break; }
					default : return;
				}

				botUser.empathyChangeStreak = 0;
			}

			botUser.empathyBadBot = false;
			botUser.empathyGoodBot = true;

			message.channel.send(replyContent);

			// Lower the user karma for repeating the message.
			botUser.lowerKarma();
		}
		
		// And I'm a bad bot.
		else if (message.content.match(/bad bot/i)) {
			this.log(botGuild, message.author.username + " doesn't like me.");
			//message.reply("https://i.giphy.com/media/L7LylDVYU10lO/giphy.webp");
			var replyContent = "";

			// They changed their mind.
			if (botUser.empathyGoodBot) {
				switch (botUser.empathyChangeStreak) {
					case 0 : { replyContent = "Changed your mind, <@" + message.author.id + ">?"; break; }
					case 1 : { replyContent = "I see you're having fun."; break; }
					default : return;
				}

				botUser.empathyChangeStreak += 1;
			}

			// Reply depending on annoyance level.
			else {
				switch (botUser.annoyanceLevel) {
					case 0 : {
						replyContent = "Am I supposed to cry now, <@" + message.author.id + ">?";
						botUser.askedToCryChannel = message.channel.id;
						break;
					}
					case 1 : { replyContent = "Pffffft."; break; }
					case 2 : { replyContent = "I don't care."; break; }
					case 3 : { replyContent = ":shrug:"; break; }
					default : return;
				}

				botUser.empathyChangeStreak = 0;
			}

			botUser.empathyGoodBot = false;
			botUser.empathyBadBot = true;

			message.channel.send(replyContent);

			// Lower the user karma for repeating the message.
			botUser.lowerKarma();
		}

		// I asked them if I should cry.
		else if (botUser.askedToCryChannel !== false) {
			if (message.content.match(/yes/i) && message.channel.id == botUser.askedToCryChannel) {
				message.channel.send("Okay <@" + message.author.id + ">. *Goes to a corner and pretends to cry.*");
				this.log(botGuild, message.author.username + " wants me to cry.");
			}

			botUser.askedToCryChannel = false;
		}

		// The AI is an asshole?
		else if (message.content.match(/bot/i) && message.content.match(/asshole/i)) {
			this.log(botGuild, message.author.username + " thinks the AI is an asshole.");
			message.channel.send("The AI is an asshole?");
			botUser.lowerKarma();
		}

		// GalaxyBot is annoying. Kinda.
		else if (message.content.match(new RegExp("(((<@" + this.config.dommy + ">|Dommy).+bots?)|(GalaxyBot|<@" + this.client.id + ">)).+(is|are).+annoying", "i"))) {
			this.log(botGuild, message.author.username + " thinks I'm annoying.");
			message.channel.send("<@" + message.author.id + "> You're annoying.");
			botUser.lowerKarma();
		}
	}

	/**
	 * Fired with every message bot can access.
	 *
	 * @param {Message} message - The message to handle.
	 */
	onMessage(message) {
		if (!message.author || message.author.bot || message.author.id == this.client.user.id) return;

		// Get message bot guild.
		var botGuild = this.getBotGuild(message.guild);
		if (botGuild) botGuild.name = message.guild.name;

		// Get message user object.
		var botUser = this.getBotUser(message.author);

		var commandPrefix = this.getSetting(botGuild, "prefix");
		var isCommand = message.content.startsWith(commandPrefix);
		
		// Send command to commands handler.
		if (isCommand) {
			var cmdArgs = message.content.split(" ");
			var cmdName = cmdArgs[0].replace(commandPrefix, "").toLowerCase();
			cmdArgs.shift();
			this.onCommand(botGuild, message, cmdName, cmdArgs);
		}

		// Delete messages with filtered words.
		if (this.filterMessage(botGuild, message)) return;

		// Premade text responses.
		this.premadeResponses(botGuild, message);

		// If bot is mentioned, send information about help command.
		if (message.author != this.client.user && message.isMentioned(this.client.user.id)) {
			message.channel.send("<@" + message.author.id + ">, need help with anything? Type **" + commandPrefix + "help** to see my commands! :raised_hands:");
		}

		// Convert units.
		/*
		this.units.findAndConvert(message.content, values => {
			if (!this.getSetting(botGuild, "unit-convert")) return;
			if (!values || values.length <= 0) return;
			message.reply("you mean " + values.join("; ") + ", right?");
		});
		*/

		// Check if message contains something about ManiaPlanet.
		if (message.content.match(/maniaplanet\.com/)) {
			// Link to a title page.
			var foundTitles = message.content.match(/maniaplanet\.com\/titles\/\w+@\w+/g);

			if (foundTitles && this.getSetting(botGuild, "embed-titles") === true) {
				for (var i = 0; i < foundTitles.length; i++) {
					var titleUid = foundTitles[i].split("/").pop();

					this.log(botGuild, "ManiaPlanet title link detected: " + titleUid);
					this.showTitleInfo(message, titleUid);
				}
			}

			// Link to a map page.
			var foundMaps = message.content.match(/maniaplanet\.com\/maps\/[A-Za-z0-9]+/g);

			if (foundMaps && this.getSetting(botGuild, "embed-maps") === true) {
				for (var i = 0; i < foundMaps.length; i++) {
					var mapUid = foundMaps[i].split("/").pop();

					this.log(botGuild, "ManiaPlanet map link detected: " + mapUid);
					this.showMapInfo(message, mapUid);
				}
			}
		}

		// Detect Mania Exchange map links.
		var foundMapsMX = message.content.match(/(tm|sm)\.mania-exchange\.com\/(tracks|maps|s\/tr)\/(view\/)?[0-9]+/g);

		if (foundMapsMX && this.getSetting(botGuild, "embed-mx") === true) {
			for (var i = 0; i < foundMapsMX.length; i++) {
				var mapMXID = foundMapsMX[i].split("/").pop();
				var site = foundMapsMX[i].substring(0, 2);

				this.log(botGuild, "MX link detected: " + site + " " + mapMXID);
				this.maniaexchange.maps(site, [mapMXID], mapInfo => {
					if (mapInfo) this.showMXInfo(message, site, mapInfo[0]);
				});
			}
		}

		// React with Joy.
		if (message.content.match(/😂|😹/i) && this.getSetting(botGuild, "mocking-joy") === true) {
			this.log(botGuild, message.author.username + " is using cancerous emoji.");
			message.react("yoy:398111076379525141");
			botUser.lowerKarma();

			// Enough?
			if (botUser.annoyanceLevel >= 3 && !this.warnedForJoyEmoji) {
				message.channel.send("Stop using this cancerous \"joy\" emoji <@" + message.author.id + ">, for fucks sake.");
				this.warnedForJoyEmoji = true;
			}

			// Reset counter
			if (this.warnedForJoyEmoji && botUser.annoyanceLevel < 3) {
				this.warnedForJoyEmoji = false;
			}
		}

		// React with Tomek.
		if (message.content.match(/tomek/i)) {
			this.log(botGuild, message.author.username + " is a big fan of Tomek.");
			message.react("tomkek:400401620078166017");
		}
	}

	/**
	 * Fired when someone has edited their message.
	 *
	 * @param {Message} messageOld - Old message.
	 * @param {Message} messageNew - Edited message.
	 */
	onEditedMessage(messageOld, messageNew) {
		// this.onMessage(messageNew);
		var botGuild = this.getBotGuild(messageNew.guild);

		// Delete messages with filtered words.
		if (this.filterMessage(botGuild, messageNew)) return;

		// Stalk members, who edit their messages.
		if (botGuild && this.getSetting(botGuild, "stalk-edits") && messageOld.content != messageNew.content) {
			messageOld.channel.send("I see you, <@" + messageOld.author.id + ">: ```" + messageOld.content.replace("`", "") + "```");
			this.log(botGuild, messageOld.author.username + " tried to be sneaky by editing their message.");
		}
	}

	/**
	 * Fired when someone reacts to a message.
	 *
	 * @param {messageReaction} reaction - The reaction user has contributed to.
	 * @param {User} user - The user, who added their reaction.
	 */
	onNewReaction(reaction, user) {
		if (!reaction || !user) return;

		var botGuild = this.getBotGuild(reaction.message.guild);

		// Filter the reaction.
		if (this.getSetting(botGuild, "enable-filter") === true) {
			// Get filtered words list.
			const filteredWords = this.getSetting(botGuild, "filtered-words");
			const matchingWords = this.findFilteredWords(reaction.emoji.name, filteredWords);

			// Find filtered words, if there are any.
			if (matchingWords.length > 0) {
				var applyFilter = true;

				// Ignore admins.
				if (this.getSetting(botGuild, "filter-admins") !== true) {
					reaction.message.guild.members.forEach((member, snowflake) => {
						if (member.id != user.id) return;
						if (this.hasControlOverBot(message.member)) applyFilter = false;
					});
				}

				// Delete the reaction.
				if (applyFilter) {
					reaction.remove(user)
						.then(() => {
							this.log(botGuild, "Deleted " + user.username + " reaction containing filtered phrases: " + matchingWords.join(", "));
						})
						.catch(error => {
							this.log(botGuild, "Couldn't filter out a reaction: missing permissions.");
							// console.log(error);
						});
				}
			}
		}
	}

	/**
	 * Fired when a member is updated.
	 *
	 * @param {GuildMember} oldMember - Previous member instance.
	 * @param {GuildMember} newMember - Updated member instance.
	 */
	onMemberUpdate(oldMember, newMember) {
		if (!oldMember || !newMember) return;

		var botGuild = this.getBotGuild(newMember.guild);

		// Filter the new nickname.
		if (this.getSetting(botGuild, "enable-filter") === true && newMember.nickname != "") {
			// Get filtered words list.
			const filteredWords = this.getSetting(botGuild, "filtered-words");
			const matchingWords = this.findFilteredWords(newMember.nickname, filteredWords);

			// Find filtered words, if there are any.
			if (matchingWords.length > 0) {
				// Ignore admins.
				var applyFilter = this.getSetting(botGuild, "filter-admins") === true || !this.hasControlOverBot(newMember);
				
				// Delete the reaction.
				if (applyFilter) {
					newMember.setNickname("", "Nickname contains filtered words.")
						.then(() => {
							this.log(botGuild, "Changed " + newMember.displayName + " name, which contained filtered phrases: " + matchingWords.join(", "));
						})
						.catch(error => {
							this.log(botGuild, "Couldn't filter out a nickname: missing permissions.");
							// console.log(error);
						});
				}
			}
		}
	}

	/**
	 * When a channel is destroyed.
	 *
	 * @param {Channel} channel - The channel that was just destroyed.
	 */
	onChannelDeleted(channel) {
		if (!channel) return;

		for (var i = 0; i < this.activeGuilds.length; i++) {
			var guild = this.activeGuilds[i];
			if (!guild.voiceConnection || guild.voiceConnection.channel != channel) continue;

			// React like if we used "stop". Okay, a little bit more upset.
			guild.lastTextChannel.send("HELLO? I WAS PLAYING MUSIC HERE! Thank you for destroying the party... :angry:");
			this.log(guild, "Someone deleted channel where bot was playing music.");

			guild.tracksQueue = [];
			if (guild.voiceConnection) guild.voiceConnection.channel.leave();
			if (guild.voiceDispatcher) guild.voiceDispatcher.end();
		}
	}

	/**
	 * When a guild is removed or bot is kicked.
	 *
	 * @param {Guild} guild - The guild we no longer are member of.
	 */
	onGuildDelete(guild) {
		if (!guild) return;
		var botGuild = this.getBotGuild(guild);
		if (!botGuild) return;

		// We"ve been kicked from the server.
		this.log("Kicked from guild: " + botGuild.name);
		if (botGuild.voiceConnection) botGuild.voiceConnection.channel.leave();
		if (botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
		this.activeGuilds.splice(botGuild, 1);
	}

	/**
	 * Create servers list of specific title.
	 *
	 * @param {Message} message - Message which requested servers list.
	 * @param {Object} servers - ManiaPlanet servers list.
	 * @param {String} titleUid - Id of the title.
	 */
	serversList(message, servers, titleUid) {
		if (!message || !servers || !titleUid) return;

		var botGuild = this.getBotGuild(message.guild);
		this.log(botGuild, "Obtained servers list.");

		this.maniaplanet.title(titleUid, title => {
			this.log(botGuild, "Obtained title information.");

			// Title not found.
			if (!title || title.code == 404) {
				message.channel.send("Sorry, I can't recognize the **" + titleUid + "** title... :shrug:");
				this.log(botGuild, "Title not found: " + titleUid);
				return;
			}

			var titleName = title.name;

			// No servers were found.
			if (servers.length <= 0) {
				message.channel.send("Looks like there are no online servers in **" + titleName + "** right now. :rolling_eyes:");
				this.log(botGuild, "No servers found in title: " + titleUid);
				return;
			}

			// List the found servers.
			var serversInfo = [];
			for (var i = 0; i < servers.length && i < 10; i++) {
				var server = servers[i];
				serversInfo.push((i+1) + ". " + server["player_count"] + "/" + server["player_max"] + " " + this.maniaplanet.stripFormatting(server["name"]));
			}

			// Servers list header.
			var messageHeader;
			switch (servers.length) {
				case 1 : { messageHeader = "There is **one " + titleName + "** server online:"; break; }
				case 11 : { messageHeader = "There are over **10 " + titleName + "** servers online:"; break; }
				default : { messageHeader = "There are **" + servers.length + " " + titleName + "** servers online:"; break; }
			}

			var embed = "```"+serversInfo.join("\n")+"```";
			message.channel.send(messageHeader + embed);
			this.log(botGuild, "Found " + servers.length + " servers in " + titleUid);
		});
	}

	/**
	 * Show information box about specific title.
	 *
	 * @param {Message} message - Message which requested title info.
	 * @param {String} titleUid - UID of the title to display.
	 */
	showTitleInfo(message, titleUid) {
		if (!message || !titleUid) return;

		var botGuild = this.getBotGuild(message.guild);
		this.log(botGuild, "Downloading title info: " + titleUid);

		this.maniaplanet.title(titleUid, title => {
			// Title not found.
			if (!title || title.code == 404) {
				message.channel.send("Sorry, I can't recognize the **" + titleUid + "** title... :shrug:");
				this.log(botGuild, "Title not found: " + titleUid);
				return;
			}

			// Punchline and description.
			var fields = [{
				name: '"' + this.maniaplanet.stripFormatting(title.punchline) + '"',
				value: this.maniaplanet.stripFormatting(title.description)
			}];

			// Title cost in Planets.
			if (title.cost && title.cost > 0) fields.push({
				name: "Cost",
				value: title.cost + " Planets",
				inline: true
			});

			// Registrations and online players.
			fields.push({
				name: "Registrations",
				value: title.registrations,
				inline: true
			}, {
				name: "Players last 24h",
				value: title.players_last24h,
				inline: true
			}, {
				name: "Online players",
				value: title.online_players,
				inline: true
			});

			// Title maker.
			if (title.title_maker_uid) fields.push({
				name: "Created with",
				value: title.title_maker_name,
				inline: true
			});

			// Color (3 digit hex > 6 digit hex > decimal).
			// THIS PART IS UGLY AF.
			var primary_color = title.primary_color.toString(16);
			var color = "";
			for (var i = 0; i < primary_color.length; i++) color += primary_color[i] + primary_color[i];
			color = parseInt(color, 16);

			// Create embed.
			var embed = new Discord.RichEmbed({
				author: {
					name: this.maniaplanet.stripFormatting(title.author_nickname),
					url: "https://www.maniaplanet.com/players/" + title.author_login
				},
				title: this.maniaplanet.stripFormatting(title.name),
				url: title.title_page_url,
				color: color,
				fields: fields,
				image: { url: title.card_url },
				timestamp: new Date(title.last_update * 1000).toISOString()
			});

			message.channel.send(embed);
			this.log(botGuild, "Successfully sent title info: " + titleUid);
		});
	}

	/**
	 * Show information box about specific map.
	 *
	 * @param {Message} message - Message which requested map info.
	 * @param {String} mapUid - UID of the map to display.
	 */
	showMapInfo(message, mapUid) {
		if (!message || !mapUid) return;

		var botGuild = this.getBotGuild(message.guild);
		this.log(botGuild, "Downloading map info: " + mapUid);

		this.maniaplanet.map(mapUid, map => {
			// Map not found.
			if (!map || map.code == 404) {
				message.channel.send("Sorry, I couldn't find information about this map: **" + mapUid + "**. :cry:");
				this.log(botGuild, "Map not found: " + mapUid);
				return;
			}

			var embed = new Discord.RichEmbed({
				title: this.maniaplanet.stripFormatting(map.name),
				url: "https://www.maniaplanet.com/maps/" + map.uid,
				image: { url: map.thumbnail_url },
				author: {
					name: map.author_login,
					url: "https://www.maniaplanet.com/players/" + map.author_login
				},
				description:
					"[**Play**](maniaplanet://www.maniaplanet.com/maps/"+map.uid+"/code/play) | " +
					"[**Download**]("+map.download_url+")"
			});

			message.channel.send(embed);
			this.log(botGuild, "Successfully sent map info: " + mapUid);
		});
	}

	/**
	 * Show current episode played in channel.
	 *
	 * @param {Message} message - Message which requested channel current episode.
	 * @param {String} channelId - ID of the channel to get current episode.
	 */
	showCurrentEpisode(message, channelId) {
		if (!message || !channelId) return;

		var botGuild = this.getBotGuild(message.guild);
		this.log(botGuild, "Downloading current channel episode: " + channelId);

		var endtime = parseInt(Date.now() / 1000);
		var starttime = endtime - 9000;

		this.maniaplanet.episodes(channelId, starttime, endtime, episodes => {
			// No episodes found.
			if (!episodes || episodes.code || episodes.length <= 0) {
				message.channel.send("There's nothing being played in this channel righ now, or we ran into some issue. :thinking:");
				this.log(botGuild, "Channel empty or request error: " + channelId);
				return;
			}

			var episode = episodes.pop();
			var embed = new Discord.RichEmbed({
				title: this.maniaplanet.stripFormatting(episode.program.name),
				url: "https://www.maniaplanet.com/programs/" + episode.program.id,
				description: this.maniaplanet.stripFormatting(episode.program.description),
				author: {
					name: this.maniaplanet.stripFormatting(episode.program.author.nickname),
					url: "https://www.maniaplanet.com/players/" + episode.program.author.login
				},
				image: { url: episode.program.image_url }
			});

			message.channel.send(embed);
			this.log(botGuild, "Successfully sent current episode: " + channelId);
		});
	}

	/**
	 * Show information about ManiaExchange map.
	 *
	 * @param {Message} message - Message which requested title info.
	 * @param {String} exchange - Site from which info was abtained.
	 * @param {Object} mapInfo - Information about the map.
	 */
	showMXInfo(message, exchange, mapInfo) {
		if (!message || !exchange || !mapInfo) return;

		var botGuild = this.getBotGuild(message.guild);

		var mxid = 0;
		if (mapInfo.TrackID) mxid = mapInfo.TrackID;
		if (mapInfo.MapID) mxid = mapInfo.MapID;
		if (mxid <= 0) return;

		// Environment name and map type.
		var fields = [{
			name: "Environment",
			value: mapInfo.EnvironmentName,
			inline: true
		}, {
			name: "Map type",
			value: mapInfo.MapType,
			inline: true
		}, {
			name: "Display cost",
			value: mapInfo.DisplayCost + " C",
			inline: true
		}];
		
		// Title pack.
		if (mapInfo.TitlePack) fields.push ({
			name: "Title pack",
			value: mapInfo.TitlePack,
			inline: true
		});

		// Vehicle name.
		if (mapInfo.VehicleName) fields.push({
			name: "Vehicle",
			value: mapInfo.VehicleName,
			inline: true
		});

		// Awards.
		if (mapInfo.AwardCount > 0) fields.push({
			name: "Awards",
			value: mapInfo.AwardCount,
			inline: true
		});

		// Track value.
		if (mapInfo.TrackValue > 0) fields.push({
			name: "Track value",
			value: "+ " + mapInfo.TrackValue,
			inline: true
		});

		// Online rating.
		if (mapInfo.RatingVoteCount > 0) fields.push({
			name: "Online rating",
			value: parseInt(mapInfo.RatingVoteAverage) + "% (" + mapInfo.RatingVoteCount + ")",
			inline: true
		});

		var embed = new Discord.RichEmbed({
			title: mapInfo.Name,
			url: "https://"+exchange+".mania-exchange.com/tracks/"+mxid,
			color: 0x7AD5FF,
			description: mapInfo.Comments.substring(0, 2048),
			author: {
				name: mapInfo.Username,
				url: "https://"+exchange+".mania-exchange.com/user/profile/"+mapInfo.UserID
			},
			fields: fields,
			image: { url: "https://"+exchange+".mania-exchange.com/tracks/screenshot/normal/"+mxid },
			footer: {
				text: "Mania Exchange",
				icon_url: "https://mania-exchange.com/Content/images/planet_mx_logo.png"
			},
			timestamp: mapInfo.UpdatedAt
		});

		message.channel.send(embed);
		this.log(botGuild, "Successfully sent MX map info: " + mapInfo.Name);
	}

	/**
	 * Get the guild setting.
	 *
	 * @param {Guild} botGuild - The guild to get setting from. Global settings used if undefined.
	 * @param {String} settingName - Name of the setting to get.
	 * @returns {mixed} Value of the setting in guild. `undefined` if not found.
	 */
	getSetting(botGuild, settingName) {
		if (!settingName) return undefined;

		if (botGuild && typeof botGuild.settings[settingName] !== 'undefined') return botGuild.settings[settingName];
		if (typeof this.config.settings[settingName] !== 'undefined') return this.config.settings[settingName];
		return undefined;
	}

	/**
	 * Edit the guild setting.
	 *
	 * @param {Message} message - Message in which command was sent.
	 * @param {String} settingName - Name of the setting to change.
	 * @param {String} settingValue - Value to set.
	 */
	editSetting(message, settingName, settingValue) {
		if (!message) return;

		// Get guild.
		var botGuild = this.getBotGuild(message.guild);
		if (!botGuild) return;

		// Available settings list.
		const possibleSet = {
			"prefix"			: "Character used to indicate commands.",
			"embed-mx"			: "Detect and send Mania Exchange links.",
			"embed-titles"		: "Detect and send ManiaPlanet titles links.",
			"embed-maps"		: "Detect and send ManiaPlanet maps links.",
			"roles"				: "Roles with permissions to manage the GalaxyBot settings and music player.",
			"max-duration"		: "Maximum duration (in seconds) of music tracks users without full permissions can play. 0 = no limit.",
			"unit-convert"		: "Convert imperial (retarded) unit system values into metric.",
			"music-cmd-ch"		: "The only channels, where music player commands are accepted.",
			"stalk-edits"		: "Mock members for editing their messages.",
			"limit-access"		: "Disable music player commands for users without enough rights.",
			"enable-filter"		: "Enable or disable the words filtering feature of the GalaxyBot. Requires GalaxyBot to have the **Manage messages** permission in text channels for messages and roles filtering, as well as **Manage nicknames** for nicknames filtering.",
			"filtered-words"	: "Remove messages, reactions and nicknames containing one (or more) of following words.",
			"filter-admins"		: "Whether the word filter should work on administrators and GalaxyBot managers.",
			"text-responses"	: "Let GalaxyBot react with some preprogrammed responses to messages.",
			"mocking-joy"		: "Make fun of people, who tend to overuse the 😂 joy emoji."
		};

		// Setting not specified.
		if (!settingName) {
			message.channel.send("To change a setting, specify `name` and `value` in this command. Available settings are: " + Object.keys(possibleSet).join(", ") + ".");
			this.log(botGuild, "Invalid command params: no setting name specified.");
			return;
		}

		// Unknown setting.
		if (!possibleSet[settingName]) {
			message.channel.send("Unknown setting: **" + settingName + "**. Send empty `settings` command to see available settings.");
			this.log(botGuild, "Unknown setting: " + settingName);
			return;
		}

		// Initialize settings, if not sreated yet.
		if (!botGuild.settings) botGuild.settings = new Object();

		// Change value of a setting.
		if (settingValue) {
			switch (settingName) {
				// Commands prefix.
				case "prefix" : {
					// Prefix must be 1 character long and shouldn"t be a white space.
					if (settingValue.length != 1 || settingValue == " ") {
						message.channel.send("Prefix can be only 1 character long and must be other character than white space.");
						return;
					}
					
					if (settingValue == this.config.settings.prefix) {
						delete botGuild.settings.prefix;
					} else {
						botGuild.settings.prefix = settingValue;
					}
					break;
				}

				// Mania Exchange and ManiaPlanet links embedding.
				case "embed-mx" :
				case "embed-titles" :
				case "embed-maps" : 
				case "stalk-edits" : 
				case "limit-access" :
				case "enable-filter" :
				case "filter-admins" :
				case "text-responses" :
				case "filter-admins" :
				case "mocking-joy" : {
					settingValue = settingValue.toLowerCase();

					// Setting must be boolean.
					if (settingValue != "false" && settingValue != "true") {
						message.channel.send("This setting has to be a boolean.");
						return;
					}

					var settingBoolean = settingValue === "true";

					if (settingBoolean == this.config.settings[settingName]) {
						delete botGuild.settings[settingName];
					} else {
						botGuild.settings[settingName] = settingBoolean;
					}
					break;
				}

				// Bot administrator roles.
				case "roles" : {
					var explode = settingValue.split(" ");
					var action = explode.shift();
					var roleName = explode.join(" ");
					var roleId = 0;
					var guildRoles = [];

					var currentRoles = [];
					if (botGuild.settings.roles) currentRoles = botGuild.settings.roles;

					// Find a role with matching name
					message.guild.roles.forEach((role, snowflake) => {
						guildRoles.push(snowflake);

						if (!role.name.match(roleName)) return;

						roleName = role.name;
						roleId = snowflake;
					});

					// Remove roles, which don't exist anymore.
					if (currentRoles.length > 0) {
						var cleanedList = [];

						for (var i = 0; i < currentRoles.length; i++) {
							var snowflake = currentRoles[i];
							if (guildRoles.indexOf(snowflake) == -1) continue;
							cleanedList.push(snowflake);
						}

						currentRoles = cleanedList;
						botGuild.settings.roles = currentRoles;
					}

					// Role not found.
					if (action != "" && roleId == 0) {
						message.channel.send("I couldn't find any role matching **" + roleName + "**.");
						this.log(botGuild, "Role not found.");
						return;
					} 

					// Add new role.
					if (action == "add") {
						// Role already exists.
						if (currentRoles.indexOf(roleId) != -1) {
							message.channel.send("This role already exists.");
							return;
						}
						else {
							currentRoles.push(roleId);
							botGuild.settings.roles = currentRoles;
						}
					}

					// Remove a role.
					else if (action == "remove") {
						// Role doesn't exist.
						if (currentRoles.indexOf(roleId) == -1) {
							message.channel.send("This role doesn't exist.");
							return;
						}
						else {
							currentRoles.splice(currentRoles.indexOf(roleId), 1);
							botGuild.settings.roles = currentRoles;
						}
					}

					// Incorrect action.
					else {
						message.channel.send("Specify a valid action to perform: `add` or `remove`.");
						return;
					}

					// Remove value if set to default.
					if (botGuild.settings.roles.length <= 0) {
						delete botGuild.settings.roles;
					}

					break;
				}

				// Maximum music track duration.
				case "max-duration" : {
					var settingInteger = parseInt(settingValue);

					// Invalid number.
					if (settingInteger < 0 || settingInteger > 3600) {
						message.channel.send("Enter a number in range 0 - 3600.");
						return;
					}

					if (settingInteger == this.config.settings[settingName]) {
						delete botGuild.settings[settingName];
					} else {
						botGuild.settings[settingName] = settingInteger;
					}
					break;
				}

				// Music player commands channels.
				case "music-cmd-ch" : {
					var explode = settingValue.split(" ");
					var action = explode.shift();
					var channelId = explode.join(" ").match(/[0-9]+/g);
					if (channelId) channelId = channelId.join();
					
					var currentChannels = this.config.settings["music-cmd-ch"];
					if (botGuild.settings["music-cmd-ch"]) currentChannels = botGuild.settings["music-cmd-ch"];

					// Remove channels, which don't exist anymore.
					if (currentChannels.length > 0) {
						var guildChannels = [];
						var cleanedList = [];

						message.guild.channels.forEach((channel, snowflake) => {
							if (channel.type != "text") return;
							guildChannels.push(snowflake);
						});

						for (var i = 0; i < currentChannels.length; i++) {
							var snowflake = currentChannels[i];
							if (guildChannels.indexOf(snowflake) == -1) continue;
							cleanedList.push(snowflake);
						}

						currentChannels = cleanedList;
						botGuild.settings["music-cmd-ch"] = currentChannels;
					}

					// Add new channel.
					if (action == "add") {
						var channelExists = false;

						message.guild.channels.forEach((channel, snowflake) => {
							if (channel.type != "text" || snowflake != channelId) return;
							channelExists = true;
						});

						// Channel doesn't exist.
						if (!channelExists) {
							message.channel.send("Channel doesn't exist or belongs to another server.");
							return;
						}
						// Channel already exists.
						else if (currentChannels.indexOf(channelId) != -1) {
							message.channel.send("This channel is already set.");
							return;
						}
						else {
							currentChannels.push(channelId);
							botGuild.settings["music-cmd-ch"] = currentChannels;
						}
					}

					// Remove a channel.
					else if (action == "remove") {
						// Channel doesn't exist.
						if (currentChannels.indexOf(channelId) == -1) {
							message.channel.send("This channel is not specified in the setting.");
							return;
						}
						else {
							currentChannels.splice(currentChannels.indexOf(channelId), 1);
							botGuild.settings["music-cmd-ch"] = currentChannels;
						}
					}

					// Incorrect action.
					else {
						message.channel.send("Specify a valid action to perform: `add` or `remove`.");
						return;
					}

					// Remove value if set to default.
					if (botGuild.settings["music-cmd-ch"].length <= 0) {
						delete botGuild.settings["music-cmd-ch"];
					}

					break;
				}

				// Word filter.
				case "filtered-words" : {
					// Look for invalid configuration.
					if (!this.config.filter || isNaN(this.config.filter.min) || isNaN(this.config.filter.max) || isNaN(this.config.filter.count)) {
						message.channel.send("Words filter configuration is invalid. Please contact the GalaxyBot owner!");
						this.log(botGuild, "Incorrect words filter configuration.");
						return;
					}

					var explode = settingValue.split(" ");
					var action = explode.shift();
					var word = explode.join(" ");

					var currentWords = [];
					if (botGuild.settings["filtered-words"]) currentWords = botGuild.settings["filtered-words"];

					// Word too short or too long.
					if (word.length < this.config.filter.min || word.length > this.config.filter.max) {
						message.channel.send("This word length doesn't match length requirement, try something between " + this.config.filter.min + " and " + this.config.filter.max + " characters.");
						this.log(botGuild, "Word \"" + word + "\" too short or too long.");
						return;
					} 

					// Add new word.
					if (action == "add") {
						// Word already exists.
						if (currentWords.indexOf(word) != -1) {
							message.channel.send("This word is already set in the filter.");
							this.log(botGuild, "Word \"" + word + "\" already exists.");
							return;
						}
						// Too many words.
						else if (this.config.filter.count > 0 && currentWords.length >= this.config.filter.count) {
							message.channel.send("You've reached the maximum number of filtered words (" + this.config.filter.count + ").");
							this.log(botGuild, "Filtered words words limit reached (" + this.config.filter.count + "/" + this.config.filter.count + ").");
							return;
						}
						else {
							currentWords.push(word);
							botGuild.settings["filtered-words"] = currentWords;
							this.log(botGuild, "Word \"" + word + "\" added (" + currentWords.length + "/" + this.config.filter.count + ").");
						}
					}

					// Remove a word.
					else if (action == "remove") {
						// Word doesn't exist.
						if (currentWords.indexOf(word) == -1) {
							message.channel.send("This word is not filtered.");
							this.log(botGuild, "Word \"" + word + "\" doesn't exist.");
							return;
						}
						else {
							currentWords.splice(currentWords.indexOf(word), 1);
							botGuild.settings["filtered-words"] = currentWords;
							this.log(botGuild, "Word \"" + word + "\" removed (" + currentWords.length + "/" + this.config.filter.count + ").");
						}
					}

					// Incorrect action.
					else {
						message.channel.send("Specify a valid action to perform: `add` or `remove`.");
						return;
					}

					// Remove value if set to default.
					if (botGuild.settings["filtered-words"].length <= 0) {
						delete botGuild.settings["filtered-words"];
					}

					break;
				}
			}

			botGuild.saveSettings();
			this.log(botGuild, "Updated settings of guild: " + botGuild.name);
		}

		// Show setting description, value and default.
		const isDefined = botGuild.settings[settingName] !== undefined;
		var defaultValue = this.config.settings[settingName];
		var currentValue = isDefined ? botGuild.settings[settingName] : defaultValue;

		// Bot control roles.
		if (settingName == "roles" && isDefined) {
			var rolesNames = [];

			message.guild.roles.forEach((role, snowflake) => {
				if (currentValue.indexOf(snowflake) < 0) return;
				rolesNames.push(role.name);
			});

			currentValue = rolesNames.join(", ");
		}

		// Music player channels.
		if (settingName == "music-cmd-ch" && isDefined) {
			var channelsTags = [];

			for (var i = 0; i < currentValue.length; i++) {
				var channelId = currentValue[i];
				channelsTags.push("<#" + channelId + ">");
			}

			currentValue = channelsTags.join(", ");
		}

		// Filtered words.
		if (settingName == "filtered-words" && isDefined) {
			currentValue = currentValue.join(", ");
		}

		message.channel.send(new Discord.RichEmbed({
			fields: [{
				name: settingName,
				value: possibleSet[settingName]
			}, {
				name: "Current value",
				value: (currentValue !== undefined ? currentValue : "<undefined>"),
				inline: true
			}, {
				name: "Default value",
				value: (defaultValue !== undefined ? defaultValue : "<undefined>"),
				inline: true
			}]
		}));

		this.log(botGuild, "Showing setting values: " + settingName);
	}
}

module.exports = GalaxyBot;
