const https = require('https');
const querystring = require('querystring');

const hostname = 'api.mania-exchange.com';
const siteTM = 'tm.mania-exchange.com';
const siteSM = 'sm.mania-exchange.com';

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
	httpsGet(host, path, query, callback) {
		https.get({
			host: host,
			path: path + '?' + querystring.stringify(query),
			headers: {
				'User-Agent': 'Mozilla/5.0'
			}
		},
		response => {
			var body = '';
			response.on('data', data => { body += data; });
			response.on('end', () => { callback(body); });
			response.on('error', error => { console.log(error); });
		});
	}

	search(site, params, callback) {
		if (site != 'tm' && site != 'sm') {
			throw 'Unknown site.';
			return;
		}

		var siteHostname;
		if (site == 'tm') siteHostname = siteTM;
		if (site == 'sm') siteHostname = siteSM;
		params.api = 'on';

		this.httpsGet(siteHostname, '/tracksearch2/search', params, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}

	maps(site, maps, callback) {
		this.httpsGet(hostname, '/'+site+'/maps/' + maps.join(','), null, body => {
			var result = JSON.parse(body);
			callback(result);
		});
	}
}

module.exports = ManiaExchange;