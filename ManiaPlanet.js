const https = require("https");
const querystring = require("querystring");
const hostname = "v4.live.maniaplanet.com";

// For formatting strip: ManiaPlanet formatting codes.
const formatSkip1 = ["g", "h", "i", "l", "m", "n", "o", "p", "s", "t", "w", "z", "<", ">"];
const formatSkip3 = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "a", "b", "c", "d", "e", "f"];

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
	 * @param {String} string - The string to remove formatting.
	 * @returns {String} String without formatting.
	 */
	stripFormatting(string) {
		if (typeof(string) !== "string") {
			return string;
		}
		
		// BOOTYFUL REGEX
		return string.replace(/\$([0-9a-fA-F]{3}|([hlpHLP]\[.+\])|[a-zA-Z<>])/g, "");
	}

	/**
	 * Create https request.
	 *
	 * @param {String} path - Request path. 
	 * @param {Object} query - Request query. 
	 * @param {Function} callback - Function to call when request is finished.
	 */ 
	httpsGet(path, query, callback) {
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
	 * @param {String} channelId - ID of the channel to get episodes.
	 * @param {Number} startDate - Episodes list start timestamp.
	 * @param {Number} endDate - Episodes list end timestamp.
	 * @param {Function} callback - Function to call when request is finished.
	 */
	episodes(channelId, startDate, endDate, callback) {
		this.httpsGet("channels/"+channelId+"/episodes", { "start_date": startDate, "end_date": endDate }, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	/**
	 * Obtain map information.
	 *
	 * @param {String} mapUid - UID of the map to get information.
	 * @param {Function} callback - Function to call when request is finished.
	 */
	map(mapUid, callback) {
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
	servers(options, callback) {
		this.httpsGet("servers/online", options, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	/**
	 * Obtain title information.
	 *
	 * @param {String} titleUid - UID of the title to get information.
	 * @param {Function} callback - Function to call when request is finished.
	 */
	title(titleUid, callback) {
		this.httpsGet("../ingame/public/titles/"+titleUid, null, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	/**
	 * Get the title uid from short code.
	 *
	 * @param {String} titleCode - Short name of the title to find.
	 * @returns {String} UID of the title, if found.
	 */
	getTitleUid(titleCode) {
		var lowercase = titleCode.toLowerCase();
		if (lowercase in commonTitles) return commonTitles[lowercase];
		return titleCode;
	}

	/**
	 * Get the array of available titles codes.
	 *
	 * @returns {Array} Array of available titles codes.
	 */
	getTitleCodes() {
		var titleCodes = [];
		for (const code in commonTitles) titleCodes.push(code);
		return titleCodes;
	}
}

module.exports = ManiaPlanet;