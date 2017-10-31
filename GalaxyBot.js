const Discord = require('discord.js');
const yt_search = require('youtube-search');
const querystring = require('querystring');
const yaml = require('js-yaml');
const FB = require('fb');

const https = require('https');
const URL = require('url');
const fs = require('fs');

// Local classes.
const Track = require('./Track');
const Guild = require('./Guild');
const ManiaPlanet = require('./ManiaPlanet');

/**
 * The GalaxyBot itself.
 */
class GalaxyBot {
	/**
	 * Creates a new GalaxyBot.
	 */
	constructor() {
		this.client = new Discord.Client();
		this.client.on('ready', () => { this.onReady(); });
		this.client.on('message', message => { this.onMessage(message); });
		this.client.on('channelDelete', channel => { this.onChannelDeleted(channel); });
		this.client.on('guildDelete', guild => { this.onGuildDelete(guild); })

		process.on('SIGINT', () => { this.end(); });
		process.on('SIGTERM', () => { this.end(); });
		process.on('SIGHUP', () => { this.end(); });
		process.on('SIGBREAK', () => { this.end(); });

		this.maniaplanet = new ManiaPlanet();

		this.activeGuilds = [];
		this.modRoles = [];
	}

	/**
	 * Prints a log in the console.
	 *
	 * @param {Guild} botGuild - The quild log is refering to.
	 * @param {String} text - The log content.
	 */
	log(botGuild, text) {
		var time = new Date().getTime();
		var guildName = 'GLOBAL';
		if (botGuild) guildName = botGuild.name;
		console.log('['+time+'] ['+guildName+'] ' + text);
	}

	/**
	 * Start the GalaxyBot.
	 */
	start() {
		this.log(false, 'Initializing GalaxyBot...');

		// Load help page.
		fs.readFile('./helppage.md', 'utf8', (error, data) => {
			if (error) return console.log(error);
			this.helpPage = data;
		});
		
		// Load YAML config.
		try {
			this.config = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'));
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

		// Get the bot roles
		if (this.config.roles) for (const role of this.config.roles) this.modRoles.push(role.name);

		// Connect to Facebook
		if (this.config.facebook && this.config.facebook.appid && this.config.facebook.secret) {
			FB.api('oauth/access_token', {
				client_id: this.config.facebook.appid,
				client_secret: this.config.facebook.secret,
				grant_type: 'client_credentials'
			}, response => {
				if (!response || response.error) {
					console.log(!response ? 'Facebook: Authentication error.' : response.error);
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
		this.log(false, 'GalaxyBot is ready!');
		this.client.user.setGame('with Dommy');
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
		if (arguments.length == 0) return '';
		if (arguments.length == 1) return arguments[0];
		var output = arguments[0];
		for (var i = 1; i < arguments.length; i++) output = this.replaceAll(output, '%'+i, arguments[i]);
		return output;
	}

	/**
	 * Get the bot guild object of given guild.
	 *
	 * @param {Guild} guild - The quild to get bot guild.
	 * @returns {Guild} Bot guild object (no matter how stupid it sounds).
	 */
	getBotGuild(guild) {
		for (const botGuild of this.activeGuilds) {
			if (guild.id == botGuild.id) return botGuild;
		}

		// Create new bot guild if doesn't exist yet.
		var botGuild = new Guild(guild.id);
		this.activeGuilds.push(botGuild);
		this.log(false, 'New guild registered: ' + guild.name);
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
		if (member.id == this.config.dommy || member.hasPermission('ADMINISTRATOR')) return true; ///< I'm the god of this module.
		
		member.roles.forEach((role, roleId) => {
			if (this.modRoles[role.name]) return true;
		});

		return false;
	}

	/**
	 * Looks for next track in the queue and it finds any, plays it.
	 *
	 * @param {Guild} botGuild - The bot quild we decide to play next track in.
	 */
	playNextTrack(botGuild) {
		this.log(botGuild, 'Next track playback requested.');

		// Leave voice channel if queue is empty.
		if (botGuild.tracksQueue.length <= 0) {
			if (botGuild.voiceConnection) botGuild.voiceConnection.channel.leave();
			return;
		}
		
		// This can happen. Often.
		if (!botGuild.voiceConnection) {
			botGuild.lastTextChannel.send("I'm not in a voice channel. Something must've gone wrong...");
			this.log(botGuild, 'Not in a voice channel.');
			return;
		}

		// Pick first track from the queue.
		botGuild.currentTrack = botGuild.tracksQueue[0];
		botGuild.tracksQueue.shift();

		// Play stream or direct URL.
		try {
			if (botGuild.currentTrack.stream) {
				botGuild.voiceDispatcher = botGuild.voiceConnection.playStream(botGuild.currentTrack.stream);
			}
			else if (botGuild.currentTrack.sourceURL) {
				botGuild.voiceDispatcher = botGuild.voiceConnection.playArbitraryInput(botGuild.currentTrack.sourceURL);
			}

			this.log(botGuild, 'Creating new voice dispatcher.');
		}
		catch (error) {
			botGuild.lastTextChannel.send("Something must've gone wrong with last track, I couldn't play it...");
			console.log(error);
			this.playNextTrack(botGuild);
			return;
		}

		if (botGuild.voiceDispatcher) {
			botGuild.voiceDispatcher.on('end', reason => {
				botGuild.currentTrack = false;
				botGuild.voiceDispatcher = false;
				this.log(botGuild, 'Voice dispatcher end.');

				// Delay is necessary for slower connections to don't skip next track immediately.
				setTimeout(() => { this.playNextTrack(botGuild); }, 250);
			});
			botGuild.voiceDispatcher.on('error', error => {
				console.log(error);
			});
		}

		this.nowPlaying(botGuild, true);
		this.log(botGuild, 'Now playing: ' + botGuild.currentTrack.title);
	}

	/**
	 * Sends a message with current track information.
	 *
	 * @param {Guild} botGuild - The guild we're telling current track info.
	 * @param {Boolean} withMention - If true, user who requested the track is mentioned.
	 */
	nowPlaying(botGuild, withMention) {
		if (!botGuild.lastTextChannel) return;

		// Nothing is being played right now.
		if (!botGuild.currentTrack)
			botGuild.lastTextChannel.send("I'm not playing anything right now. Go ahead and request some beats! :butterfly:");
		
		// We are playing something.
		else {
			var header = 'Now playing:';
			if (withMention) {
				if (botGuild.currentTrack.isLivestream) header = this.compose("I'm tuned up for the livestream, <@%1>! :red_circle:", botGuild.currentTrack.sender.id);
				else header = this.compose("I'm playing your track now, <@%1>! :metal:", botGuild.currentTrack.sender.id);
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

		// (Let's just ignore the fact we're in 'onTrackCreated' method) Track not created.
		if (!track) {
			botGuild.lastTextChannel.send(this.compose("Sorry <@%1>, but I can't play anything from that link. :shrug:", member.id));
			this.log(botGuild, this.compose('Track %1 not added: no information.', url));
			return;
		}

		// Unsupported link type.
		if (track === 'unsupported') {
			botGuild.lastTextChannel.send(this.compose("I can't play that link, <@%1>. Make sure you're requesting something from YouTube, Facebook or Streamable. :rolling_eyes:", member.id));
			this.log(botGuild, this.compose('Track %1 not added: unsupported host.', url));
			return;
		}

		// User without permissions attempts to play livestream.
		if (track.isLivestream && !hasPermissions) {
			botGuild.lastTextChannel.send(this.compose("Sorry <@%1>, you don't have permissions to add livestreams. :point_up:", member.id));
			this.log(botGuild, this.compose('Track %1 not added: no permission to play livestream.'), track.title);
			return;
		}

		// Track is too long and user has no permission to surpass the limit.
		if (!this.hasControlOverBot(member) && track.duration > this.config.maxlength) {
			botGuild.lastTextChannel.send(this.compose(
				'Sorry <@%1>, **%2** is too long! (%3/%4) :rolling_eyes:',
				member.id, track.title, track.timeToText(track.duration), track.timeToText(this.config.maxlength)
			));
			this.log(botGuild, this.compose('Track %1 not added: too long (%2/%3).', url, track.duration, this.config.maxlength));
			return;
		}

		// DES-PA-CITO.
		if (track.title && track.title.toLowerCase().indexOf('despacito') >= 0) {
			botGuild.lastTextChannel.send('Anything related to "Despacito" is FUCKING BLACKLISTED. :middle_finger:');
			this.log(botGuild, this.compose('Track %1 not added: blacklisted.', url));
			return;
		}

		this.log(botGuild, 'Track successfully added: ' + track.title);

		// Queue new track.
		var isNext = (param === 'now' || param === 'next') && botGuild.tracksQueue.length > 0;
		var isNow = param === 'now' && hasPermissions;

		if (isNext && hasPermissions) {
			if (isNow) botGuild.lastTextChannel.send(this.compose("Okay <@%1>, let's play it right now! :smirk:", member.id));
			botGuild.tracksQueue.unshift(track);
		} else {
			if (isNext) botGuild.lastTextChannel.send(this.compose("Sorry <@%1>, you can't queue track next, nor play it immediately. :rolling_eyes:", member.id));
			botGuild.tracksQueue.push(track);
		}

		// Create voice connection for current guild, if doesn't exist.
		if (!botGuild.voiceConnection) {
			member.voiceChannel.join().then(connection => {
				botGuild.voiceConnection = connection;
				botGuild.voiceConnection.on('disconnect', () => {
					botGuild.voiceConnection = false;
					this.log(botGuild, 'Disconnected from voice.');
				});
				this.playNextTrack(botGuild);
				this.log(botGuild, 'Created new voice connection.');
			});
		}

		// Somehow we are in voice channel, but nothing is being played.
		else if (!botGuild.currentTrack) this.playNextTrack(botGuild);

		// Play the track right now.
		else if (isNow && botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
		
		// Show queue message.
		else {
			var position = botGuild.tracksQueue.indexOf(track) + 1;
			botGuild.lastTextChannel.send(this.compose('<@%1>, your track is **#%2** in the queue:', member.id, position), track.embed);
		}
	}

	/**
	 * Basic commands handling.
	 *
	 * @param {Message} message - The message command was sent in.
	 * @param {String} name - Name of the command used.
	 * @param {Array} args - Arguments provided with the command.
	 */
	onCommand(message, name, args) {
		if (!message) return;

		// We must be in a server.
		if (!message.member) {
			message.channel.send('Sorry, my commands work only on servers!');
			return;
		}

		// Register new server if not registered yet.
		var botGuild = this.getBotGuild(message.guild);
		botGuild.name = message.guild.name;
		botGuild.lastTextChannel = message.channel;

		// Log command.
		this.log(botGuild, this.compose('Command sent by %1: %2', message.member.displayName, name));
		
		switch (name) {
			// Show available commands list.
			case 'help' : {
				message.channel.send(this.compose(this.helpPage, message.member.id, this.config.prefix));
				break;
			}

			// Mention Dommy.
			case 'dommy' : {
				message.channel.send(this.compose('<@%1> https://giphy.com/gifs/movie-mrw-see-2H67VmB5UEBmU', this.config.dommy));
				this.log(botGuild, 'Dommy mentioned.');
				break;
			}

			// Source code on GitHub.
			case 'git' : {
				message.channel.send(
					"Maybe I can't explain you how to understand women, but you can look at my source code instead! :hugging:\n" +
					'https://github.com/domino54/galaxybot'
				);
				this.log(botGuild, 'Pasted GitHub repo link.');
				break;
			}

			// Redirects to page, where user can add this bot to their server.
			case 'invite' : {
				message.channel.send(this.compose(
					'Want me to party hard with you on your server? Use the link below! :sunglasses:\n' +
					'https://discordapp.com/oauth2/authorize?client_id=%1&scope=bot', this.client.user.id
				));
				this.log(botGuild, 'Pasted bot invitation link.');
				break;
			}

			// Send servers list of a specific title.
			case 'servers' : {
				// Title id not specified.
				if (args.length <= 0) {
					message.channel.send(this.compose(
						'<@%1>, you need to specify `titleUid` in this command. Type `titleUid` after command or use one of these short codes: %2.',
						message.member.id, this.maniaplanet.getTitleCodes().join(', ')
					));
					this.log(botGuild, 'No UID specified.');
					return;
				}

				// Get title id.
				var titleUid = args[0];
				titleUid = this.maniaplanet.getTitleUid(titleUid);
				
				this.maniaplanet.servers({'titleUids[]': titleUid, length: 11}, result => {
					this.serversList(botGuild, result, titleUid);
				});
				this.log(botGuild, 'Checking servers of ' + titleUid);
				break;
			}

			// Show info about a title.
			case 'title' : {
				// Title id not specified.
				if (args.length <= 0) {
					message.channel.send(this.compose(
						'<@%1>, you need to specify `titleUid` in this command. Type `titleUid` after command or use one of these short codes: %2.',
						message.member.id, this.maniaplanet.getTitleCodes().join(', ')
					));
					this.log(botGuild, 'No UID specified.');
					return;
				}

				// Get title id.
				var titleUid = args[0];
				titleUid = this.maniaplanet.getTitleUid(titleUid);
				this.showTitleInfo(botGuild, titleUid);
				break;
			}

			// Show info about a map.
			case 'map' : {
				// Map UID not specified.
				if (args.length <= 0) {
					message.channel.send(this.compose('<@%1>, you need to specify the map `UID` in this command.', message.member.id));
					this.log(botGuild, 'No UID specified.');
					return;
				}

				this.showMapInfo(botGuild, args[0]);
				break;
			}

			// Show current program live in a channel.
			case 'channel' : {
				// Which channel?
				if (args.length <= 0) {
					message.channel.send(this.compose('<@%1>, I need to know if you mean `sm` or `tm` channel. :thinking:', message.member.id));
					this.log(botGuild, 'No channel specified.');
					return;
				}

				// Get channel.
				var channelId = '';
				switch (args[0]) {
					case 'sm' : {
						channelId = 'shootmania';
						break;
					}
					case 'tm' : {
						channelId = 'trackmania';
						break;
					}
					// Unknown.
					default : {
						message.channel.send(this.compose('<@%1>, currently there are only two channels: `sm` and `tm`. :shrug:', message.member.id));
						this.log(botGuild, 'Unknown channel.');
						return;
					}
				}

				this.showCurrentEpisode(botGuild, channelId);
				break;
			}

			// Show the user currently played track.
			case 'now' : {
				this.nowPaying(botGuild, false);
				break;
			}

			// Show the user next track in the queue.
			case 'next' : {
				// Nothing next in the queue.
				if (botGuild.tracksQueue.length <= 0) {
					message.channel.send('The queue is empty. Go ahead and request some beats! :butterfly:');
					break;
				}

				// Get the order of the track from queue to get.
				var trackOrder = 0;
				if (args[0]) {
					// Get next track requested by the user.
					if (args[0] == 'me') {
						for (const track of botGuild.tracksQueue) {
							if (track.sender != message.member) continue;
							message.channel.send(this.compose('Your next track is **#%1** in the queue, <@%2>:', i+1, message.member.id), track.createEmbed());
							return;
						}
						message.reply('looks like there are no upcoming tracks requested by you.');
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
					message.channel.send(this.compose('Queue is only **%1** track%2 long. :shrug:', botGuild.tracksQueue.length, (botGuild.tracksQueue.length > 1 ? 's' : '')));
					break;
				}

				var header = 'Up next:';
				if (trackOrder > 0) header = this.compose('**#%1** in the queue:', trackOrder + 1);
				message.channel.send(header, botGuild.tracksQueue[trackOrder].createEmbed());
				break;
			}

			// List max. 10 upcoming tracks.
			case 'queue' : {
				// Nothing next in the queue.
				if (botGuild.tracksQueue.length <= 0) {
					message.channel.send('The queue is empty. Go ahead and request some beats! :butterfly:');
					break;
				}

				// List next tracks
				var tracksInfos = [];
				for (var i = 0; i < botGuild.tracksQueue.length && i < 10; i++) {
					var track = botGuild.tracksQueue[i];
					tracksInfos.push(this.compose('`%1.` **%2** (requested by %3)', ((i<9) ? '0' : '') + (i+1), track.title, track.sender.displayName));
				}
				message.channel.send('Up next:\n' + tracksInfos.join('\n'));
				break;
			}

			// Skip currently played track.
			case 'skip' : {
				// Not playing anything in the server.
				if (!botGuild.currentTrack) {
					message.channel.send('Nothing is being played right now. :shrug:');
					return;
				}

				// No permission to skip current track.
				if (!this.hasControlOverBot(message.member) && message.member != botGuild.currentTrack.sender) {
					message.channel.send('You are not permitted to skip tracks requested by other users. :no_good:');
					return;
				}

				message.channel.send('Allright, skipping current track! :thumbsup:');
				this.log(botGuild, 'Current track skipped through command.');

				if (botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
				break;
			}

			// Stop everything.
			case 'stop' : {
				if (!this.hasControlOverBot(message.member)) {
					message.channel.send(this.compose('Only server administrators and people with at least one of following roles can stop me: %1. :point_up:', this.modRoles.join(', ')));
					return;
				}

				if (!botGuild.currentTrack) return;

				message.channel.send('Abort! Playback has been stopped and queue emptied. :no_good:');
				this.log(botGuild, 'Stopped playback on admin command.');

				botGuild.tracksQueue = [];
				if (botGuild.voiceConnection) botGuild.voiceConnection.channel.leave();
				if (botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();

				break;
			}

			// Remove latest track added by the user.
			case 'undo' : {
				// Tracks queue is empty.
				if (botGuild.tracksQueue.length <= 0) {
					message.channel.send('Tracks queue is empty. :shrug:');
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
					message.channel.send('Looks like there are no upcoming tracks requested by you. :thinking:');
					return;
				}

				// Remove latest track.
				message.channel.send(this.compose('<@%1>, I removed your latest track, **%2**.', message.member.id, trackToRemove.title));
				botGuild.tracksQueue.splice(botGuild.tracksQueue.indexOf(trackToRemove), 1);
				break;
			}

			// Request bot to play a song.
			case 'play' : {
				// URL not specified
				if (args.length <= 0) {
					message.channel.send('First of all, you need to tell me what should I play. :shrug:');
					break;
				}

				// Music player not running and user is not in a voice channel.
				if (!botGuild.voiceConnection && !message.member.voiceChannel) {
					message.channel.send('You need join a voice channel before I can start playing anything. :loud_sound:');
					this.log(botGuild, 'User not in any voice channel.');
					break;
				}

				// User not in our voice channel.
				if (botGuild.voiceConnection && message.member.voiceChannel != botGuild.voiceConnection.channel && !this.hasControlOverBot(message.member)) {
					message.channel.send('You need to join my voice channel if you want to request something. :point_up:');
					this.log(botGuild, 'User not in voice channel with bot.');
					break;
				}

				// Create a new track object for the speicifed URL.
				var url = args[0];
				var query = args.join(' ');

				this.log(botGuild, this.compose('Track requested by %1: %2', message.member.displayName, query));

				// Try to load track from given URL.
				if (URL.parse(url).hostname) {
					var track = new Track(url, message.member, (track) => {
						this.onTrackCreated(botGuild, track, message.member, url, args[1]);
					});
				}

				// Can't search in YouTube: API token not provided.
				else if (!this.config.youtube || !this.config.youtube.token) {
					message.channel.send("I can't search for tracks in YouTube, API token is missing in my configuration file! :rolling_eyes:");
					this.log(botGuild, 'Wrong YouTube configuration: token not specified.');
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

			// List all guilds the bot is active in.
			case 'guilds' : {
				var serversNames = [];
				this.client.guilds.forEach((guild, guildId) => {
					serversNames.push(guild == message.guild ? '**'+guild.name+'**' : guild.name);
				});
				message.channel.send(this.compose("I'm active in **%1** server%2: %3.", this.client.guilds.size, (this.client.guilds.size == 1 ? '' : 's'), serversNames.join(', ')));
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
		var isCommand = message.content.startsWith(this.config.prefix);
		
		// Send command to commands handler.
		if (isCommand) {
			var cmdArgs = message.content.split(' ');
			var cmdName = cmdArgs[0].replace(this.config.prefix, '');
			cmdArgs.shift();
			this.onCommand(message, cmdName, cmdArgs);
		}

		// If bot is mentioned, send information about help command.
		if (message.author != this.client.user && message.content.indexOf(this.client.user.id) >= 0) {
			message.channel.send(this.compose('<@%1>, need help with anything? Type **%2help** to see my commands! :raised_hands:', message.author.id, this.config.prefix));
		}

		// Check if message contains something about ManiaPlanet.
		else if (message.content.toLowerCase().indexOf('maniaplanet') >= 0) {
			if (!message.member) return;

			var explode = message.content.split('/');
			var botGuild = this.getBotGuild(message.guild);
			botGuild.name = message.guild.name;
			botGuild.lastTextChannel = message.channel;

			// Link to a title page.
			if (message.content.match(/maniaplanet\.com\/titles\/\w+@\w+/)) {
				var titleUid = '';

				for (var i = explode.length - 1; i >= 0; i--) {
					var part = explode[i];
					if (part.indexOf('@') < 0) continue;
					titleUid = part;
					break;
				}

				if (titleUid) this.showTitleInfo(botGuild, titleUid);
			}

			// Link to a map page.
			else if (message.content.match(/maniaplanet\.com\/maps\/[A-Za-z0-9]+/)) {
				var mapUid = '';
				var prevWasMaps = false;

				for (var i = 0; i < explode.length; i++) {
					var part = explode[i];
					if (prevWasMaps) { mapUid = part; break; }
					prevWasMaps = part == 'maps';
				}

				if (mapUid) this.showMapInfo(botGuild, mapUid);
			}
		}

		// Reddit, pretty much.
		else if (message.content.toLowerCase() == 'good bot') {
			message.channel.send(this.compose('Thank you, <@%1>! :heart:', message.author.id));
		}
		
		else if (message.content.toLowerCase() == 'bad bot') {
			message.reply('https://i.giphy.com/media/L7LylDVYU10lO/giphy.webp');
		}

		// Tomek.
		else if (message.content.toLowerCase().indexOf('tomek') >= 0) {
			message.react('tomkek:275271219279036416');
		}

		// Markiel.
		else if (message.content.toLowerCase().indexOf('markiel') >= 0) {
			message.react('markiel:258199535673671680');
			message.channel.send({files: ['./markiel.png']});
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

			// React like if we used 'stop'. Okay, a little bit more upset.
			guild.lastTextChannel.send('HELLO? I WAS PLAYING MUSIC HERE! Thank you for destroying the party... :angry:');
			this.log(guild, 'Someone deleted channel where bot was playing music.');

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

		// We've been kicked from the server.
		this.log('Kicked from guild: ' + botGuild.name);
		if (botGuild.voiceConnection) botGuild.voiceConnection.channel.leave();
		if (botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
		this.activeGuilds.splice(botGuild, 1);
	}

	/**
	 * Create servers list of specific title.
	 *
	 * @param {Guild} botGuild - The guild command was executed in.
	 * @param {Object} servers - ManiaPlanet servers list.
	 * @param {String} titleUid - Id of the title.
	 */
	serversList(botGuild, servers, titleUid) {
		this.log(botGuild, 'Obtained servers list.');
		this.maniaplanet.title(titleUid, title => {
			this.log(botGuild, 'Obtained title information.');

			// Title not found.
			if (!title || title.code == 404) {
				botGuild.lastTextChannel.send(this.compose("Sorry, I can't recognize the **%1** title... :shrug:", titleUid));
				this.log(botGuild, 'Title not found: ' + titleUid);
				return;
			}

			var titleName = title.name;

			// No servers were found.
			if (servers.length <= 0) {
				botGuild.lastTextChannel.send(this.compose('Looks like there are no online servers in **%1** right now. :rolling_eyes:', titleName));
				this.log(botGuild, 'No servers found in title: ' + titleUid);
				return;
			}

			// List the found servers.
			var serversInfo = [];
			for (var i = 0; i < servers.length && i < 10; i++) {
				var server = servers[i];
				serversInfo.push(this.compose(
					'%1. %2/%3 %4', i+1, server['player_count'], server['player_max'],
					this.maniaplanet.stripFormatting(server['name'])
				));
			}

			// Servers list header.
			var messageHeader;
			switch (servers.length) {
				case 1 : { messageHeader = this.compose('There is **one %1** server online:', titleName); break; }
				case 11 : { messageHeader = this.compose('There are over **10 %1** servers online:', titleName); break; }
				default : { messageHeader = this.compose('There are **%1 %2** servers online:', servers.length, titleName); break; }
			}

			var embed = '```'+serversInfo.join('\n')+'```';
			botGuild.lastTextChannel.send(messageHeader + embed);
			this.log(botGuild, this.compose('Found %1 servers in %2', servers.length, titleUid));
		});
	}

	/**
	 * Show information box about specific title.
	 *
	 * @param {Guild} botGuild - The guild to send title information to.
	 * @param {String} titleUid - UID of the title to display.
	 */
	showTitleInfo(botGuild, titleUid) {
		if (!botGuild || !titleUid) return;
		this.log(botGuild, 'Downloading title info: ' + titleUid);

		this.maniaplanet.title(titleUid, title => {
			// Title not found.
			if (!title || title.code == 404) {
				botGuild.lastTextChannel.send(this.compose("Sorry, I can't recognize the **%1** title... :shrug:", titleUid));
				this.log(botGuild, 'Title not found: ' + titleUid);
				return;
			}

			// Title cost in Planets.
			var fields = [];
			if (title.cost && title.cost > 0) fields.push({ name: 'Cost', value: title.cost });

			var embed = new Discord.RichEmbed({
				title: this.maniaplanet.stripFormatting(title.name),
				url: 'https://www.maniaplanet.com/titles/' + title.uid,
				image: { url: title.card_url },
				description: this.maniaplanet.stripFormatting(title.description),
				fields: fields
			});

			botGuild.lastTextChannel.send(embed);
			this.log(botGuild, 'Successfully sent title info: ' + titleUid);
		});
	}

	/**
	 * Show information box about specific map.
	 *
	 * @param {Guild} botGuild - The guild to send map information to.
	 * @param {String} mapUid - UID of the map to display.
	 */
	showMapInfo(botGuild, mapUid) {
		if (!botGuild || !mapUid) return;
		this.log(botGuild, 'Downloading map info: ' + mapUid);

		this.maniaplanet.map(mapUid, map => {
			// Map not found.
			if (!map || map.code == 404) {
				botGuild.lastTextChannel.send(this.compose("Sorry, I couldn't find information about this map: **%1**. :cry:", mapUid));
				this.log(botGuild, 'Map not found: ' + mapUid);
				return;
			}

			var embed = new Discord.RichEmbed({
				title: this.maniaplanet.stripFormatting(map.name),
				url: 'https://www.maniaplanet.com/maps/' + map.uid,
				image: { url: map.thumbnail_url },
				author: {
					name: map.author_login,
					url: 'https://www.maniaplanet.com/players/' + map.author_login
				},
				description:
					'[**Play**](maniaplanet://www.maniaplanet.com/maps/'+map.uid+'/code/play) | ' +
					'[**Download**]('+map.download_url+')'
			});

			botGuild.lastTextChannel.send(embed);
			this.log(botGuild, 'Successfully sent map info: ' + mapUid);
		});
	}

	/**
	 * Show current episode played in channel.
	 *
	 * @param {Guild} botGuild - Guild to send current episode info.
	 * @param {String} channelId - ID of the channel to get current episode.
	 */
	showCurrentEpisode(botGuild, channelId) {
		if (!botGuild || !channelId) return;
		this.log(botGuild, 'Downloading current channel episode: ' + channelId);

		var endtime = parseInt(Date.now() / 1000);
		var starttime = endtime - 9000;

		this.maniaplanet.episodes(channelId, starttime, endtime, episodes => {
			// No episodes found.
			if (!episodes || episodes.code || episodes.length <= 0) {
				botGuild.lastTextChannel.send("There's nothing being played in this channel righ now, or we ran into some issue. :thinking:");
				this.log(botGuild, 'Channel empty or request error: ' + channelId);
				return;
			}

			var episode = episodes.pop();
			var embed = new Discord.RichEmbed({
				title: this.maniaplanet.stripFormatting(episode.program.name),
				url: 'https://www.maniaplanet.com/programs/' + episode.program.id,
				description: this.maniaplanet.stripFormatting(episode.program.description),
				author: {
					name: this.maniaplanet.stripFormatting(episode.program.author.nickname),
					url: 'https://www.maniaplanet.com/players/' + episode.program.author.login
				},
				image: { url: episode.program.image_url }
			});

			botGuild.lastTextChannel.send(embed);
			this.log(botGuild, 'Successfully sent current episode: ' + channelId);
		});
	}
}

module.exports = GalaxyBot;
