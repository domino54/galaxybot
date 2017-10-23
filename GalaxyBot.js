const Discord = require('discord.js');
const https = require('https');
const querystring = require('querystring');
const yaml = require('js-yaml');
const fs = require('fs');

const Track = require('./Track');
const Guild = require('./Guild');

// ------------------- vvv CLEAN THIS UP FFS vvv ------------------- //

const maniaplanetWS = 'https://v4.live.maniaplanet.com/webservices/';

const titleIds = {
	'galaxy': 'GalaxyTitles@domino54',
	'pursuit': 'Pursuit@domino54',
	'stadium': 'PursuitStadium@domino54'
};

const titleNames = {
	'GalaxyTitles@domino54': 'Galaxy',
	'Pursuit@domino54': 'Pursuit Multi-environment',
	'PursuitStadium@domino54': 'Pursuit Stadium'
}

const formatSkip1 = ['g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 's', 't', 'w', 'z'];
const formatSkip3 = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];

function replaceAll(string, toReplace, replacement) {
	var output = string;
	while (output.indexOf(toReplace) >= 0) output = output.replace(toReplace, replacement);
	return output;
}

function compose() {
	if (arguments.length == 0) return '';
	if (arguments.length == 1) return arguments[0];
	var output = arguments[0];
	for (var i = 1; i < arguments.length; i++) output = replaceAll(output, '%'+i, arguments[i]);
	return output;
}

class GalaxyBot {
	constructor() {
		this.client = new Discord.Client();
		this.client.on('ready', () => { this.onLaunch(); });
		this.client.on('message', message => { this.onMessage(message); });
		this.activeGuilds = [];
	}

	init() {
		console.log('Initializing GalaxyBot...');

		// Load YAML config.
		try {
			this.config = yaml.safeLoad(fs.readFileSync('./config.yml', 'utf8'));
		}
		catch (e) { console.log(e); }

		// Possible config file exceptions.
		if (!this.config) console.log("Configuration error: config.yml not found or empty!");
		else if (!this.config.token) console.log("Configuration error: 'token' is not specified in config.yml!");
		
		// Log in to Discord.
		this.client.login(this.config.token);
	}

	onLaunch() {
		console.log('GalaxyBot is ready!');
		this.setGame('with Dommy');
	}

	removeMPformat(string) {
		var output = '';
		for (var i = 0; i < string.length; i++) {
			var char = string[i];
			if (char != '$') { output += char; continue; }
			if (i + 1 > string.length) break;
			var nextChar = string[i+1].toLowerCase();
			if (formatSkip1.indexOf(nextChar) > -1) i++;
			if (formatSkip3.indexOf(nextChar) > -1) i += 3;
		}
		return output;
	}

	serversList(channel, titleId) {
		var url = maniaplanetWS + 'servers/online?' + querystring.stringify({orderBy: 'playerCount', 'titleUids[]': titleId, length: 11});
		var request = https.get(url, response => {
			var body = '';
			response.on('data', data => { body += data; });
			response.on('end', () => {
				var result = JSON.parse(body);
				var titleName = titleNames[titleId];

				// No servers were found.
				if (result.length <= 0) {
					channel.send(compose('Looks like there are no online servers in **%1** right now. :rolling_eyes:', titleName));
					return;
				}

				// List the found servers.
				var serversInfo = [];
				for (var i = 0; i < result.length && i < 10; i++) {
					var server = result[i];
					serversInfo.push(compose('%1. %2/%3 %4', i+1, server['player_count'], server['player_max'], this.removeMPformat(server['name'])));
				}

				// Servers list header.
				var messageHeader;
				switch (result.length) {
					case 1 : { messageHeader = compose('There is **one %1** server online:', titleName); break; }
					case 11 : { messageHeader = compose('There are over **10 %1** servers online:', titleName); break; }
					default : { messageHeader = compose('There are **%1 %2** servers online:', result.length, titleName); break; }
				}

				var embed = '```'+serversInfo.join('\n')+'```';
				channel.send(messageHeader + embed);
			});
		});
	}

	// TODO: Remove these.
	setGame(name) {
		this.client.user.setPresence({game: {name: name}});
	}

	resetGame() {
		this.setGame('');
	}

	// ------------------- ^^^ CLEAN THIS UP FFS ^^^ ------------------- //

	/**
	 * Get the bot guild object of given guild.
	 *
	 * @param {Guild} guild - The quild to get bot guild.
	 * @returns {Guild} Bot guild object (no matter how stupid it sounds).
	 */
	getBotGuild(guild) {
		for (var i = 0; i < this.activeGuilds.length; i++) {
			var botGuild = this.activeGuilds[i];
			if (guild.id == botGuild.id) return botGuild;
		}

		// Create new bot guild if doesn't exist yet.
		var botGuild = new Guild(message.guild.id);
		this.activeGuilds.push(botGuild);
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
		// TODO: Add special permissions for bot control.
		return false;
	}

	/**
	 * Looks for next track in the queue and it finds any, plays it.
	 *
	 * @param {Guild} botGuild - The bot quild we decide to play next track in.
	 */
	playNextTrack(botGuild) {
		// This can happen. Often.
		if (!botGuild.voiceConnection) {
			botGuild.lastTextChannel.send("I'm not in a voice channel. Something must've gone wrong...");
			return;
		}

		// Leave voice channel if queue is empty.
		if (botGuild.tracksQueue.length <= 0) {
			if (botGuild.voiceConnection) botGuild.voiceConnection.channel.leave();
			return;
		}
		
		// Pick first track from the queue.
		botGuild.currentTrack = botGuild.tracksQueue[0];
		botGuild.tracksQueue.shift();

		// Play stream.
		try {
			botGuild.voiceDispatcher = botGuild.voiceConnection.playStram(botGuild.currentTrack.stream); ///< This will crash if we specify livestream.
		}
		catch (error) {
			botGuild.lastTextChannel.send("Something must've gone wrong with last track, I couldn't play it..."); ///< THIS IS NEVER PRINTED FFS.
		}

		if (botGuild.voiceDispatcher) {
			botGuild.voiceDispatcher.on('end', () => {
				botGuild.currentTrack = false;
				//botGuild.resetGame();
				this.playNextTrack(botGuild);
			});
		}

		//botGuild.setGame(botGuild.currentTrack.title);
		this.nowPlaying(botGuild, true);
	}

	/**
	 * Fired when a new track is added to the queue.
	 *
	 * @param {Guild} botGuild - The guild in which track was added to the queue.
	 * @param {Track} track - Newly added track.
	 */
	onTrackAdded(botGuild, track) {
		// Very first track queued.
		if (!botGuild.currentTrack) this.playNextTrack(botGuild);
		
		// Show queue message.
		else botGuild.lastTextChannel.send(compose('<@%1>, your track is **#%2** in the queue:', track.sender.id, botGuild.tracksQueue.length), track.embed);
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
			if (withMention) header = "I'm playing your track now, <@" + botGuild.currentTrack.sender.id + ">! :metal:";
			botGuild.lastTextChannel.send(header, botGuild.currentTrack.embed);
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
		
		switch (name) {
			// Show available commands list.
			case 'help' : {
				message.channel.send(compose(
					"Hello <@%1>! Here are my commands: :butterfly:\n" +
					"\nGeneral\n" +
					"**%2dommy** - summon Dommy out of nowhere!\n" +
					"**%2git** - Wanna see how I was made? ( ͡° ͜ʖ ͡°) I'll link you my source code on GitHub!\n" +
					"**%2invite** - If you want me to join your server, use this command!\n" +
					"\nManiaPlanet\n" +
					"**%2servers <galaxy|pursuit|stadium>** - Listing max. 10 servers of a specific title.\n" +
					"\nMusic player\n" +
					"**%2play <url>** - I'm gonna join your voice channel and play the song for you!\n" +
					"**%2now** - I will tell you what song (and if) I'm currently playing.\n" +
					"**%2next** - If there's something next in the queue, I'll tell you what it is!\n" +
					"**%2queue** - I will inform you what are the 10 upcoming songs!\n" +
					"**%2skip** - Lets administrators skip that long shittyflute remix...\n" +
					"**%2stop** - Abort the mission! This command completely stops music playback.",
					message.member.id, this.config.prefix
				));
				break;
			}

			// Mention Dommy.
			case 'dommy' : {
				message.channel.send(compose('<@%1> https://giphy.com/gifs/movie-mrw-see-2H67VmB5UEBmU', this.config.dommy));
				break;
			}

			// Source code on GitHub.
			case 'git' : {
				message.channel.send(
					"Maybe I can't explain you how to understand women, but you can look at my source code instead! :hugging:\n" +
					'https://github.com/domino54/galaxybot'
				);
				break;
			}

			// Redirects to page, where user can add this bot to their server.
			case 'invite' : {
				message.channel.send(compose(
					'Want me to party hard with you on your server? Use the link below! :sunglasses:\n' +
					'https://discordapp.com/oauth2/authorize?client_id=%1&scope=bot', this.client.user.id
				));
				break;
			}

			// Send servers list of a specific title.
			case 'servers' : {
				var title = 'galaxy';
				if (args.length > 0) title = args[0].toLowerCase();

				if (!(title in titleIds)) {
					message.channel.send(compose("Sorry <@%1>, I can't recognize the '%2' title... :shrug:", message.member.id, title));
					break;
				}

				this.serversList(message.channel, titleIds[title]);
				break;
			}

			// Show the user currently played track.
			case 'now' : {
				botGuild.lastTextChannel = message.channel;
				this.nowPlaying(botGuild, false);
				break;
			}

			// Show the user next track in the queue.
			case 'next' : {
				botGuild.lastTextChannel = message.channel;

				// Nothing next in the queue.
				if (botGuild.tracksQueue.length <= 0) {
					message.channel.send('The queue is empty. Go ahead and request some beats! :butterfly:');
					break;
				}

				message.channel.send('Up next:', botGuild.tracksQueue[0].createEmbed());
				break;
			}

			// List max. 5 upcoming tracks.
			case 'queue' : {
				botGuild.lastTextChannel = message.channel;

				// Nothing next in the queue.
				if (botGuild.tracksQueue.length <= 0) {
					message.channel.send('The queue is empty. Go ahead and request some beats! :butterfly:');
					break;
				}

				// List next tracks
				var tracksInfos = [];
				for (var i = 0; i < botGuild.tracksQueue.length && i < 10; i++) {
					var track = botGuild.tracksQueue[i];
					tracksInfos.push(compose('`%1.` **%2** (requested by %3)', ((i<9) ? '0' : '') + (i+1), track.title, track.sender.displayName));
				}
				message.channel.send('Up next:\n' + tracksInfos.join('\n'));
				break;
			}

			// Skip currently played track.
			case 'skip' : {
				botGuild.lastTextChannel = message.channel;

				if (!this.hasControlOverBot(message.member)) {
					message.channel.send('You are not permitted to skip currently played track. :no_good:');
					return;
				}

				if (botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
				console.log('Current track skipped through command. Guild: ' + botGuild.id);
				break;
			}

			// Stop everything.
			case 'stop' : {
				botGuild.lastTextChannel = message.channel;

				if (!this.hasControlOverBot(message.member)) {
					message.channel.send('Only choosen people can stop me. :blush:');
					return;
				}

				botGuild.tracksQueue = [];
				if (botGuild.voiceDispatcher) botGuild.voiceDispatcher.end();
				if (botGuild.voiceConnection) botGuild.voiceConnection.message.channel.leave();
				console.log('Stopped playback on admin command. Guild: ' + botGuild.id);
				break;
			}

			// Request bot to play a song.
			case 'play' : {
				botGuild.lastTextChannel = message.channel;

				// URL not specified
				if (args.length <= 0) {
					message.channel.send('First of all, you need to tell me what should I play. :shrug:');
					break;
				}

				// Music player not running and user is not in a voice channel.
				if (!botGuild.voiceConnection && !message.member.voiceChannel) {
					message.channel.send('You need to be in a voice channel.');
					console.log('User not in a voice channel.');
					break;
				}

				var targetVoiceChannel = message.member.voiceChannel;

				// Create a new track object for each URL speicifed.
				for (var i = 0; i < args.length; i++) {
					var url = args[i];
					var track = new Track(url, message.member, (track) => {
						if (!track) return;

						// Track is too long and user has no permission to surpass the limit.
						if (!this.hasControlOverBot(message.member) && track.duration > this.config.maxlength) {
							botGuild.lastTextChannel.send(compose(
								'Sorry <@%1>, **%2** is too long! (%3/%4) :rolling_eyes:',
								message.member.id, track.title, track.timeToText(track.duration), track.timeToText(this.config.maxlength)
							));
							return;
						}

						// DES-PA-CITO.
						if (track.title.toLowerCase().indexOf('despacito') >= 0) {
							botGuild.lastTextChannel.send('Anything related to "Despacito" is FUCKING BLACKLISTED. :middle_finger:');
							return;
						}

						// Queue new track.
						botGuild.tracksQueue.push(track);

						// Create voice connection for current guild, if doesn't exist.
						if (!botGuild.voiceConnection) {
							targetVoiceChannel.join().then(connection => {
								botGuild.voiceConnection = connection;
								botGuild.voiceConnection.on('disconnect', () => {
									botGuild.voiceConnection = false;
								});
								this.onTrackAdded(botGuild, track);
							});
						}

						else this.onTrackAdded(botGuild, track);
						console.log('Track successfully added: ' + url);
					});
				}
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
			message.channel.send(compose('<@%1>, need help with anything? Type **%2help** to see my commands! :raised_hands:', message.author.id, this.config.prefix));
		}

		// Reddit, pretty much.
		else if (message.content.toLowerCase() == 'good bot') {
			message.channel.send(compose('Thank you, <@%1>! :heart:', message.author.id));
		}
		
		else if (message.content.toLowerCase() == 'bad bot') {
			message.reply('https://i.giphy.com/media/L7LylDVYU10lO/giphy.webp');
		}

		// Tomek.
		else if (message.content.toLowerCase().indexOf('tomek') >= 0) {
			message.react('tomkek:275271219279036416');
		}

		// Markiel.
		if (message.content.toLowerCase().indexOf('markiel') >= 0) {
			message.react('markiel:258199535673671680');
			message.channel.send({files: ['./markiel.png']});
		}
	}
}

module.exports = GalaxyBot;