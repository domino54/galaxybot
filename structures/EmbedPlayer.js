const Discord = require("discord.js");
const queueDisplayLimit = 10;

/**
 * An interactive HUI for the music player in a guild.
 */
class EmbedPlayer {
	/**
	 * Creates a new embed player.
	 *
	 * @param {GalaxyBot} galaxybot - GalaxyBot, obviously.
	 * @param {BotGuild} botGuild - Guild, for which the player was created.
	 * @param {Discord.TextChannel} channel - Channel where the embed player will be located.
	 * @returns {EmbedPlayer} New embed player.
	 */
	constructor(galaxybot, botGuild, channel) {
		this.galaxybot		= galaxybot;
		this.botGuild		= botGuild;
		this.channel		= channel;
		this.messageID		= false;
		this.message		= false;
		this.queueCurPage	= 0;
		this.queueNbPages	= 1;
	}

	/**
	 * Initialize newly created player.
	 */
	init() {
		return new Promise((resolve, reject) => {
			this.channel.send(new Discord.RichEmbed({
				title: "GalaxyBot music player (initializing)"
			})).then(msg => {
				this.messageID = msg.id;
				this.message = msg;

				// Reactions used to control the player.
				const reactions = "⏯⏭⏹⬆⬇";
				let reacted = [];

				function done() {
					if (reacted.length == reactions.length) {
						resolve();
					}
				}

				for (let i = 0; i < reactions.length; i++) {
					const emoji = reactions[i];
					
					setTimeout(() => {
						msg.react(emoji).then(reaction => {
							reacted.push(emoji);
							done();
						}).catch(error => {
							console.log(error);
							reject("Could not send all necessary reactions.");
						});
					}, i * 500);
				}
			}).catch(error => {
				reject("Could not send the message.");
			});
		});
	}

	/**
	 * Destroy an embed player.
	 *
	 * @param {String} warning - Optional text message to send in original player channel.
	 */
	destructor(warning) {
		if (typeof warning === "string" && this.channel) {
			this.channel.send(warning);
		}

		if (this.message) {
			this.message.delete().then(msg => {

			}).catch(error => {

			});
		}
	}

	/**
	 * Update the information displayed in the embed player.
	 *
	 * @param {Track} nowPlaying - Currently played track.
	 * @param {Track[]} queue - Tracks in the player queue.
	 * @param {Boolean} paused - Whether the player is paused or not.
	 * @param {Boolean} limited - Whether the player has limited access or not.
	 */
	update(nowPlaying, queue, paused, limited) {
		let titleTags = [];
		if (paused) titleTags.push("paused");
		if (limited) titleTags.push("limited access");

		let embed = new Discord.RichEmbed({
			author: {
				name: "GalaxyBot music player" + (titleTags.length > 0 ? ` (${titleTags.join(", ")})` : ""),
				icon_url: this.galaxybot.client.user.avatarURL
			},
			color: this.botGuild.color
		});

		if (nowPlaying) {
			embed.fields.push({
				name: "Now playing",
				value: nowPlaying.url ? `[${nowPlaying.title.substring(0, 80)}](${nowPlaying.url})` : nowPlaying.title
			});
		}

		this.queueNbPages = Math.floor((queue.length - 1) / queueDisplayLimit) + 1;
		if (this.queueCurPage > this.queueNbPages - 1) this.queueCurPage = this.queueNbPages - 1;

		let queueListEntries = [];
		let startIndex = this.queueCurPage * queueDisplayLimit;
		
		for (let i = startIndex; i < queue.length && queueListEntries.length < startIndex + queueDisplayLimit; i++) {
			let track = queue[i];

			queueListEntries.push(`${i+1}. ${track.title.substring(0, 80)} (${track.sender})`)
		}

		if (queueListEntries.length > 0) {
			embed.fields.push({
				name: `Upcoming (${queue.length})${(this.queueNbPages > 1 ? ` (page ${this.queueCurPage + 1} of ${this.queueNbPages})` : "")}`,
				value: queueListEntries.join("\n")
			})
		}

		this.message.edit(embed).catch(error => {

		});
	}

	/**
	 * Display previous page of the tracks queue.
	 */
	prevQueuePage() {
		if (this.queueCurPage <= 0) return false;
		this.queueCurPage -= 1;
		return true;
	}

	/**
	 * Display next page of the tracks queue.
	 */
	nextQueuePage() {
		if (this.queueCurPage >= this.queueNbPages - 1) return false;
		this.queueCurPage += 1;
		return true;
	}
}

module.exports = EmbedPlayer;