const http = require('http');
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
	httpGet(host, path, query, callback) {
		http.get({
			hostname: host,
			path: path + '?' + querystring.stringify(query)
		}, response => {
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

		var arg = params;
		arg.api = 'on';
		arg.format = 'json';

		this.httpGet(siteHostname, 'tracksearch2/search', arg, body => {
			console.log(body);
			var result = JSON.parse(body);
			callback(result);
		});
	}
}

module.exports = ManiaExchange;