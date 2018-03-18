// Dependencies.
const Discord = require("discord.js");
const yt_search = require("youtube-search");
const querystring = require("querystring");
const yaml = require("js-yaml");
const FB = require("fb");

const https = require("https");
const URL = require("url");
const fs = require("fs");

// Local classes.
const Track = require("./structures/Track.js");
const Guild = require("./structures/Guild.js");
const User = require("./structures/User.js");
const PendingCommand = require("./structures/PendingCommand.js");

// Integrations.
const ManiaPlanet = require("./integrations/ManiaPlanet.js");
const ManiaExchange = require("./integrations/ManiaExchange.js");

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

		this.config = null;
		this.activeGuilds = new Map();
		this.activeUsers = new Map();
		this.availableCommands = new Map();
		this.logsStream = null;
		this.statusesList = [];
		this.lastStatus = false;
		this.talkChannel = false;
		this.start();
	}

	/**
	 * Log a GalaxyBot action.
	 *
	 * @param {*} object - Guild or User the log is related to.
	 * @param {string} text - The message to be logged.
	 */
	log(object, text) {
		var group = "GLOBAL";
		if (object instanceof Guild) group = object.guild.name;
		if (object instanceof User) group = object.user.tag;

		var time = new Date().toISOString().substring(0, 19).replace("T", " ");
		var message = "[" + time + "] [" + group + "] " + text;

		// Log in the console.
		console.log(message);

		// Save logs to a file.
		if (this.logsStream != null) this.logsStream.write(message + "\n");
	}

	/**
	 * Remove mentions from the string.
	 *
	 * @param {String} text - The text to escape.
	 * @returns {String} The escaped string.
	 */
	escapeMentions(text) {
		if (typeof text !== "string") return "";
		
		var output = text;
		output = output.replace(/@everyone/i, "everyone");
		output = output.replace(/@here/i, "here");
		return output;
	}

	/**
	 * Start the GalaxyBot.
	 */
	start() {
		this.log(false, "Initializing GalaxyBot...");

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

		// Load commands from external files.
		fs.readdirSync("./commands/").forEach(file => {
			const command = require("./commands/" + file);
			this.availableCommands.set(command.name, command);
		});
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
		this.client.guilds.forEach((guild, guildId) => {
			var guild = this.getGalaxyBotGuild(guild);
		});
		this.log(false, "Active in " + this.activeGuilds.size + " guilds.");

		// Update ManiaPlanet servers statuses.
		this.updateServersStatuses();
		setInterval(() => { this.updateServersStatuses(); }, this.config.mpstatus.interval);
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
	 * Get the bot guild object of given guild.
	 *
	 * @param {Guild} guild - The quild to get bot guild.
	 * @returns {Guild} Bot guild object (no matter how stupid it sounds).
	 */
	getGalaxyBotGuild(guild) {
		if (!guild) return undefined;
		if (this.activeGuilds.has(guild.id)) return this.activeGuilds.get(guild.id);
		
		// Create new bot guild if doesn't exist yet.
		var guild = new Guild(guild, this);
		this.activeGuilds.set(guild.id, guild);
		return guild;
	}

	/**
	 * Get the bot user object of given user.
	 *
	 * @param {User} user - The user too get the object.
	 * @returns {User} The bot user object.
	 */
	getGalaxyBotUser(user) {
		if (!user) return false;
		if (this.activeUsers.has(user.id)) return this.activeUsers.get(user.id);
		
		// Create a new bot user if doesn't exist yet.
		var user = new User(user, this);
		this.activeUsers.set(user.id, user);
		return user;
	}

	/**
	 * New, improved commands handling.
	 *
	 * @param {PendingCommand} command - The command that's been sent.
	 */
	onCommand(command) {
		if (!command instanceof PendingCommand) return;

		// The command doesn't exist.
		if (!this.availableCommands.has(command.name)) return;

		// Log command.
		command.botGuild.log("Command sent by " + command.user.tag + ": " + command.name);

		// Get the command model.
		const commandModel = this.availableCommands.get(command.name);

		// Command is available only on servers.
		if (commandModel.serverOnly === true && command.botGuild.type != "guild") {
			command.channel.send("Sorry <@" + command.user.id + ">, this command is available only on servers!");
			command.botGuild.log("Command is available only in guilds.");
			return;
		}

		// Music player commands available only in whitelisted channels.
		if (commandModel.musicPlayer === true) {
			const musicTextChannels = command.botGuild.getSetting("music-cmd-ch");

			// Command sent in a not whitelisted channel.
			if (musicTextChannels && !musicTextChannels.includes(command.channel.id)) {
				var channelsTags = [];

				for (const channelId of musicTextChannels) {
					channelsTags.push("<#" + channelId + ">");
				}

				command.channel.send("You can't use music player commands in this channel, <@" + command.user.id + ">. Try in " + channelsTags.join(", ") + "!");
				command.botGuild.log("Music commands not allowed in #" + command.channel.name + ".");
				return;
			}

			// Save the last used text channel.
			command.botGuild.lastTextChannel = command.channel;
		}

		// Music player access is currently restricted.
		if (commandModel.limitedAccess === true && !command.botGuild.isGalaxyBotManager(command.member)) {
			const rolesList = command.botGuild.createRolesList();
			var rolesText = "";

			if (rolesList && rolesList.length > 0) {
				rolesText = " and members with one of following roles: " + rolesList.join(", ");
			}

			command.channel.send("Sorry <@" + command.user.id + ">, but you can't control the music player right now. I only accept commands from the server administrators" + rolesText + "!");
			command.botGuild.log("Music player has limited access.");
			return;
		}

		// Execute the command.
		commandModel.execute(command);
	}

	/**
	 * Update ManiaPlanet servers statuses in all guilds.
	 */
	updateServersStatuses() {
		this.activeGuilds.forEach((guild, guildId) => {
			guild.updateServersStatuses();
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
	 * @param {Guild} guild - The guild message was sent in.
	 * @param {Message} message - The message sent.
	 * @returns {Boolean} `true` if the message was deleted.
	 */
	filterMessage(guild, message) {
		if (!guild || !message || !message.guild || message.author.id == this.client.id) return false;

		// Filter disabled.
		if (guild.getSetting("enable-filter") !== true) return false;

		// Ignore admins.
		if (guild.getSetting("filter-admins") !== true && guild.isGalaxyBotManager(message.member)) return false;

		// Get filtered words list.
		const filteredWords = guild.getSetting("filtered-words");
		const matchingWords = this.findFilteredWords(message.content, filteredWords);
		
		// Delete the message
		if (matchingWords.length > 0) {
			const username = message.author.tag;

			message.delete().then(() => {
				guild.log("Deleted " + username + " message containing filtered phrases: " + matchingWords.join(", "));
				return true;
			})
			.catch(error => {
				guild.log("Couldn't filter out a message: missing permissions.");
				// console.log(error);
				return false;
			});
		}
	}

	/**
	 * Reply with some preprogrammed text responses.
	 *
	 * @param {Guild} guild - The guild message was sent in.
	 * @param {Message} message - The message sent.
	 */
	premadeResponses(guild, message) {
		if (!guild || !message || !message.guild || message.author.id == this.client.id) return;

		// Responses disabled.
		if (guild.getSetting("text-responses") !== true) return;

		// Get message user object.
		var user = this.getGalaxyBotUser(message.author);

		// Pineapple does NOT go on pizza.
		if (message.content.match(/pizza/i) && message.content.match(/pineapple/i)) {
			guild.log(message.author.tag + " is an idiot, who puts pineapple on their pizza.");
			message.reply("I really hope you don't have pineapple on your pizza.");
		}

		// I'm a good bot!
		else if (message.content.match(/good bot/i)) {
			guild.log(message.author.tag + " likes me!");
			var replyContent = "";

			// They changed their mind.
			if (user.empathyBadBot) {
				switch (user.empathyChangeStreak) {
					case 0 : { replyContent = "Changed your mind, <@" + message.author.id + ">?"; break; }
					case 1 : { replyContent = "I see you're having fun."; break; }
					default : return;
				}

				user.empathyChangeStreak += 1;
			}

			// Reply depending on annoyance level.
			else {
				switch (user.annoyanceLevel) {
					case 0 : { replyContent = "Thank you, <@" + message.author.id + ">! :heart:"; break; }
					case 1 : { replyContent = "Thanks, <@" + message.author.id + ">!"; break; }
					case 2 : { replyContent = "Thank you."; break; }
					case 3 : { replyContent = "I get it, okay."; break; }
					case 4 : { replyContent = "You're so annoying..."; break; }
					case 5 : { replyContent = "I WON'T marry you."; break; }
					case 6 : { replyContent = "FUCK OFF."; break; }
					default : return;
				}

				user.empathyChangeStreak = 0;
			}

			user.empathyBadBot = false;
			user.empathyGoodBot = true;

			message.channel.send(replyContent);

			// Lower the user karma for repeating the message.
			user.lowerKarma();
		}
		
		// And I'm a bad bot.
		else if (message.content.match(/bad bot/i)) {
			guild.log(message.author.tag + " doesn't like me.");
			//message.reply("https://i.giphy.com/media/L7LylDVYU10lO/giphy.webp");
			var replyContent = "";

			// They changed their mind.
			if (user.empathyGoodBot) {
				switch (user.empathyChangeStreak) {
					case 0 : { replyContent = "Changed your mind, <@" + message.author.id + ">?"; break; }
					case 1 : { replyContent = "I see you're having fun."; break; }
					default : return;
				}

				user.empathyChangeStreak += 1;
			}

			// Reply depending on annoyance level.
			else {
				switch (user.annoyanceLevel) {
					case 0 : {
						replyContent = "Am I supposed to cry now, <@" + message.author.id + ">?";
						user.askedToCryChannel = message.channel.id;
						break;
					}
					case 1 : { replyContent = "Pffffft."; break; }
					case 2 : { replyContent = "I don't care."; break; }
					case 3 : { replyContent = ":shrug:"; break; }
					default : return;
				}

				user.empathyChangeStreak = 0;
			}

			user.empathyGoodBot = false;
			user.empathyBadBot = true;

			message.channel.send(replyContent);

			// Lower the user karma for repeating the message.
			user.lowerKarma();
		}

		// I asked them if I should cry.
		else if (user.askedToCryChannel !== false) {
			if (message.content.match(/yes/i) && message.channel.id == user.askedToCryChannel) {
				message.channel.send("Okay <@" + message.author.id + ">. *Goes to a corner and pretends to cry.*");
				guild.log(message.author.tag + " wants me to cry.");
			}

			user.askedToCryChannel = false;
		}

		// The AI is an asshole?
		else if (message.content.match(/bot/i) && message.content.match(/asshole/i)) {
			guild.log(message.author.tag + " thinks the AI is an asshole.");
			message.channel.send("The AI is an asshole?");
			user.lowerKarma();
		}

		// GalaxyBot is annoying. Kinda.
		else if (message.content.match(new RegExp("(((<@" + this.config.dommy + ">|Dommy).+bots?)|(GalaxyBot|<@" + this.client.id + ">)).+(is|are).+annoying", "i"))) {
			guild.log(message.author.tag + " thinks I'm annoying.");
			message.channel.send("<@" + message.author.id + "> You're annoying.");
			user.lowerKarma();
		}

		// No u.
		else if (message.content.match(/(you|u)r? (mum|mom)? gay/i)) {
			message.channel.send("no u");
		}
	}

	/**
	 * Fired with every message bot can access.
	 *
	 * @param {Message} message - The message to handle.
	 */
	onMessage(message) {
		if (!message.author || message.author.bot || message.author.id == this.client.user.id) return;

		// Get message bot guild and bot user.
		var botGuild = this.getGalaxyBotGuild(message.guild);
		var botUser = this.getGalaxyBotUser(message.author);

		const guild = botGuild ? botGuild : botUser;
		
		// Delete messages with filtered words.
		if (this.filterMessage(guild, message)) return;

		const commandPrefix = guild.getSetting("prefix");
		const isCommand = message.content.startsWith(commandPrefix);
		
		// Send command to commands handler.
		if (isCommand) {
			const commandArguments = message.content.split(" ");
			const commandName = commandArguments.shift().replace(commandPrefix, "").toLowerCase();

			this.onCommand(new PendingCommand(this, botGuild, botUser, commandName, commandArguments, message));
			return;
		}

		// Premade text responses.
		this.premadeResponses(guild, message);

		// If bot is mentioned, send information about help command.
		if (message.isMentioned(this.client.user.id)) {
			message.channel.send("<@" + message.author.id + ">, need help with anything? Type **" + commandPrefix + "help** to see my commands! :raised_hands:");
			guild.log("GalaxyBot mentioned by " + message.author.tag);
		}

		// Check if message contains something about ManiaPlanet.
		if (message.content.match(/maniaplanet\.com/)) {
			// Link to a title page.
			var foundTitles = message.content.match(/maniaplanet\.com\/titles\/\w+@\w+/g);

			if (foundTitles && guild.getSetting("embed-titles") === true) {
				for (const link of foundTitles) {
					const titleUid = link.split("/").pop();

					guild.log("ManiaPlanet title link detected: " + titleUid);
					
					// Download the title information.
					ManiaPlanet.title(titleUid, titleInfo => {
						if (!titleInfo || titleInfo.code == 404) return;
						
						message.channel.send(ManiaPlanet.createTitleEmbed(titleInfo));
						guild.log("Successfully sent title info: " + ManiaPlanet.stripFormatting(titleInfo.name));
					});
				}
			}

			// Link to a map page.
			var foundMaps = message.content.match(/maniaplanet\.com\/maps\/[A-Z0-9_-]+/gi);

			if (foundMaps && guild.getSetting("embed-maps") === true) {
				for (const link of foundMaps) {
					const mapUid = link.split("/").pop();

					guild.log("ManiaPlanet map link detected: " + mapUid);
					
					// Download the map information.
					ManiaPlanet.map(mapUid, mapInfo => {
						if (!mapInfo || mapInfo.code == 404) return;
						
						message.channel.send(ManiaPlanet.createMapEmbed(mapInfo));
						guild.log("Successfully sent map info: " + ManiaPlanet.stripFormatting(mapInfo.name));
					});
				}
			}
		}

		// Detect Mania Exchange map links.
		var foundMapsMX = message.content.match(/(tm|sm)\.mania-exchange\.com\/(tracks|maps|s\/tr)\/(view\/)?[0-9]+/g);

		if (foundMapsMX && guild.getSetting("embed-mx") === true) {
			for (const link of foundMapsMX) {
				const mxid = link.split("/").pop();
				const site = link.substring(0, 2);

				guild.log("Mania Exchange link detected: " + site + " " + mxid);
				
				ManiaExchange.maps(site, [mxid], mapInfo => {
					if (!mapInfo || mapInfo.length <= 0) return;

					message.channel.send(ManiaExchange.createMapEmbed(mapInfo[0]));
					guild.log("Successfully sent Mania Exchange map info: " + mapInfo[0].Name);
				});
			}
		}

		// React with Joy.
		if (message.content.match(/😂|😹/i) && guild.getSetting("mocking-joy") === true) {
			guild.log(message.author.tag + " is using cancerous emoji.");
			message.react("yoy:398111076379525141");
			user.lowerKarma();

			// Enough?
			if (user.annoyanceLevel >= 3 && !user.warnedForJoyEmoji) {
				message.channel.send("Stop using this cancerous \"joy\" emoji <@" + message.author.id + ">, for fucks sake.");
				user.warnedForJoyEmoji = true;
			}

			// Reset counter
			if (user.warnedForJoyEmoji && user.annoyanceLevel < 3) {
				user.warnedForJoyEmoji = false;
			}
		}

		// React with Tomek.
		if (message.content.match(/tomek/i)) {
			guild.log(message.author.tag + " is a big fan of Tomek.");
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
		var guild = this.getGalaxyBotGuild(messageNew.guild);

		// Delete messages with filtered words.
		if (this.filterMessage(guild, messageNew)) return;

		// Stalk members, who edit their messages.
		if (guild && guild.getSetting("stalk-edits") && messageOld.content != messageNew.content) {
			messageOld.channel.send("I see you, <@" + messageOld.author.id + ">: ```" + messageOld.content.replace("`", "") + "```");
			guild.log(messageOld.author.username + " tried to be sneaky by editing their message.");
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

		var guild = this.getGalaxyBotGuild(reaction.message.guild);

		// Filter the reaction.
		if (guild.getSetting("enable-filter") === true) {
			// Get filtered words list.
			const filteredWords = guild.getSetting("filtered-words");
			const matchingWords = this.findFilteredWords(reaction.emoji.name, filteredWords);

			// Find filtered words, if there are any.
			if (matchingWords.length > 0) {
				var applyFilter = true;

				// Ignore admins.
				if (guild.getSetting("filter-admins") !== true) {
					reaction.message.guild.members.forEach((member, snowflake) => {
						if (member.id != user.id) return;
						if (guild.isGalaxyBotManager(message.member)) applyFilter = false;
					});
				}

				// Delete the reaction.
				if (applyFilter) {
					reaction.remove(user)
						.then(() => {
							guild.log("Deleted " + user.username + " reaction containing filtered phrases: " + matchingWords.join(", "));
						})
						.catch(error => {
							guild.log("Couldn't filter out a reaction: missing permissions.");
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

		var guild = this.getGalaxyBotGuild(newMember.guild);

		// Filter the new nickname.
		if (guild.getSetting("enable-filter") === true && newMember.nickname != "") {
			// Get filtered words list.
			const filteredWords = guild.getSetting("filtered-words");
			const matchingWords = this.findFilteredWords(newMember.nickname, filteredWords);

			// Find filtered words, if there are any.
			if (matchingWords.length > 0) {
				// Ignore admins.
				var applyFilter = guild.getSetting("filter-admins") === true || !guild.isGalaxyBotManager(newMember);
				
				// Delete the reaction.
				if (applyFilter) {
					newMember.setNickname("", "Nickname contains filtered words.")
						.then(() => {
							guild.log("Changed " + newMember.user.tag + " name, which contained filtered phrases: " + matchingWords.join(", "));
						})
						.catch(error => {
							guild.log("Couldn't filter out a nickname: missing permissions.");
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
		if (!channel || channel.type != "voice") return;

		this.activeGuilds.forEach((guild, guildId) => {
			if (!guild.voiceConnection || guild.voiceConnection.channel != channel) return;

			// React like if we used "stop". Okay, a little bit more upset.
			guild.lastTextChannel.send("HELLO? I WAS PLAYING MUSIC HERE! Thank you for destroying the party... :angry:");
			guild.log("Someone deleted channel where bot was playing music.");

			guild.tracksQueue = [];
			if (guild.voiceConnection) guild.voiceConnection.channel.leave();
			if (guild.voiceDispatcher) guild.voiceDispatcher.end();
		});
	}

	/**
	 * When a guild is removed or bot is kicked.
	 *
	 * @param {Guild} guild - The guild we no longer are member of.
	 */
	onGuildDelete(guild) {
		if (!guild) return;
		var guild = this.getGalaxyBotGuild(guild);
		if (!guild) return;

		// We"ve been kicked from the server.
		this.log("Kicked from guild: " + guild.name);
		if (guild.voiceConnection) guild.voiceConnection.channel.leave();
		if (guild.voiceDispatcher) guild.voiceDispatcher.end();
		this.activeGuilds.delete(guild.id);
	}
}

module.exports = GalaxyBot;
