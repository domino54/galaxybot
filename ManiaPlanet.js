const https = require('https');
const querystring= require('querystring');
const hostname = 'v4.live.maniaplanet.com';

// For formatting strip: ManiaPlanet formatting codes.
const formatSkip1 = ['g', 'h', 'i', 'l', 'm', 'n', 'o', 'p', 's', 't', 'w', 'z'];
const formatSkip3 = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];

// Common titles short codes.
const commonTitles = {
	'canyon': 'TMCanyon@nadeo',
	'storm': 'SMStorm@nadeo',
	'stadium': 'TMStadium@nadeo',
	'valley': 'TMValley@nadeo',
	'lagoon': 'TMLagoon@nadeo',
	'galaxy': 'GalaxyTitles@domino54',
	'pursuit': 'PursuitStadium@domino54',
	'multi': 'Pursuit@domino54',
	'royal': 'SMStormRoyal@nadeolabs',
	'siege': 'SMStormSiege@nadeolabs',
	'battle': 'SMStormBattle@nadeolabs',
	'elite': 'SMStormElite@nadeolabs',
	'combo': 'SMStormCombo@nadeolabs',
	'joust': 'SMStormJoust@nadeolabs',
	'warlords': 'SMStormWarlords@nadeolabs',
	'heroes': 'SMStormHeroes@nadeolabs',
	'tm2': 'Trackmania_2@nadeolabs',
	'competition': 'esl_comp@lt_forever',
	'rpg': 'RPG@tmrpg',
	'obstacle': 'obstacle@smokegun',
	'stormuim': 'GEs@guerro',
	'infection': 'infection@dmark',
	'speedball': 'SpeedBall@steeffeen'
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
			path: '/webservices/' + path + '?' + querystring.stringify(query)
		}, response => {
			var body = '';
			response.on('data', data => { body += data; });
			response.on('end', () => { callback(body); });
			response.on('error', error => { console.log(error); });
		});
	}

	/**
	 * Obtain online servers list.
	 *
	 * @param {Object} options - Request options.
	 * @param {Function} callback - Function to call when request is finished.
	 */
	servers(options, callback) {
		this.httpsGet('servers/online', options, body => {
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
		this.httpsGet('titles/'+titleUid, null, body => {
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