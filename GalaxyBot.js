// Dependencies.
const Discord = require("discord.js");
const querystring = require("querystring");
const stringSimilarity = require("string-similarity");
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
const MPForum = require("./integrations/MPForum.js");
const RedditFeed = require("./integrations/RedditFeed.js");

/**
 * The GalaxyBot itself.
 */
class GalaxyBot {
	/**
	 * Creates a new GalaxyBot.
	 *
	 * @constructor
	 */
	constructor() {
		process.on("SIGINT", () => { this.end(); });
		process.on("SIGTERM", () => { this.end(); });
		process.on("SIGHUP", () => { this.end(); });
		process.on("SIGBREAK", () => { this.end(); });

		this.config = null;
		this.version = null;
		this.github = null;
		this.reddit = null;

		this.activeGuilds = new Map();
		this.activeUsers = new Map();
		this.availableCommands = new Map();
		this.commandAliases = new Map();

		this.isYouTubeAvailable = false;
		this.logsStream = null;
		this.statusesList = [];
		this.lastStatus = false;
		this.talkChannel = false;

		this.start();
	}

	/**
	 * Require a module, getting rid of its previous cache.
	 *
	 * @param {String} module - Module resolvable.
	 * @returns {any} Module.
	 */
	requireUncached(module) {
		delete require.cache[require.resolve(module)];
		return require(module);
	}

	/**
	 * Log a GalaxyBot action.
	 *
	 * @param {*} object - Guild or User the log is related to.
	 * @param {String} text - The message to be logged.
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
	 * @param {Discord.MessageMentions} mentions - Discord mentions object.
	 * @returns {String} The escaped string.
	 */
	escapeMentions(text, mentions) {
		if (typeof text !== "string") return "";
		
		var output = text;
		output = output.replace(/@everyone/i, "everyone");
		output = output.replace(/@here/i, "here");

		if (mentions) {
			if (mentions.members) mentions.members.forEach((member, id) => {
				output = output.replace(new RegExp(`${member}`, "g"), member.displayName);
			});

			if (mentions.roles) mentions.roles.forEach((role, id) => {
				output = output.replace(new RegExp(`${role}`, "g"), role.name);
			});

			if (mentions.users) mentions.users.forEach((user, id) => {
				output = output.replace(new RegExp(`${Discord.user}`, "g"), user.username);
			});

			if (mentions.channels) mentions.channels.forEach((channel, id) => {
				output = output.replace(new RegExp(`${channel}`, "g"), "#" + channel.name);
			});
		}

		return output;
	}

	/**
	 * Load the config.yml file.
	 *
	 * @returns {Promise.<Boolean>} true, if the config has been loaded.
	 */
	loadConfig() {
		this.log(false, "Loading config file...");

		const packagejson = this.requireUncached("./package.json");

		// Package info.
		if (packagejson) {
			this.version = packagejson.version;
			this.github = packagejson.homepage;
		}

		// Get the version date.
		fs.stat("./package.json", (err, stats) => {
			if (err) {
				this.log(false, "Failed to obtain \"package.json\" stats: " + err);
				return;
			}

			this.vdate = stats.mtime.toISOString().split("T")[0];
		});

		return new Promise((resolve, reject) => {
			fs.readFile("./config.yml", "utf8", (err, data) => {
				if (err) {
					reject(err);
					return;
				}

				const newConfig = yaml.load(data);

				if (!newConfig) {
					reject("Invalid \"config.yml\" file!");
					return;
				}

				// Discord token not specified.
				if (!newConfig.discord || !newConfig.discord.token) {
					reject("Discord token is not specified!");
					return;
				}

				// Initialize logs.
				if (typeof(newConfig.logfile) === "string") {
					this.logsStream = fs.createWriteStream(newConfig.logfile, { flags: "a" });
					this.log(false, "Logs will be saved to: " + newConfig.logfile);
				}

				// Check if YouTube token is available.
				this.isYouTubeAvailable = newConfig.youtube && newConfig.youtube.token;

				if (this.isYouTubeAvailable) {
					this.log(false, "YouTube token provided.");
				}

				// Connect to Facebook
				if (newConfig.facebook && newConfig.facebook.appid && newConfig.facebook.secret) {
					this.log(false, "Facebook login information provided.");

					FB.api("oauth/access_token", {
						client_id: newConfig.facebook.appid,
						client_secret: newConfig.facebook.secret,
						grant_type: "client_credentials"
					}, response => {
						if (!response || response.error) {
							this.log(false, "A problem has occured while connecting to Facebook API.");
							console.log(!response ? "Facebook: Authentication error." : response.error);
							return;
						}

						FB.setAccessToken(response.access_token);
						this.log(false, "Facebook connection authenticated.");
					});
				}

				// Create a new reddit feed.
				this.reddit = new RedditFeed(newConfig.reddit);

				this.config = newConfig;
				resolve(true);
			});
		});
	}

	/**
	 * Loads commands from the ./commands/ directory.
	 *
	 * @returns {Promise.<Object>} Object representing the number of loaded commands and aliases.
	 */
	loadCommands() {
		this.log(false, "Loading commands...");

		return new Promise((resolve, reject) => {
			fs.readdir("./commands/", (err, files) => {
				if (err) {
					reject(err);
					return;
				}

				let newCommands = new Map();
				let newAliases = new Map();

				files.forEach(file => {
					const command = this.requireUncached("./commands/" + file);

					// Add the command.
					if (command) {
						newCommands.set(command.name, command);
						newAliases.set(command.name, command.name);

						// Add command aliases.
						if (command.aliases && command.aliases.length > 0) {
							for (var i = 0; i < command.aliases.length; i++) {
								newAliases.set(command.aliases[i], command.name);
							}
						}
					}
				});

				// Don't go further if no commands were loaded.
				if (newCommands.size <= 0) {
					reject("No loadable commands in the  \"./commands/\" directory!");
					return;
				}

				this.availableCommands = newCommands;
				this.commandAliases = newAliases;

				resolve({
					commands: this.availableCommands.size,
					aliases: this.commandAliases.size
				});
			});
		});
	}

	/**
	 * Creates a new client.
	 */
	createClient() {
		if (!this.config.discord || typeof this.config.discord.token !== "string") {
			this.log(false, "Discord token is not specified!");
			return;
		}

		this.client = new Discord.Client();
		this.client.on("ready", () => { this.onReady(); });
		this.client.on("error", error => { console.log(error); });
		this.client.on("message", message => { this.onMessage(message); });
		this.client.on("messageUpdate", (messageOld, messageNew) => { this.onEditedMessage(messageOld, messageNew); });
		this.client.on("messageReactionAdd", (reaction, user) => { this.onNewReaction(reaction, user); });
		this.client.on("channelDelete", channel => { this.onChannelDeleted(channel); });
		this.client.on("guildMemberUpdate", (oldMember, newMember) => { this.onMemberUpdate(oldMember, newMember); });
		this.client.on("guildDelete", guild => { this.onGuildDelete(guild); });
		this.client.login(this.config.discord.token);
	}

	/**
	 * Login GalaxyBot to Discord.
	 */
	login() {
		// Destroys previous client (if any).
		if (this.client) {
			this.client.destroy().then(() => {
				this.createClient();
			}).catch(error => {
				console.log(error);
			});
		}

		else {
			this.createClient();
		}
	}

	/**
	 * Start the GalaxyBot.
	 */
	start() {
		this.log(false, "Initializing GalaxyBot...");

		// Load config file.
		this.loadConfig().then(response => {
			this.login();
		}).catch(error => {
			this.log(false, "An error has occured while loading the config file: " + error);
		});

		// Load commands.
		this.loadCommands().then(counts => {
			this.log(false, `${counts.commands} commands with ${counts.aliases} aliases have been loaded.`);
		}).catch(error => {
			this.log(false, "An error has occured while loading the commands: " + error);
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
		setInterval(() => { this.pickNextStatus(); }, 60000);

		// Register already existing guilds.
		this.client.guilds.forEach((guild, guildId) => {
			var guild = this.getGalaxyBotGuild(guild);
		});
		this.log(false, `Active in ${this.activeGuilds.size} guilds.`);

		// Update ManiaPlanet servers statuses.
		this.updateServersStatuses();
		setInterval(() => { this.updateServersStatuses(); }, this.config.mpstatus.interval);

		// Download Maniaplanet titles list.
		ManiaPlanet.updateTitlesList().then(count => {
			this.log(false, `ManiaPlanet titles list updated (${count} items).`);
		}).catch(error => {
			this.log(false, "Failed to update ManiaPlanet titles list: " + error);
		});
	}

	/**
	 * Fired when terminal or console is killed.
	 */
	end() {
		this.log(false, "Stopping GalaxyBot...");
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

		statusText = statusText.replace(/\$users/g, this.client.users.size);
		statusText = statusText.replace(/\$guilds/g, this.client.guilds.size);

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
	 * @param {Discord.User} user - The user too get the object.
	 * @returns {botUser} The bot user object.
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
	 * Escape characters in regular expression.
	 *
	 * @param {String} string - The string to escape.
	 * @returns {String} The escaped string.
	 */
	regexEscape(string) {
		return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
	};

	/**
	 * Find an user by their username, ID or a mention.
	 *
	 * @param {String} string - The string to find the user by.
	 * @param {Discord.MessageMentions} mentions - The mentions of the message.
	 * @returns {Discord.User} The matching user.
	 */
	findUser(string, mentions) {
		if (string.length <= 0) return undefined;

		let matchingUsers = [];

		// From a mention.
		if (mentions && mentions.users && mentions.users.size > 0) {
			mentions.users.forEach((user, userID) => {
				matchingUsers.push(user);
			});
		}

		// Search.
		else {
			const expression = new RegExp(this.regexEscape(string), "i");
			const targetID = string.match(/[0-9]+/);

			// Find user of matching tag.
			this.client.users.forEach((user, userID) => {
				if (userID == targetID || user.tag.match(expression) || user.username.match(expression)) {
					matchingUsers.push(user);
				}
			});
		}

		// Found some users - return the first match.
		if (matchingUsers[0]) return matchingUsers[0];

		// Nobody has been found.
		return undefined;
	}

	/**
	 * Format a date into a readable format.
	 *
	 * @param {Date} date - The date to format.
	 * @returns {String} The formatted date.
	 */
	formatDate(date) {
		if (!date instanceof Date) return "Invalid date";

		/**
		 * Append precending zeroes to an integer.
		 *
		 * @param {Number} num - The integer to format.
		 * @param {Number} length - The target length of the string.
		 * @returns {String} The formatted integer.
		 */
		function formatInt(num, length) {
			let string = Math.floor(num).toString();
			while (string.length < length) string = "0" + string;
			return string;
		}

		const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		let daysSince = Math.floor((Date.now() - date.getTime()) / 86400000);

		return date.getUTCDate() + " " + months[date.getUTCMonth()] + " " + date.getUTCFullYear() + ", " +
			formatInt(date.getUTCHours(), 2) + ":" + formatInt(date.getUTCMinutes(), 2) + "\n" +
			"(" + (daysSince > 0 ? (daysSince > 1 ? `${daysSince} days ago` : "Yesterday") : "Today") + ")";
	}

	/**
	 * Create an embed with a message contents.
	 *
	 * @param {Discord.Message} message - The message to create an embed from.
	 * @returns {Discord.RichEmbed} Created message embed.
	 */
	createMessageEmbed(message) {
		if (!message instanceof Discord.Message) return;

		let imageURL = "";
		let files = [];

		// Fetch for al lattachments.
		message.attachments.forEach((attachment, attachmentID) => {
			if (imageURL == "" && !isNaN(attachment.width)) {
				imageURL = attachment.url;
			} else {
				files.push(`[${attachment.filename}](${attachment.url})`);
			}
		});

		// Fetch for the first image.
		message.embeds.forEach((embed, embedID) => {
			if (imageURL != "" || !embed.image) return;
			imageURL = embed.image.url;
		});

		return new Discord.RichEmbed({
			author: {
				name: message.author.tag,
				icon_url: message.author.avatarURL
			},
			description: message.content,
			timestamp: message.createdTimestamp,
			image: (imageURL ? { url: imageURL } : undefined),
			color: (message.member ? message.member.displayColor : undefined),
			fields: (files.length > 0 ? [{
				name: "Attachments",
				value: files.join("\n")
			}] : []),
			footer: (message.guild ? {
				text: "#" + message.channel.name,
				icon_url: message.guild.iconURL
			} : undefined)
		});
	}

	/**
	 * Check if the user should be rate limited.
	 *
	 * @param {botUser} botUser - The user to check rate limits.
	 * @param {Object} channel - The channel to send the warning in.
	 * @returns {Boolean} true, if the command should be rejected.
	 */
	rateLimitUser(botUser, channel) {
		if (!botUser || !channel) return false;

		// Owner is immune to the rate limit.
		if (botUser.id == this.config.owner) return false;

		let millisecondsLeft = botUser.countRateLimit(this.config.ratelimit.increment, this.config.ratelimit.peak);

		// The user is being rate limited.
		if (millisecondsLeft > 0) {
			if (!botUser.wasRateWarned) {
				channel.send(`Woooaaaahh... Ain't you speeding too much, ${botUser.user}? :oncoming_police_car: Chill a bit and use the commands again in **${millisecondsLeft / 1000} seconds**! :point_right:`);
			}

			botUser.log(`Being rate limited (${millisecondsLeft}).`);
			return true;
		}

		return false;
	}

	getCommandModel(alias) {
		// Alias not found.
		if (!this.commandAliases.has(alias)) {
			return undefined;
		}

		const commandName = this.commandAliases.get(alias);

		// Command not found
		if (!this.availableCommands.has(commandName)) {
			return undefined;
		}

		return this.availableCommands.get(commandName);
	}

	getSimilarCommand(name) {
		let commands = [];

		this.availableCommands.forEach((commandModel, commandName) => {
			if (commandModel.hidden === true) return;

			commands.push(commandName);
			
			if (commandModel.aliases && commandModel.aliases.length > 0) {
				commands = commands.concat(commandModel.aliases);
			}
		});

		const matches = stringSimilarity.findBestMatch(name, commands);

		if (matches && matches.bestMatch) {
			return matches.bestMatch.target;
		}

		return "";
	}

	/**
	 * New, improved commands handling.
	 *
	 * @param {PendingCommand} command - The command that's been sent.
	 */
	onCommand(command) {
		if (!command instanceof PendingCommand) return;

		// Get the command model.
		const commandModel = this.getCommandModel(command.name);

		// The command doesn't exist.
		if (!commandModel) {
			//const suggestedCommand = this.getSimilarCommand(command.name);

			//if (suggestedCommand) {
			//	command.channel.send(`Did you mean to use **${suggestedCommand}**, ${command.user}? :thinking:`);
			//}

			return;
		}

		// Rate limiting.
		if (this.rateLimitUser(command.botUser, command.channel)) return;

		// Log command.
		command.botGuild.log(`Command "${command.name}" sent by ${command.user.tag}.`);

		// Command only available to the bot owner.
		if (commandModel.owner === true && command.user.id != this.config.owner) {
			//command.channel.send(`Sorry ${command.user}, only my owner is permitted to use this command!`);
			//command.botGuild.log("Command is available for bot owner only.");
			return;
		}

		// Command is available only on servers.
		if (commandModel.serverOnly === true && command.botGuild.type != "guild") {
			command.channel.send(`Sorry ${command.user}, this command is available only on servers!`);
			command.botGuild.log("Command is available only in guilds.");
			return;
		}

		// NSFW command in not NSFW channel.
		if (commandModel.nsfw === true && (command.channel.type !== "dm" && !command.channel.nsfw)) {
			command.channel.send(`Hold up ${command.user}, either use this command in a NSFW-flagged channel or send me a private message. :smirk:`);
			command.botGuild.log("Command available only in NSFW channels.");
			return;
		}

		if (commandModel.musicPlayer === true) {
			// Music player is disabled.
			if (this.config.player.enabled !== true) {
				command.channel.send(`Sorry ${command.user}, the music player is currently unavailable. :broken_heart:`);
				command.botGuild.log("Music player is disabled globally.");
				return;
			}

			// Music player enabled only for patrons.
			if (this.config.player.patrons === true && !this.config.patrons.guilds.includes(command.guild.id)) {
				command.channel.send(`Sorry ${command.user}, the music player is only available on servers, whose owners are patrons of **${this.config.patrons.name}** on **${this.config.patrons.site}**.\nAsk the server owner to unlock the music player by becoming a patron of ${this.config.patrons.name}:\n${this.config.patrons.url}`);
				command.botGuild.log("Music player is not enabled on this server.");
				return;
			}

			// Music player commands available only in whitelisted channels.
			const musicTextChannels = command.botGuild.getSetting("music-cmd-ch");

			// Command sent in a not whitelisted channel.
			if (musicTextChannels && !musicTextChannels.includes(command.channel.id)) {
				var channelsTags = [];

				for (const channelId of musicTextChannels) {
					channelsTags.push(`<#${channelId}>`);
				}

				command.channel.send(`You can't use music player commands in this channel, ${command.user}. Try in ${channelsTags.join(", ")}!`);
				command.botGuild.log(`Music commands not allowed in #${command.channel.name}.`);
				return;
			}

			// Save the last used text channel.
			command.botGuild.lastTextChannel = command.channel;
		}

		// Music player access is currently restricted.
		if (commandModel.limitedAccess === true && command.botGuild.isPlayerLimitedAccess() && !command.botGuild.isGalaxyBotManager(command.member)) {
			const rolesList = command.botGuild.createRolesList();
			var rolesText = "";

			if (rolesList && rolesList.length > 0) {
				rolesText = " and members with one of following roles: " + rolesList.join(", ");
			}

			command.channel.send(`Sorry ${command.user}, but you can't control the music player right now. I only accept commands from the server administrators${rolesText}!`);
			command.botGuild.log("Music player has limited access.");
			return;
		}

		// Execute the command.
		try {
			commandModel.execute(command);
		}

		// Super advanced, 100% working crash prevention for commands.
		catch (error) {
			command.channel.send(`An error has occured while executing the **${command.name}** command. Please contact my creator if this problem persists! \`\`\`${error}\`\`\``);
		}
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
	 * Reply with some preprogrammed text responses.
	 *
	 * @param {Guild} guild - The guild message was sent in.
	 * @param {Message} message - The message sent.
	 * @returns {Boolean} true, if a reply was made.
	 */
	premadeResponses(guild, message) {
		if (!guild || !message || !message.guild || message.author.id == this.client.id) return false;

		// Responses disabled.
		if (guild.getSetting("text-responses") !== true) return false;

		// Get message user object.
		var user = this.getGalaxyBotUser(message.author);

		// Pineapple does NOT go on pizza.
		if (message.content.match(/pizza|🍕/i) && message.content.match(/pineapple|🍍/i)) {
			guild.log(`${message.author.tag} MIGHT be an idiot, who puts pineapple on their pizza.`);
			message.reply("I really hope you don't have pineapple on your pizza.");
		}

		// When user doubts in helpfulness.
		else if (user.helpResponseCh !== false && message.channel.id == user.helpResponseCh) {
			user.helpResponseCh = false;

			if (message.content.match(/no/i)) {
				guild.log(`${message.author.tag} doesn't need help.`);
				message.channel.send(`Fuck off then, ${message.author}.`);
				return true;
			}

			else if (message.content.match(/thank|ty|thx/i)) {
				guild.log(`${message.author.tag} needed help and we served well.`);
				message.channel.send(`Glad I could help you, ${message.author}!`);
				return true;
			}
		}

		// I asked them if I should cry.
		else if (user.badBotResponseCh !== false && message.channel.id == user.badBotResponseCh) {
			user.badBotResponseCh = false;

			if (message.content.match(/yes/i)) {
				message.channel.send(`Okay ${message.author}. *Goes to a corner and pretends to cry.*`);
				guild.log(`${message.author.tag} wants me to cry.`);
				return true;
			}

			else if (message.content.match(/no/i)) {
				message.channel.send(`Okay ${message.author}, that's actually kind of you.*`);
				guild.log(`${message.author.tag} doesn't want me to cry.`);
				return true;
			}
		}

		// I'm a good bot!
		else if (message.content.match(/good bot/i)) {
			guild.log(message.author.tag + " likes me!");
			var replyContent = "";

			user.badBotResponseCh = false;

			// They changed their mind.
			if (user.empathyTowardsBot == -1) {
				switch (user.empathyChangeStreak) {
					case 0 : { replyContent = `Changed your mind, ${message.author}?`; break; }
					case 1 : { replyContent = "I see you're having fun."; break; }
					default : return false;
				}

				user.empathyChangeStreak += 1;
			}

			// Reply depending on annoyance level.
			else {
				switch (user.annoyanceLevel) {
					case 0 : { replyContent = `Thank you, ${message.author}! :heart:`; break; }
					case 1 : { replyContent = `Thanks, ${message.author}!`; break; }
					case 2 : { replyContent = "Thank you."; break; }
					case 3 : { replyContent = "I get it, okay."; break; }
					case 4 : { replyContent = "You're so annoying..."; break; }
					case 5 : { replyContent = "I WON'T marry you."; break; }
					case 6 : { replyContent = "FUCK OFF."; break; }
					default : return false;
				}

				user.empathyChangeStreak = 0;
			}

			message.channel.send(replyContent);

			user.empathyTowardsBot = 1;
			user.lowerKarma();

			return true;
		}
		
		// And I'm a bad bot.
		else if (message.content.match(/bad bot/i)) {
			guild.log(message.author.tag + " doesn't like me.");
			var replyContent = "";

			user.badBotResponseCh = false;

			// They changed their mind.
			if (user.empathyTowardsBot == 1) {
				switch (user.empathyChangeStreak) {
					case 0 : { replyContent = `Changed your mind, ${message.author}?`; break; }
					case 1 : { replyContent = "I see you're having fun."; break; }
					default : return false;
				}

				user.empathyChangeStreak += 1;
			}

			// Reply depending on annoyance level.
			else {
				switch (user.annoyanceLevel) {
					case 0 : {
						replyContent = `Am I supposed to cry now, ${message.author}?`;
						user.badBotResponseCh = message.channel.id;
						break;
					}
					case 1 : { replyContent = "Pffffft."; break; }
					case 2 : { replyContent = "I don't care."; break; }
					case 3 : { replyContent = ":shrug:"; break; }
					default : return false;
				}

				user.empathyChangeStreak = 0;
			}

			message.channel.send(replyContent);

			user.empathyTowardsBot = -1;
			user.lowerKarma();

			return true;
		}

		// The AI is an asshole?
		else if (message.content.match(/bot/i) && message.content.match(/asshole/i)) {
			guild.log(`${message.author.tag} thinks the AI is an asshole.`);
			message.channel.send("The AI is an asshole?");
			user.lowerKarma();
			return true;
		}

		// GalaxyBot is annoying. Kinda.
		else if (message.content.match(new RegExp("((("+this.config.owner+"|Dommy('?s)?).+bots?)|(GalaxyBot|"+this.client.id+")).+(is|are)", "i"))) {
			const wordsToFind = ["dumb", "stupid", "annoying", "an idiot"];
			let foundWords = [];

			for (const word of wordsToFind) {
				if (message.content.match(new RegExp(word, "gi"))) {
					foundWords.push(word);
				}
			}

			if (foundWords.length > 0) {
				let joinedWords = "";

				for (var i = 0; i < foundWords.length; i++) {
					if (i > 0) {
						if (i == foundWords.length - 1) joinedWords += " and ";
						else joinedWords += ", ";
					}
					joinedWords += foundWords[i];
				}

				message.channel.send(`${message.author} You're ${joinedWords}.`);
				guild.log(`${message.author.tag} thinks I'm annoying.`);
				user.lowerKarma();
				return true;
			}
		}

		// No u.
		else if (message.content.match(/(you|u)r? (mum|mom)? gay/i)) {
			message.channel.send("no u");
			return true;
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

		// User is ignored by the GalaxyBot.
		if (botGuild && guild.isIgnored(message.member)) return;
		
		// Delete messages with filtered words.
		if (message.guild && guild.filterMessage(message)) return;

		const prefix = guild.getSetting("prefix");
		const isCommand = message.content.startsWith(prefix);
		
		// Send command to commands handler.
		if (isCommand) {
			const commandArguments = message.content.split(" ");
			const commandName = commandArguments.shift().replace(prefix, "").toLowerCase();

			this.onCommand(new PendingCommand(this, botGuild, botUser, commandName, commandArguments, message));
			return;
		}

		// Premade text responses.
		let premadeReply = this.premadeResponses(guild, message);

		// If bot is mentioned, send information about help command.
		if (!premadeReply && message.isMentioned(this.client.user.id)) {
			message.channel.send(`${message.author}, need help with anything? Type **${prefix}help** to see my commands! :raised_hands:`);
			botUser.helpResponseCh = message.channel.id;
			guild.log(`GalaxyBot mentioned by ${message.author.tag}`);
		}

		// Check if message contains something about ManiaPlanet.
		if (message.content.match(/maniaplanet\.com/)) {
			// Link to a title page.
			var foundTitles = message.content.match(/maniaplanet\.com\/titles\/\w+@\w+/g);

			if (foundTitles && guild.getSetting("embed-titles") === true) {
				for (const link of foundTitles) {
					const titleUid = link.split("/").pop();

					guild.log(`Detected ManiaPlanet title: "${titleUid}".`);
					
					// Download the title information.
					ManiaPlanet.title(titleUid, titleInfo => {
						if (!titleInfo || titleInfo.code == 404) return;
						
						message.channel.send(ManiaPlanet.createTitleEmbed(titleInfo));
						guild.log(`Successfully sent ${ManiaPlanet.stripFormatting(titleInfo.name)} info.`);
					});
				}
			}

			// Link to a map page.
			var foundMaps = message.content.match(/maniaplanet\.com\/maps\/[A-Z0-9_-]+/gi);

			if (foundMaps && guild.getSetting("embed-maps") === true) {
				for (const link of foundMaps) {
					const mapUid = link.split("/").pop();

					guild.log(`Detected ManiaPlanet map: "${mapUid}".`);
					
					// Download the map information.
					ManiaPlanet.map(mapUid, mapInfo => {
						if (!mapInfo || mapInfo.code == 404) return;
						
						message.channel.send(ManiaPlanet.createMapEmbed(mapInfo));
						guild.log(`Successfully sent ${ManiaPlanet.stripFormatting(mapInfo.name)} info.`);
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

				guild.log(`Detected Mania Exchange map: "${mxid}" in ${site}.`);
				
				ManiaExchange.maps(site, [mxid], mapInfo => {
					if (!mapInfo || mapInfo.length <= 0) return;

					message.channel.send(ManiaExchange.createMapEmbed(mapInfo[0]));
					guild.log(`Successfully sent ${mapInfo[0].Name} info.`);
				});
			}
		}

		// Check if message contains any ManiaPlanet Forum post.
		if (message.content.match(/forum\.maniaplanet\.com/)) {
			var foundLinks = message.content.match(/https?:\/\/forum\.maniaplanet\.com\/viewtopic\.php\?[\w=&#]+/g);

			if (foundLinks && guild.getSetting("embed-forum") === true) {
				for (const link of foundLinks) {
					guild.log(`Detected ManiaPlanet Forum post: "${link}".`);

					MPForum.getPost(link).then(post => {
						if (post === undefined) return;

						message.channel.send(MPForum.createEmbed(post));
						guild.log(`Successfully sent post "${post.title}".`);
					})

					.catch(error => {
						guild.log("Problem while embedding a post: " + error);
					});
				}
			}
		}

		// Messages quoting.
		if (guild.getSetting("quoting") === true) {
			const foundMessageURLs = message.content.match(/https?:\/\/((canary|ptb)\.)?discordapp\.com\/channels\/([0-9]+|@me)\/[0-9]+\/[0-9]+/g);
			const foundSnowflakes = message.content.match(/[0-9]+/g);

			// Quote a message from a link.
			for (let i = 0; foundMessageURLs && i < foundMessageURLs.length && i < 3; i++) {
				let messageExplodedURL = foundMessageURLs[i].split("/");
				const messageID = messageExplodedURL.pop();
				const channelID = messageExplodedURL.pop();
				const channel = this.client.channels.get(channelID);

				if (channel) {
					channel.fetchMessage(messageID).then(quotedMessage => {
						message.channel.send(this.createMessageEmbed(quotedMessage));
					}).catch(error => {
						//console.log(error);
					});
				}
			}

			// Quote a message in the channel from its ID.
			for (let i = 0; foundSnowflakes && i < foundSnowflakes.length && i < 3; i++) {
				const messageID = foundSnowflakes[i];

				if (messageID.toString().length < 17) continue;
				
				message.channel.fetchMessage(messageID).then(quotedMessage => {
					message.channel.send(this.createMessageEmbed(quotedMessage));
				}).catch(error => {
					//console.log(error);
				});
			}
		}

		// React with Joy.
		if (message.content.match(/😂|😹/i) && guild.getSetting("mocking-joy") === true) {
			guild.log(`${message.author.tag} is using cancerous emoji.`);
			message.react("yoy:398111076379525141");
			botUser.lowerKarma();

			// Enough?
			if (botUser.annoyanceLevel >= 3 && !botUser.warnedForJoyEmoji) {
				message.channel.send(`Stop using this cancerous "joy" emoji ${message.author}, for fucks sake.`);
				botUser.warnedForJoyEmoji = true;
			}

			// Reset counter
			if (botUser.warnedForJoyEmoji && botUser.annoyanceLevel < 3) {
				botUser.warnedForJoyEmoji = false;
			}
		}

		// React with Tomek.
		if (message.content.match(/tomek/i)) {
			guild.log(`${message.author.tag} is a big fan of Tomek.`);
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
		if (messageNew.guild && guild.filterMessage(messageNew)) return;

		// Stalk members, who edit their messages.
		if (guild && guild.getSetting("stalk-edits") && messageOld.content != messageNew.content) {
			messageOld.channel.send(`I see you, ${messageOld.author}:`, this.createMessageEmbed(messageOld));
			guild.log(`${messageNew.author.tag} tried to be sneaky by editing their message.`);
		}
	}

	/**
	 * Fired when someone reacts to a message.
	 *
	 * @param {messageReaction} reaction - The reaction user has contributed to.
	 * @param {Discord.User} user - The user, who added their reaction.
	 */
	onNewReaction(reaction, user) {
		if (!reaction || !user || user.id == this.client.user.id || !reaction.message.guild) return;

		const guild = this.getGalaxyBotGuild(reaction.message.guild);
		const member = reaction.message.guild.members.get(user.id);

		// Navigate through server browsers.
		for (const browser of guild.serverBrowsers) {
			browser.onReaction(reaction, user);
		}

		// Filter the reaction.
		if (guild.getSetting("enable-filter") === true) {
			// Get filtered words list.
			const filteredWords = guild.getSetting("filtered-words");
			const matchingWords = guild.findFilteredWords(reaction.emoji.name, filteredWords);
			const userProneToFiltering = guild.getSetting("filter-admins") === true || !guild.isGalaxyBotManager(member);

			// Delete the reaction.
			if (matchingWords.length > 0 && userProneToFiltering) {
				reaction.remove(user)
					.then(() => {
						guild.log(`Deleted ${user.tag} reaction containing filtered phrases: ${matchingWords.join(", ")}.`);
					})
					.catch(error => {
						guild.log(error);
					});
			}
		}

		// Embed player functions.
		if (guild.embedPlayer !== false && reaction.message.id == guild.embedPlayer.messageID && guild.currentTrack) {
			reaction.remove(user)
				.catch(error => {
					guild.log(error);
				});

			let hasPermissions = guild.isGalaxyBotManager(member);

			// Users can skip their own tracks.
			if (reaction.emoji.name == "⏭") {
				hasPermissions = hasPermissions || reaction.message.member.id == guild.currentTrack.senderId;
			}

			if (hasPermissions) switch (reaction.emoji.name) {
				// Play/pause.
				case "⏯" : {
					if (guild.voiceDispatcher) {
						if (guild.voiceDispatcher.paused) {
							guild.voiceDispatcher.resume();
						} else {
							guild.voiceDispatcher.pause();
						}
					}

					guild.updateEmbedPlayer();
					break;
				}

				// Skip the current track.
				case "⏭" : {
					if (guild.voiceDispatcher) {
						guild.voiceDispatcher.end();
					}

					break;
				}

				// Stop the playback.
				case "⏹" : {
					guild.destroyPlayer();
					break;
				}

				// Queue previous page.
				case "⬆" : {
					if (guild.embedPlayer.prevQueuePage()) {
						guild.updateEmbedPlayer();
					}

					break;
				}

				// Queue next track.
				case "⬇" : {
					if (guild.embedPlayer.nextQueuePage()) {
						guild.updateEmbedPlayer();
					}

					break;
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
			const matchingWords = guild.findFilteredWords(newMember.nickname, filteredWords);
			const userProneToFiltering = guild.getSetting("filter-admins") === true || !guild.isGalaxyBotManager(newMember);

			if (matchingWords.length > 0 && userProneToFiltering) {
				newMember.setNickname("", "Nickname contains filtered words.")
					.then(() => {
						guild.log(`Changed ${newMember.user.tag} name, which contained filtered phrases: ${matchingWords.join(", ")}.`);
					})
					.catch(error => {
						guild.log("Couldn't filter out a nickname: missing permissions.");
						// console.log(error);
					});
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
		this.log(`Kicked from ${guild.name}.`);
		if (guild.voiceConnection) guild.voiceConnection.channel.leave();
		if (guild.voiceDispatcher) guild.voiceDispatcher.end();
		this.activeGuilds.delete(guild.id);
	}
}

module.exports = GalaxyBot;
