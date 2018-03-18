const Discord = require("discord.js");
const https = require("https");
const querystring = require("querystring");
const hostname = "v4.live.maniaplanet.com";

// Common titles short codes.
const commonTitles = {
	"canyon": "TMCanyon@nadeo",
	"storm": "SMStorm@nadeo",
	"stadium": "TMStadium@nadeo",
	"valley": "TMValley@nadeo",
	"lagoon": "TMLagoon@nadeo",
	"galaxy": "GalaxyTitles@domino54",
	"pursuit": "Pursuit@domino54",
	"pursuit-s": "PursuitStadium@domino54",
	"royal": "SMStormRoyal@nadeolabs",
	"siege": "SMStormSiege@nadeolabs",
	"battle": "SMStormBattle@nadeolabs",
	"elite": "SMStormElite@nadeolabs",
	"combo": "SMStormCombo@nadeolabs",
	"joust": "SMStormJoust@nadeolabs",
	"warlords": "SMStormWarlords@nadeolabs",
	"heroes": "SMStormHeroes@nadeolabs",
	"tm2": "Trackmania_2@nadeolabs",
	"competition": "esl_comp@lt_forever",
	"rpg": "RPG@tmrpg",
	"obstacle": "obstacle@smokegun",
	"stormium": "GEs@guerro",
	"infection": "infection@dmark",
	"speedball": "SpeedBall@steeffeen",
	"alpine": "TMOneAlpine@florenzius"
};

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

	/**
	 * Get channel episodes list.
	 *
	 * @param {string} channelId - ID of the channel to get episodes.
	 * @param {Number} startDate - Episodes list start timestamp.
	 * @param {Number} endDate - Episodes list end timestamp.
	 * @param {Function} callback - Function to call when request is finished.
	 */
	static episodes(channelId, startDate, endDate, callback) {
		this.httpsGet("channels/" + channelId + "/episodes", { "start_date": startDate, "end_date": endDate }, body => {
			var result = JSON.parse(body);
			callback(result);
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
		this.httpsGet("../ingame/public/titles/"+titleUid, null, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	/**
	 * Get the title uid from short code.
	 *
	 * @param {string} titleCode - Short name of the title to find.
	 * @returns {string} UID of the title, if found.
	 */
	static getTitleUid(titleCode) {
		var lowercase = titleCode.toLowerCase();
		if (lowercase in commonTitles) return commonTitles[lowercase];
		return titleCode;
	}

	/**
	 * Get the array of available titles codes.
	 *
	 * @returns {Array} Array of available titles codes.
	 */
	static getTitleCodes() {
		var titleCodes = [];
		for (const code in commonTitles) titleCodes.push(code);
		return titleCodes;
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

		// Punchline and description.
		var fields = [{
			name: '"' + this.stripFormatting(titleInfo.punchline) + '"',
			value: this.stripFormatting(titleInfo.description)
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
			image: { url: titleInfo.card_url },
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