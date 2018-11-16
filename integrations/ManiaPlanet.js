const Discord = require("discord.js");
const https = require("https");
const querystring = require("querystring");
const hostname = "prod.live.maniaplanet.com";

let existingTitles = [];

// Write complete ManiaPlanet node SDK?

/**
 * ManiaPlanet web services.
 */
class ManiaPlanet {
	/**
	 * Creates new Maniaplanet WS.
	 */
	constructor() {

	}

	/**
	 * Remove ManiaPlanet text formatting from a string.
	 *
	 * @param {string} string - The string to remove formatting.
	 * @returns {string} String without formatting.
	 */
	static stripFormatting(string) {
		if (typeof(string) !== "string") {
			return string;
		}
		
		// BOOTYFUL REGEX
		return string.replace(/\$([0-9a-fA-F]{3}|([hlpHLP]\[.+\])|[a-zA-Z<>])/g, "");
	}

	/**
	 * Create https request.
	 *
	 * @param {string} path - Request path. 
	 * @param {Object} query - Request query. 
	 * @param {Function} callback - Function to call when request is finished.
	 */ 
	static httpsGet(path, query, callback) {
		https.get({
			hostname: hostname,
			path: "/webservices/" + path + "?" + querystring.stringify(query)
		}, response => {
			var body = "";
			response.on("data", data => { body += data; });
			response.on("end", () => { callback(body); });
			response.on("error", error => { console.log(error); });
		});
	}

	static updateTitlesList() {
		return new Promise((resolve, reject) => {
			this.httpsGet("titles", { "orderBy": "playersLast24h", "length": 1000 }, body => {
				var results = JSON.parse(body);

				if (!Array.isArray(results)) {
					reject("Titles list empty");
					return;
				}

				existingTitles = results;

				/*for (const title of results) {
					existingTitles.push({
						uid: title.uid,
						name: title.name
					});
				}*/

				resolve(results.length);
			});
		});
	}

	/**
	 * Obtain map information.
	 *
	 * @param {string} mapUid - UID of the map to get information.
	 * @param {Function} callback - Function to call when request is finished.
	 */
	static map(mapUid, callback) {
		this.httpsGet("maps/"+mapUid, null, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	/**
	 * Obtain online servers list.
	 *
	 * @param {Object} options - Request options.
	 * @param {Function} callback - Function to call when request is finished.
	 */
	static servers(options, callback) {
		this.httpsGet("servers/online", options, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	/**
	 * Obtain title information.
	 *
	 * @param {string} titleUid - UID of the title to get information.
	 * @param {function} callback - Function to call when request is finished.
	 */
	static title(titleUid, callback) {
		this.httpsGet("../ingame/public/titles/" + encodeURIComponent(titleUid), null, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	/**
	 * Search for a title by UID or the name..
	 *
	 * @param {string} searchString - Short name of the title to find.
	 * @returns {string} UID of the title, if found.
	 */
	static getTitleUid(searchString) {
		let matchedTitles = [], searchWords = searchString.substring(0, 64).match(/\w+/g);
		if (!searchWords) return searchString;

		function regexEscape(string) {
			return string.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
		};

		// Scan titles.
		for (const title of existingTitles) {
			let totalMatches = 0;

			// Scan for every separate word.
			for (const word of searchWords) {
				const regex = new RegExp(regexEscape(word), "gi");

				for (const prop of [title.uid, title.name]) {
					let match = prop.match(regex);
					if (match) totalMatches += match.length;
				}
			}

			if (totalMatches <= 0) continue;

			// Push matched title.
			matchedTitles.push({
				uid: title.uid,
				matches: totalMatches
			});
		}

		if (matchedTitles.length <= 0) return searchString;

		// Sort by most matches descending.
		matchedTitles = matchedTitles.sort((a, b) => {
			return b.matches - a.matches
		});

		// Return result with most matches.
		return matchedTitles[0].uid;
	}

	/**
	 * Get color integer of a title.
	 *
	 * @param {string} text - Color in Nando's format.
	 * @returns {number} The color integer.
	 */
	static getTitleColor(text) {
		if (typeof text !== "string") return 0;

		var color = "";
		for (var i = 0; i < text.length; i++) color += text[i] + text[i];
		return parseInt(color, 16);
	}

	/**
	 * Obtain information about a server by its login or phrase in name.
	 *
	 * @param {string} login - Login of the server to get.
	 * @param {function} callback - Function called after request is finished.
	 */
	static serverInfo(login, callback) {
		this.httpsGet("servers/online", { search: login, length: 1 }, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	/**
	 * Create a Discord embed from given server data.
	 *
	 * @param {Object} serverInfo - Information about the server.
	 * @param {Object} titleInfo - Information about the title.
	 * @returns {RichEmbed} The Discord embed.
	 */
	static createServerEmbed(serverInfo, titleInfo) {
		if (typeof serverInfo !== "object" || typeof titleInfo !== "object") return undefined;

		var embed = new Discord.RichEmbed({
			title: this.stripFormatting(serverInfo.name),
			description: this.stripFormatting(serverInfo.description),
			thumbnail: {
				url: titleInfo.card_url
			},
			fields: [{
				name: "Title pack",
				value: this.stripFormatting(titleInfo.name),
				inline: true
			}, {
				name: "Players",
				value: serverInfo.player_count + " / " + serverInfo.player_max,
				inline: true
			}, {
				name: "Ladder limits",
				value: serverInfo.ladder_limit_min / 1000 + "k - " + serverInfo.ladder_limit_max / 1000 + "k LP",
				inline: true
			}, {
				name: "Game mode",
				value: serverInfo.script_name,
				inline: true
			}],
			footer: {
				text: serverInfo.zone.replace(/\|/g, " • ")
			}
		});

		// Embed color.
		var color = false;
		if (serverInfo.player_count > 0) color = this.getTitleColor(titleInfo.primary_color);
		if (serverInfo.player_count >= serverInfo.player_max) color = 0xDD3333;
		if (color !== false) embed.setColor(color);

		return embed;
	}

	/**
	 * Create a Discord embed from given title data.
	 *
	 * @param {Object} titleInfo - Information about the title.
	 * @returns {RichEmbed} The Discord embed.
	 */
	static createTitleEmbed(titleInfo) {
		if (typeof titleInfo !== "object") return undefined;

		const description = this.stripFormatting(titleInfo.description);
		let desc = description.substring(0, 256);
		if (desc != description) desc += "...";

		// Punchline and description.
		var fields = [{
			name: '"' + this.stripFormatting(titleInfo.punchline) + '"',
			value: desc
		}];

		// Title cost in Planets.
		if (titleInfo.cost && titleInfo.cost > 0) fields.push({
			name: "Cost",
			value: titleInfo.cost + " Planets",
			inline: true
		});

		// Registrations and online players.
		fields.push({
			name: "Registrations",
			value: titleInfo.registrations,
			inline: true
		}, {
			name: "Players last 24h",
			value: titleInfo.players_last24h,
			inline: true
		}, {
			name: "Online players",
			value: titleInfo.online_players,
			inline: true
		}, {
			name: "Download",
			value: `[Direct link](${titleInfo.download_url})`,
			inline: true
		});

		// Title maker.
		if (titleInfo.title_maker_uid) fields.push({
			name: "Created with",
			value: titleInfo.title_maker_name,
			inline: true
		});

		// Create embed.
		return new Discord.RichEmbed({
			author: {
				name: this.stripFormatting(titleInfo.author_nickname),
				url: "https://www.maniaplanet.com/players/" + titleInfo.author_login
			},
			title: this.stripFormatting(titleInfo.name),
			url: titleInfo.title_page_url,
			color: this.getTitleColor(titleInfo.primary_color),
			fields: fields,
			thumbnail: { url: titleInfo.card_url },
			timestamp: new Date(titleInfo.last_update * 1000).toISOString()
		});
	}

	/**
	 * Create a Discord embed from given map data.
	 *
	 * @param {Object} mapInfo - Information about the map.
	 * @returns {RichEmbed} The Discord embed.
	 */
	static createMapEmbed(mapInfo) {
		if (typeof mapInfo !== "object") return undefined;

		return new Discord.RichEmbed({
			title: this.stripFormatting(mapInfo.name),
			url: "https://www.maniaplanet.com/maps/" + mapInfo.uid,
			image: { url: mapInfo.thumbnail_url },
			author: {
				name: mapInfo.author_login,
				url: "https://www.maniaplanet.com/players/" + mapInfo.author_login
			},
			description:
				"[**Play**](http://www.maniaplanet.com/maps/" + mapInfo.uid + "/code/play) • " +
				"[**Download**](" + mapInfo.download_url + ")"
		});
	}
}

module.exports = ManiaPlanet;