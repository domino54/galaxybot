const https = require("https");

class RedditFeed {
	/**
	 * Creates a new feed.
	 */
	constructor(options) {
		this.timeout		= options && options["timeout"] ? options["timeout"] : 3600000;
		this.cacheSize		= options && options["cache-size"] ? options["cache-size"] : 100;
		this.subreddits		= new Map();
		this.uniqueLists	= new Map();
		this.requests		= [];
		this.toFullfill		= new Map();
	}

	/**
	 * Fullfill requests that were created while obtaining posts.
	 *
	 * @param {String} sub - Name of the subreddit.
	 */
	fullfillRequests(sub) {
		if (this.toFullfill.has(sub)) {
			for (const fun of this.toFullfill.get(sub)) {
				fun();
			}

			this.toFullfill.delete(sub);
		}

		this.requests.splice(this.requests.indexOf(sub), 1);
	}

	/**
	 * Fullfill requests that were created while obtaining posts.
	 *
	 * @param {String} sub - Name of the subreddit.
	 * @returns {Promise.<Object>} Info about the given sub.
	 */
	getSubInfo(sub) {
		return new Promise((resolve, reject) => {
			// If sub already has ongoing request, wait for it to finish.
			// In other words: avoid doing the request twice.
			if (this.requests.includes(sub)) {
				if (!this.toFullfill.has(sub)) {
					this.toFullfill.set(sub, []);
				}

				this.toFullfill.get(sub).push(() => {
					resolve(this.subreddits.get(sub));
				});
			}

			// If sub posts aren't cached or cache has expired, start a new request.
			else if (!this.subreddits.has(sub) || Date.now() > this.subreddits.get(sub).timeout) {
				this.requests.push(sub);

				https.get(
					`https://www.reddit.com/r/${sub}/hot.json?limit=${this.cacheSize}`,
					{headers: {"User-Agent": "GalaxyBot"}},
					res => {
						let result = "";

						res.on("data", chunk => {
							result += chunk;
						});

						res.on("end", () => {
							try {
								const response = JSON.parse(result);
								const posts = response["data"]["children"];

								if (posts && posts.length > 0) {
									let postsMap = new Map();
									let postsIDs = [];

									// This parses the data to a format we prefer.
									for (const post of posts) {
										const postData = post["data"];

										postsMap.set(postData.id, postData);
										postsIDs.push(postData.id);
									}

									// Cache the subreddit posts globally.
									this.subreddits.set(sub, {
										name: sub,
										timeout: Date.now() + this.timeout,
										posts: postsMap,
										ids: postsIDs
									});

									// Remove seen posts if not cached anymore.
									this.uniqueLists.forEach((subreddits, id) => {
										if (subreddits.has(sub)) {
											let seenPostsIDs = subreddits.get(sub);

											seenPostsIDs = seenPostsIDs.filter(postID => {
												return postsIDs.includes(postID);
											});

											subreddits.set(sub, seenPostsIDs);
										}
									});

									resolve(this.subreddits.get(sub));
								}
							}

							// Error occured somewhere, maybe in JSON parser.
							catch (error) {
								reject(error);
							}

							this.fullfillRequests(sub);
						});
					}
				).on("error", error => {
					reject(error);
					this.fullfillRequests(sub);
				});
			}

			// Get posts normally.
			else {
				resolve(this.subreddits.get(sub));
			}
		});
	}

	/**
	 * Obtain a random post from the given sub, within given non-repeating list.
	 *
	 * @param {String} sub - Name of the subreddit.
	 * @param {String} listID - Unique list ID to avoid repeating.
	 * @returns {Promise.<Object>} A random post from the given sub.
	 */
	randomPost(sub, listID) {
		return new Promise((resolve, reject) => {
			this.getSubInfo(sub).then(subInfo => {
				// If the list doesn't exist yet, make it.
				if (!this.uniqueLists.has(listID)) {
					this.uniqueLists.set(listID, new Map());
				}

				var list = this.uniqueLists.get(listID);
				let seenPostsIDs = [];

				// Get the seen posts of the given list.
				if (list.has(sub)) {
					seenPostsIDs = list.get(sub);

					// If we've seen all posts, start over with empty sub array.
					if (seenPostsIDs.length >= subInfo.ids.length) seenPostsIDs = [];
				}

				// We'll pick a random post from the not seen array.
				let notSeenPostsIDs = subInfo.ids.filter(postID => {
					return !seenPostsIDs.includes(postID);
				});

				let postID = notSeenPostsIDs[Math.floor(Math.random() * notSeenPostsIDs.length)];

				// Count that post as seen.
				seenPostsIDs.push(postID);
				list.set(sub, seenPostsIDs);

				// Return our post.
				resolve(subInfo.posts.get(postID));
			}).catch(error => {
				reject(error);
			});
		});
	}

	/**
	 * Create a Discord embed out a post.
	 *
	 * @param {Object} post - The post to create embed of.
	 * @returns {Object} Discord embed.
	 */
	createEmbed(post) {
		if (!post) return null;

		return {
			author: {
				name: "u/" + post.author,
				url: "https://www.reddit.com/user/" + post.author
			},
			title: post.title,
			description: post.selftext.substring(0, 2000),
			url: "https://www.reddit.com" + post.permalink,
			image: {
				url: post.url
			},
			footer: {
				text: post.score + " point" + (post.score != 1 ? "s" : "") + " • " + post.num_comments + " comment" + (post.num_comments != 1 ? "s" : "")
			},
			timestamp: new Date(post.created_utc * 1000).toISOString()
		};
	}
}

module.exports = RedditFeed;