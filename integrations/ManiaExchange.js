const Discord = require("discord.js");
const https = require("https");
const querystring = require("querystring");
const BBCodeToMarkdown = require("bbcode-to-markdown");

const hostname = "api.mania-exchange.com";
const siteTM = "tm.mania-exchange.com";
const siteSM = "sm.mania-exchange.com";

class ManiaExchange {
	constructor() {

	}

	/**
	 * Create https request.
	 *
	 * @param {String} host - Request hostname.
	 * @param {String} path - Request path.
	 * @param {Object} query - Request query. 
	 * @param {Function} callback - Function to call when request is finished.
	 */ 
	static httpsGet(host, path, query, callback) {
		https.get({
			host: host,
			path: path + "?" + querystring.stringify(query),
			headers: {
				"User-Agent": "Mozilla/5.0"
			}
		},
		response => {
			var body = "";
			response.on("data", data => { body += data; });
			response.on("end", () => { callback(body); });
			response.on("error", error => { console.log(error); });
		});
	}

	static search(site, params, callback) {
		if (site != "tm" && site != "sm") {
			throw "Unknown site.";
			return;
		}

		var siteHostname;
		if (site == "tm") siteHostname = siteTM;
		if (site == "sm") siteHostname = siteSM;
		params.api = "on";

		this.httpsGet(siteHostname, "/tracksearch2/search", params, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	static maps(site, maps, callback) {
		this.httpsGet(hostname, "/"+site+"/maps/" + maps.join(","), null, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	static createMapEmbed(mapInfo) {
		if (typeof mapInfo !== "object") return undefined;

		var mxid = 0;
		var site = "";

		if (mapInfo.TrackID) {
			mxid = mapInfo.TrackID;
			site = "tm";
		}

		if (mapInfo.MapID) {
			mxid = mapInfo.MapID;
			site = "sm";
		}

		if (mxid <= 0 || site == "") return undefined;

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

		return new Discord.RichEmbed({
			title: mapInfo.Name,
			url: "https://" + site + ".mania-exchange.com/tracks/" + mxid,
			color: 0x7AD5FF,
			description: BBCodeToMarkdown(mapInfo.Comments).substring(0, 2048),
			author: {
				name: mapInfo.Username,
				url: "https://" + site + ".mania-exchange.com/user/profile/" + mapInfo.UserID
			},
			fields: fields,
			image: { url: "https://" + site + ".mania-exchange.com/tracks/screenshot/normal/" + mxid },
			footer: {
				text: "Mania Exchange",
				icon_url: "https://mania-exchange.com/Content/images/planet_mx_logo.png"
			},
			timestamp: mapInfo.UpdatedAt
		});
	}
}

module.exports = ManiaExchange;