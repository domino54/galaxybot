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
		this.client.on("channelDelete", channel => { this.onChannelDeleted(channel); });
		this.client.on("guildDelete", guild => { this.onGuildDelete(guild); })

		process.on("SIGINT", () => { this.end(); });
		process.on("SIGTERM", () => { this.end(); });
		process.on("SIGHUP", () => { this.end(); });
		process.on("SIGBREAK", () => { this.end(); });

		this.maniaplanet = new ManiaPlanet();
		this.mx = new ManiaExchange();
		this.units = new Units();
		this.config = false;
		this.activeGuilds = [];

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
		console.log("["+time+"] ["+guildName+"] " + text);
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
		}
		// Discord token not specified.
		else if (!this.config.discord || !this.config.discord.token) {
			console.log("Configuration error: Discord token is not specified in config.yml!");
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
		this.client.user.setGame("with Dommy");

		// Register already existing guilds.
		this.client.guilds.forEach((guild, guildId) => {
			var botGuild = this.getBotGuild(guild);
		});
	}

	/**
	 * Fired when terminal or console is killed.
	 */
	end() {
		this.client.destroy();
		process.exit();
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
	 * Compose a message.
	 * Replaces nodes (%n) with arguments provided.
	 *
	 * @returns {String} The composed message.
	 */
	compose() {
		if (arguments.length == 0) return "";
		if (arguments.length == 1) return arguments[0];
		var output = arguments[0];
		for (var i = 1; i < arguments.length; i++) output = this.replaceAll(output, "%"+i, arguments[i]);
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

		// Create new bot guild if doesn"t exist yet.
		var botGuild = new Guild(guild.id);
		this.activeGuilds.push(botGuild);
		this.log(false, "New guild registered: " + guild.name);
		return botGuild;
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
		if (member.id == this.config.dommy || member.hasPermission("ADMINISTRATOR")) return true; ///< I"m the god of this module.

		var botGuild = this.getBotGuild(member.guild);
		var modRoles = this.getSetting(botGuild, "roles").split(",");
		var matchingRoles = 0;

		member.roles.forEach((role, roleId) => {
			if (modRoles.indexOf(role.name) != -1) matchingRoles++;
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

			this.log(botGuild, "Creating new voice dispatcher.");
		}
		catch (error) {
			botGuild.lastTextChannel.send("Something must've gone wrong with last track, I couldn't play it...");
			console.log(error);
			this.playNextTrack(botGuild);
			return;
		}

		if (botGuild.voiceDispatcher) {
			botGuild.voiceDispatcher.on("end", reason => {
				botGuild.currentTrack = false;
				botGuild.voiceDispatcher = false;
				this.log(botGuild, "Voice dispatcher end.");

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
		}
		
		// We are playing something.
		else {
			var header = "Now playing:";

			if (withMention) {
				if (botGuild.currentTrack.isLivestream) {
					header = this.compose("I'm tuned up for the livestream, <@%1>! :red_circle:", botGuild.currentTrack.sender.id);
				} else {
					header = this.compose("I'm playing your track now, <@%1>! :metal:", botGuild.currentTrack.sender.id);
				}
			}

			// Current play point.
			if (!botGuild.currentTrack.isLivestream && !withMention) {
				const current = botGuild.currentTrack.timeToText(parseInt(botGuild.voiceDispatcher.time / 1000));
				const total = botGuild.currentTrack.timeToText(botGuild.currentTrack.duration);

				botGuild.currentTrack.embed.description = current+" / "+total;
			}

			botGuild.lastTextChannel.send(header, botGuild.currentTrack.embed);
		}
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

		// (Let"s just ignore the fact we"re in "onTrackCreated" method) Track not created.
		if (!track) {
			botGuild.lastTextChannel.send(this.compose("Sorry <@%1>, but I can't play anything from that link. :shrug:", member.id));
			this.log(botGuild, this.compose("Track %1 not added: no information.", url));
			return;
		}

		// Unsupported link type.
		if (track === "unsupported") {
			botGuild.lastTextChannel.send(this.compose("I can't play that link, <@%1>. Make sure you're requesting something from YouTube, Facebook or Streamable. :rolling_eyes:", member.id));
			this.log(botGuild, this.compose("Track %1 not added: unsupported host.", url));
			return;
		}

		// User without permissions attempts to play livestream.
		if (track.isLivestream && !hasPermissions) {
			botGuild.lastTextChannel.send(this.compose("Sorry <@%1>, you don't have permissions to add livestreams. :point_up:", member.id));
			this.log(botGuild, this.compose("Track %1 not added: no permission to play livestream."), track.title);
			return;
		}

		// Track is too long and user has no permission to surpass the limit.
		const maxDuration = this.getSetting(botGuild, "max-duration");
		if (!hasPermissions && maxDuration > 0 && track.duration > maxDuration) {
			botGuild.lastTextChannel.send(this.compose(
				"Sorry <@%1>, **%2** is too long! (%3/%4) :rolling_eyes:",
				member.id, track.title, track.timeToText(track.duration), track.timeToText(maxDuration)
			));
			this.log(botGuild, this.compose("Track %1 not added: too long (%2/%3).", url, track.duration, maxDuration));
			return;
		}

		// DES-PA-CITO.
		if (track.title && track.title.toLowerCase().indexOf("despacito") >= 0) {
			botGuild.lastTextChannel.send("Anything related to \"Despacito\" is FUCKING BLACKLISTED. :middle_finger:");
			this.log(botGuild, this.compose("Track %1 not added: blacklisted.", url));
			return;
		}

		this.log(botGuild, "Track successfully added: " + track.title);

		// Queue new track.
		const isNext = (param === "now" || param === "next") && botGuild.tracksQueue.length > 0;
		const isNow = param === "now" && hasPermissions;

		if (isNext && hasPermissions) {
			if (isNow) botGuild.lastTextChannel.send(this.compose("Okay <@%1>, let's play it right now! :smirk:", member.id));
			botGuild.tracksQueue.unshift(track);
		} else {
			if (isNext) botGuild.lastTextChannel.send(this.compose("Sorry <@%1>, you can't queue track next, nor play it immediately. :rolling_eyes:", member.id));
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
		else if (isNow && botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
		
		// Show queue message.
		else {
			var position = botGuild.tracksQueue.indexOf(track) + 1;
			botGuild.lastTextChannel.send(this.compose("<@%1>, your track is **#%2** in the queue:", member.id, position), track.embed);
		}
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

		// Server-only command in DM.
		if (!botGuild) {
			const guildCommands = ["dommy", "play", "undo", "now", "next", "queue", "skip", "stop", "pause", "setting"];

			if (guildCommands.indexOf(name) != -1) {
				message.channel.send("Sorry, this command works only on servers!");
				return;
			}
		}

		// Update latest text channel for music commands
		const musicCommands = ["play", "undo", "now", "next", "queue", "skip", "stop", "pause"];

		if (musicCommands.indexOf(name) != -1) {
			// Ignore command if not seend in exclusive channel
			var musicTextChannels = this.getSetting(botGuild, "music-cmd-ch");

			if (musicTextChannels.length > 0 && musicTextChannels.indexOf(message.channel.id) == -1) {
				var channelsTags = [];

				for (var i = 0; i < musicTextChannels.length; i++) {
					var channelId = musicTextChannels[i];
					channelsTags.push("<#" + channelId + ">");
				}

				message.channel.send(this.compose("Can't use music player commands in this channel. Try in %1!", channelsTags.join(", ")));
				return;
			}

			botGuild.lastTextChannel = message.channel;
		}
		
		// Log command.
		this.log(botGuild, this.compose("Command sent by %1: %2", message.author.username, name));

		switch (name) {
			// Show available commands list.
			case "help" : {
				var commandPrefix = this.getSetting(botGuild, "prefix");
				message.channel.send(this.compose(this.helpPage, message.author.id, commandPrefix));
				break;
			}

			// Mention Dommy.
			case "dommy" : {
				message.channel.send(this.compose("<@%1> https://giphy.com/gifs/movie-mrw-see-2H67VmB5UEBmU", this.config.dommy));
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
				message.channel.send(this.compose(
					"Want me to party hard with you on your server? Use the link below! :sunglasses:\n" +
					"https://discordapp.com/oauth2/authorize?client_id=%1&scope=bot", this.client.user.id
				));
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
						message.channel.send(this.compose("Sorry <@%1>, I couldn't find user named **%2**. :rolling_eyes:", message.author.id, name));
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
					message.channel.send(this.compose(
						"<@%1>, you need to specify `titleUid` in this command. Type `titleUid` after command or use one of these short codes: %2.",
						message.author.id, this.maniaplanet.getTitleCodes().join(", ")
					));
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
					message.channel.send(this.compose(
						"<@%1>, you need to specify `titleUid` in this command. Type `titleUid` after command or use one of these short codes: %2.",
						message.author.id, this.maniaplanet.getTitleCodes().join(", ")
					));
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
					message.channel.send(this.compose("<@%1>, you need to specify the map `UID` in this command.", message.author.id));
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
					message.channel.send(this.compose("<@%1>, I need to know if you mean `sm` or `tm` channel. :thinking:", message.author.id));
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
						message.channel.send(this.compose("<@%1>, currently there are only two channels: `sm` and `tm`. :shrug:", message.author.id));
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
					message.channel.send(this.compose("<@%1>, please specify which Mania Exchange do you want me to use: `sm` or `tm`. :point_up:", message.author.id));
					this.log(botGuild, "No Exchange specified.");
					return;
				}

				// Get Exchange.
				const exchange = args[0].toLowerCase();
				if (exchange != "tm" && exchange != "sm") {
					message.channel.send(this.compose("<@%1>, we have only `sm` and `tm` Mania Exchange. :shrug:", message.author.id));
					this.log(botGuild, "Unknown Exchange.");
					return;
				}

				// No more params specified.
				if (args.length < 2) {
					message.channel.send(this.compose("<@%1>, would be really nice if you told me the `mxid` or search for a map name. :shrug:", message.author.id));
					this.log(botGuild, "No mxid or search query specified.");
					return;
				}

				// Get map information by mxid.
				const mxid = parseInt(args[1]);
				if (args.length == 2 && mxid > 0) {
					this.log(botGuild, this.compose("Searching for mxid %1 in %2 Exchange...", mxid, exchange));

					this.mx.maps(exchange, [mxid], mapInfo => {
						// Not found
						if (!mapInfo || mapInfo.length <= 0) {
							message.channel.send(this.compose("Sorry <@%1>, I couldn't find map with id **%2**. :cry:", message.author.id, mxid));
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
					this.log(botGuild, this.compose("Searching for \"%1\" in %2 Exchange...", mapName, exchange));

					this.mx.search(exchange, { trackname: mapName, limit: 1 }, mapsInfo => {
						// No results.
						if (!mapsInfo || !mapsInfo.results || mapsInfo.results.length <= 0) {
							message.channel.send(this.compose("Sorry <@%1>, I couldn't find any map called **%2**. :cry:", message.author.id, mapName));
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
							message.channel.send(this.compose("Your next track is **#%1** in the queue, <@%2>:", i+1, message.member.id), track.createEmbed());
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
					message.channel.send(this.compose("Queue is only **%1** track%2 long. :shrug:", botGuild.tracksQueue.length, (botGuild.tracksQueue.length > 1 ? "s" : "")));
					break;
				}

				var header = "Up next:";
				if (trackOrder > 0) header = this.compose("**#%1** in the queue:", trackOrder + 1);
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
					tracksInfos.push(this.compose("`%1.` **%2** (requested by %3)", ((i<9) ? "0" : "") + (i+1), track.title, track.sender.displayName));
				}
				message.channel.send("Up next:\n" + tracksInfos.join("\n"));
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
					message.channel.send(this.compose("Only server administrators and people with at least one of following roles can stop me: %1. :point_up:", modRoles.join(", ")));
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
				message.channel.send(this.compose("<@%1>, I removed your latest track, **%2**.", message.member.id, trackToRemove.title));
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
				var url = args[0];
				var query = args.join(" ");

				this.log(botGuild, this.compose("Track requested by %1: %2", message.member.displayName, query));

				// Try to load track from given URL.
				if (URL.parse(url).hostname) {
					var track = new Track(url, message.member, (track) => {
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
						 	var track = new Track(results[0].link, message.member, (track) => {
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

			// List all guilds the bot is active in.
			case "guilds" : {
				if (message.author.id != this.config.dommy) {
					message.channel.send("Sorry, only my creator is allowed to perform this operation.");
					return;
				}

				// Privacy is important.
				if (message.channel.type != "dm") {
					message.channel.send("For security reasons, I can only send the guilds list in a private message.");
					return;
				}

				var serversNames = [];
				this.client.guilds.forEach((guild, guildId) => {
					serversNames.push(guild == message.guild ? "**"+guild.name+"**" : guild.name);
				});
				message.channel.send(this.compose("I'm active in **%1** server%2: %3.", this.client.guilds.size, (this.client.guilds.size == 1 ? "" : "s"), serversNames.join(", ")));
				break;
			}

			// Change bot settings in guild.
			case "settings" : {
				// No permissions to tweak settings
				if (!this.hasControlOverBot(message.member)) {
					message.channel.send(this.compose("Sorry <@%1>, you don't have permissions to modify my settings. :no_entry_sign:", message.member.id));
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

				// Display time in direct messages
				if (!botGuild) {
					message.channel.send(this.compose("It's **%1** for me!", time));
				}

				else {
					var diff = minute - botGuild.latestTimeMinute;
					botGuild.latestTimeMinute = minute;

					if (diff == 0) botGuild.sameTimeStreak += 1;
					else botGuild.sameTimeStreak = 0;
					
					// The AI is an asshole?
					switch (botGuild.sameTimeStreak) {
						case 0 : {
							if (diff == 1) message.channel.send(this.compose("Wow, it's **%1** now. Who'd have guessed one minute has passed.", time));
							else if (diff <= 5) message.channel.send(this.compose("Wow, it's **%1** now. Who'd have guessed %2 minutes have passed.", time, diff));
							else message.channel.send(this.compose("It's **%1** for me!", time));
							break;
						}
						case 1 : {
							message.channel.send(this.compose("It's still **%1**.", time));
							break;
						}
						case 2 : {
							message.channel.send(this.compose("Are you dumb or what?", time));
							break;
						}
						case 3 : {
							message.channel.send(this.compose("Fuck off.", time));
							break;
						}
					}
				}

				break;
			}
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

		var commandPrefix = this.getSetting(botGuild, "prefix");
		var isCommand = message.content.startsWith(commandPrefix);
		
		// Send command to commands handler.
		if (isCommand) {
			var cmdArgs = message.content.split(" ");
			var cmdName = cmdArgs[0].replace(commandPrefix, "").toLowerCase();
			cmdArgs.shift();
			this.onCommand(botGuild, message, cmdName, cmdArgs);
		}

		// If bot is mentioned, send information about help command.
		if (message.author != this.client.user && message.content.indexOf(this.client.user.id) >= 0) {
			message.channel.send(this.compose("<@%1>, need help with anything? Type **%2help** to see my commands! :raised_hands:", message.author.id, commandPrefix));
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
		if (message.content.toLowerCase().indexOf("maniaplanet") >= 0) {
			var explode = message.content.split("/");
			
			// Link to a title page.
			if (message.content.match(/maniaplanet\.com\/titles\/\w+@\w+/) && this.getSetting(botGuild, "embed-titles")) {
				var titleUid = "";

				for (var i = explode.length - 1; i >= 0; i--) {
					var part = explode[i];
					if (part.indexOf("@") < 0) continue;
					titleUid = part;
					break;
				}

				if (titleUid) this.showTitleInfo(message, titleUid);
			}

			// Link to a map page.
			else if (message.content.match(/maniaplanet\.com\/maps\/[A-Za-z0-9]+/) && this.getSetting(botGuild, "embed-maps")) {
				var mapUid = "";
				var prevWasMaps = false;

				for (var i = 0; i < explode.length; i++) {
					var part = explode[i];
					if (prevWasMaps) { mapUid = part; break; }
					prevWasMaps = part == "maps";
				}

				if (mapUid) this.showMapInfo(message, mapUid);
			}
		}

		// Detect Mania Exchange map links.
		var matchMX = message.content.match(/(tm|sm)\.mania-exchange\.com\/(tracks|maps|s\/tr)\/(view\/)?[0-9]+/);
		if (matchMX && this.getSetting(botGuild, "embed-mx")) {
			var explode = message.content.split("/");
			var site = false;
			var mxid = 0;

			for (var i = 0; i < explode.length; i++) {
				var part = explode[i];
				if (part == "tm.mania-exchange.com") site = "tm";
				if (part == "sm.mania-exchange.com") site = "sm";
				var possibleId = parseInt(part);
				if (isNaN(possibleId) || possibleId <= 0) continue;
				mxid = possibleId;
				break;
			}

			if (site && mxid > 0) {
				this.log(botGuild, "MX link detected: "+site+" "+mxid);
				this.mx.maps(site, [mxid], mapInfo => {
					if (mapInfo) this.showMXInfo(message, site, mapInfo[0]);
				});
			}
		}

		// Responses below DO stack up.

		// React with Tomek.
		if (message.content.match(/tomek/i)) {
			message.react("tomkek:400401620078166017");
		}

		// React with Joy.
		if (message.content.match(/(:joy:)|😂/i)) {
			message.react("yoy:398111076379525141");
		}

		// Markiel.
		if (message.content.match(/markiel/i)) {
			message.react("markiel:258199535673671680");
			message.channel.send({files: ["./markiel.png"]});
		}

		// Responses below DO NOT stack up.

		// Pineapple does NOT go on pizza.
		if (message.content.match(/pizza/i) && message.content.match(/pineapple/i)) {
			message.reply("I really hope you don't have pineapple on your pizza.");
		}

		// Reddit, pretty much.
		else if (message.content.match(/good bot/i)) {
			message.channel.send(this.compose("Thank you, <@%1>! :heart:", message.author.id));
		}
		
		else if (message.content.match(/bad bot/i)) {
			message.reply("https://i.giphy.com/media/L7LylDVYU10lO/giphy.webp");
		}

		// The AI is an asshole?
		else if (message.content.match(/bot/i) && message.content.match(/asshole/i)) {
			message.channel.send("The AI is an asshole?");
		}

		// Is Mei really a bae?
		else if (message.content.match(/mei/i) && message.content.match(/bae/i)) {
			var overwatchHeroes = [
				"Doomfist", "Genji", "McCree", "Pharah", "Reaper", "Soldier: 76", "Sombra", "Tracer",
				"Bastion", "Hanzo", "Junkrat", "Torbjörn", "Widowmaker", "D. Va", "Orisa", "Reinhardt",
				"Roadhog", "Winston", "Zarya", "Ana", "Lúcio", "Mercy", "Moira", "Symmetra", "Zenyatta"
			];

			var rand = Math.floor(Math.random() * (overwatchHeroes.length - 1));
			var heroName = overwatchHeroes[rand];
			message.channel.send(this.compose("%1 is far better than Mei, <@%2>.", heroName, message.author.id));
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

		// Stalk members, who edit their messages.
		if (botGuild && this.getSetting(botGuild, "stalk-edits")) {
			messageOld.channel.send("I see you, <@" + messageOld.author.id + ">: ```" + messageOld.content + "```");
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
				message.channel.send(this.compose("Sorry, I can't recognize the **%1** title... :shrug:", titleUid));
				this.log(botGuild, "Title not found: " + titleUid);
				return;
			}

			var titleName = title.name;

			// No servers were found.
			if (servers.length <= 0) {
				message.channel.send(this.compose("Looks like there are no online servers in **%1** right now. :rolling_eyes:", titleName));
				this.log(botGuild, "No servers found in title: " + titleUid);
				return;
			}

			// List the found servers.
			var serversInfo = [];
			for (var i = 0; i < servers.length && i < 10; i++) {
				var server = servers[i];
				serversInfo.push(this.compose(
					"%1. %2/%3 %4", i+1, server["player_count"], server["player_max"],
					this.maniaplanet.stripFormatting(server["name"])
				));
			}

			// Servers list header.
			var messageHeader;
			switch (servers.length) {
				case 1 : { messageHeader = this.compose("There is **one %1** server online:", titleName); break; }
				case 11 : { messageHeader = this.compose("There are over **10 %1** servers online:", titleName); break; }
				default : { messageHeader = this.compose("There are **%1 %2** servers online:", servers.length, titleName); break; }
			}

			var embed = "```"+serversInfo.join("\n")+"```";
			message.channel.send(messageHeader + embed);
			this.log(botGuild, this.compose("Found %1 servers in %2", servers.length, titleUid));
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
				message.channel.send(this.compose("Sorry, I can't recognize the **%1** title... :shrug:", titleUid));
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
				message.channel.send(this.compose("Sorry, I couldn't find information about this map: **%1**. :cry:", mapUid));
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

		if (botGuild && botGuild.settings[settingName]) return botGuild.settings[settingName];
		if (this.config.settings[settingName]) return this.config.settings[settingName];
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
			"prefix": "Character used to indicate commands.",
			"embed-mx": "Detect and send Mania Exchange links.",
			"embed-titles": "Detect and send ManiaPlanet titles links.",
			"embed-maps": "Detect and send ManiaPlanet maps links.",
			"roles": "Roles with permissions to manage GalaxyBot.",
			"max-duration": "Maximum duration (in seconds) of music tracks users without full permissions can play. 0 = no limit.",
			"unit-convert": "Convert imperial (retarded) unit system values into metric.",
			"music-cmd-ch": "The only channels, where music player commands are accepted.",
			"stalk-edits": "Mock members for editing their messages."
		};

		// Setting not specified.
		if (!settingName) {
			message.channel.send(this.compose("To change a setting, specify `name` and `value` in this command. Available settings are: %1.", Object.keys(possibleSet).join(", ")));
			this.log(botGuild, "Invalid command params: no setting name specified.");
			return;
		}

		// Unknown setting.
		if (!possibleSet[settingName]) {
			message.channel.send(this.compose("Unknown setting: **%1**. Send empty `settings` command to see available settings.", settingName));
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
				case "unit-convert" : {
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

					var currentRoles = this.config.settings.roles.split(",");
					if (botGuild.settings.roles) currentRoles = botGuild.settings.roles.split(",");

					// Add new role.
					if (action == "add") {
						// Role already exists.
						if (currentRoles.indexOf(roleName) != -1) {
							message.channel.send("This role already exists.");
							return;
						}
						else {
							currentRoles.push(roleName);
							var targetValue = currentRoles.join(",");

							// Value too long
							if (targetValue.length > 256) {
								message.channel.send("Couldn't add new role, roles list would be too long!");
								return;
							}

							else botGuild.settings.roles = targetValue;
						}
					}

					// Remove a role.
					else if (action == "remove") {
						// Role doesn't exist.
						if (currentRoles.indexOf(roleName) == -1) {
							message.channel.send("This role doesn't exist.");
							return;
						}
						else {
							currentRoles.splice(currentRoles.indexOf(roleName), 1);
							botGuild.settings.roles = currentRoles.join(",");
						}
					}

					// Incorrect action.
					else {
						message.channel.send("Specify a valid action to perform: `add` or `remove`.");
						return;
					}

					// Remove value if set to default.
					if (botGuild.settings.roles == this.config.settings.roles) {
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
			}

			botGuild.saveSettings();
			this.log(botGuild, "Updated settings of guild: " + botGuild.name);
		}

		// Show setting description, value and default.
		const isDefined = botGuild.settings[settingName] !== undefined;
		var defaultValue = this.config.settings[settingName];
		var currentValue = isDefined ? botGuild.settings[settingName] : defaultValue;

		// Music player channels.
		if (settingName == "music-cmd-ch") {
			defaultValue = "";

			var channelsTags = [];
			for (var i = 0; i < currentValue.length; i++) {
				var channelId = currentValue[i];
				channelsTags.push("<#" + channelId + ">");
			}
			currentValue = channelsTags.join(", ");
		}

		message.channel.send(new Discord.RichEmbed({
			fields: [{
				name: settingName,
				value: possibleSet[settingName]
			}, {
				name: "Current value",
				value: (currentValue !== "" ? currentValue : "<undefined>"),
				inline: true
			}, {
				name: "Default value",
				value: (defaultValue !== "" ? defaultValue : "<undefined>"),
				inline: true
			}]
		}));

		this.log(botGuild, "Showing setting values: " + settingName);
	}
}

module.exports = GalaxyBot;
