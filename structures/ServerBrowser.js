const Discord = require("discord.js");
const ManiaPlanet = require("./../integrations/ManiaPlanet.js");
const pageLength = 10;

/**
 * Server browser class.
 * Manage the existing server browsers.
 */
class ServerBrowser {
	/**
	 * Create a new server browser.
	 *
	 * @param {string} titleUid - Title used by the server browser.
	 * @param {number} page - Page to open the browser at.
	 * @param {Guild} botGuild - Guild the browser is active in.
	 * @param {Message} message - Message, which created the browser.
	 * @param {GalaxyBot} galaxybot - GalaxyBot.
	 * @returns {ServerBrowser} The new server browser.
	 */
	constructor(titleUid, page, botGuild, message, galaxybot) {
		this.isActive	= false;
		this.nbServers	= 0;
		this.page		= page;
		this.createdAt	= Date.now();

		this.titleUid	= titleUid;
		this.titleInfo	= undefined;
		this.titleName	= "Unknown";

		this.botGuild	= botGuild;
		this.message	= undefined;
		this.guild		= message.guild;
		this.user		= message.author;
		this.channel	= message.channel;
		this.galaxybot	= galaxybot;

		this.init();
	}

	/**
	 * Initialzie the browser.
	 */
	init() {
		// Download the title information.
		ManiaPlanet.title(this.titleUid, titleInfo => {
			// Title not found.
			if (!titleInfo || titleInfo.code == 404) {
				this.channel.send(`Sorry ${this.user}, I can't recognize the **${this.titleUid}** title... :shrug:`);
				this.botGuild.log(`Title "${this.titleUid}" not found.`);
				return;
			}

			this.titleInfo = titleInfo;
			this.titleName = ManiaPlanet.stripFormatting(titleInfo.name);

			this.botGuild.log(`Obtained the ${this.titleName} infomation.`);
			this.update();
		});
	}

	/**
	 * Update the browser.
	 */
	update() {
		if (!this.titleInfo) return;

		let offset = (this.page - 1) * pageLength;

		// Download the servers list.
		ManiaPlanet.servers({ "titleUids[]": this.titleUid, length: pageLength + 1, offset: offset }, serversInfos => {
			this.nbServers = serversInfos.length;

			let content = "", embed = undefined;

			switch (this.nbServers) {
				// No servers were found.
				case 0 : {
					if (this.page <= 1) content = `Looks like there are no servers online in **${this.titleName}** right now, ${this.user}. :rolling_eyes:`;
					else content = `**${this.titleName}** doesn't have this many servers, ${this.user}. :thinking:`;
					break;
				}

				// Only one server online - show a fancy embed.
				case 1 : {
					content = `There's only one server online in **${this.titleName}** right now.`;
					embed = ManiaPlanet.createServerEmbed(serversInfos[0], this.titleInfo);
					break;
				}

				// Multiple servers were found.
				default : {
					/**
					 * Append precending zeroes to an integer.
					 *
					 * @param {number} num - The integer to format.
					 * @param {number} length - The target length of the string.
					 * @returns {string} The formatted integer.
					 */
					function formatInt(num, length) {
						let string = Math.floor(num).toString();
						while (string.length < length) string = "0" + string;
						return string;
					}

					// List the found servers.
					let serversNodes = [];

					for (const serverInfo of serversInfos) {
						if (serversNodes.length >= pageLength) break;

						const order = formatInt(serversNodes.length + 1 + (this.page - 1) * pageLength, 2);
						const nbPlayers = formatInt(serverInfo.player_count, 3);
						const nbPlayersMax = formatInt(serverInfo.player_max, 3);

						serversNodes.push(`${order}. ${nbPlayers} / ${nbPlayersMax} ${ManiaPlanet.stripFormatting(serverInfo.name)}`);
					}

					// Create a fancy embed.
					embed = new Discord.RichEmbed({
						title: this.titleName,
						description: "```" + serversNodes.join("\n") + "```",
						color: ManiaPlanet.getTitleColor(this.titleInfo.primary_color),
						thumbnail: {
							url: this.titleInfo.card_url
						},
						footer: {
							text: "Page #" + this.page
						}
					});
				}
			}

			// Send the message.
			if (!this.message) {
				this.channel.send(content, embed)

				// Initialize the browser for further use.
				.then(message => {
					if (this.isActive || (this.nbServers <= pageLength && this.page > 1)) return;

					const botMember = this.guild.members.get(this.galaxybot.client.user.id);

					// Check if we have Manage Messages permissions here.
					if (!this.channel.permissionsFor(botMember).has("MANAGE_MESSAGES")) return;

					setTimeout(() => { message.react("◀"); }, 250);
					setTimeout(() => { message.react("▶"); }, 500);

					this.isActive = true;
					this.message = message;

					this.botGuild.serverBrowsers.push(this);
					this.botGuild.log(`Initialized ${this.titleName} server browser.`);

					// Remove old browsers.
					const maxBrowsers = this.galaxybot.config.maxbrowsers;

					while (maxBrowsers > 0 && this.botGuild.serverBrowsers.length > maxBrowsers) {
						this.botGuild.serverBrowsers.shift();
					}
				});
			}

			// Edit an existing message.
			else {
				this.message.edit(content, embed || new Discord.RichEmbed({ footer: { text: "Page #" + this.page }}));
			}
		});
	}

	/**
	 * Go to the previous page.
	 */
	prevPage() {
		if (!this.isActive || this.page <= 1) return;

		this.page--;
		this.update();
	}

	/**
	 * Go to the next page.
	 */
	nextPage() {
		if (!this.isActive || this.nbServers < 11) return;

		this.page++;
		this.update();
	}

	/**
	 * Manage new reaction.
	 *
	 * @param {MessageReaction} reaction - New reaction.
	 * @param {User} user - User, who added the reaction.
	 */
	onReaction(reaction, user) {
		if (!reaction || !user || this.message.id != reaction.message.id) return;

		switch (reaction.emoji.name) {
			// Previous page.
			case "◀" :
				this.prevPage();
				break;
			
			// Next page.
			case "▶" :
				this.nextPage();
				break;

			// Ignore other reactions.
			default: return;
		}

		// Remove the reaction.
		reaction.remove(user).catch(error => {
			console.log(error);
		});
	}
}

module.exports = ServerBrowser;