const Track = require("./../structures/Track.js");

module.exports = {
	name: "playattachment",
	description: "Puts the latest audio file attachment sent in the channel in the queue. `#` can be used to determine which attachment should be played. Adding the `channel` parameter will search for an attachment in this particular channel.",
	serverOnly: true,
	musicPlayer: true,
	limitedAccess: true,

	execute: command => {
		// Music player not running and user is not in a voice channel.
		if (!command.botGuild.voiceConnection && !command.member.voiceChannel) {
			command.channel.send(`You need join a voice channel before I can start playing anything, ${command.user}. :loud_sound:`);
			command.botGuild.log("User not in any voice channel.");
			return;
		}

		// User not in our voice channel.
		if (command.botGuild.voiceConnection && command.member.voiceChannel != command.botGuild.voiceConnection.channel && !command.botGuild.isGalaxyBotManager(command.member)) {
			command.channel.send(`You need to join my voice channel if you want to request something, ${command.user}. :point_up:`);
			command.botGuild.log("User not in voice channel with bot.");
			return;
		}

		// Queue has reached the limit.
		const maxQueueLength = !isNaN(command.galaxybot.config.maxqueue) ? command.galaxybot.config.maxqueue : 0;

		if (maxQueueLength > 0 && command.botGuild.tracksQueue.length >= maxQueueLength) {
			command.channel.send(`Sorry ${command.user}, but it looks like the music player queue has reached the **${maxQueueLength}** requests limit. :outbox_tray:`);
			command.botGuild.log(`Music player queue full (${maxQueueLength}).`);
			return;
		}
		
		const order = parseInt(command.arguments[0]);
		const channelId = command.arguments[1] ? command.arguments[1].match(/[0-9]+/) : false;
		var targetChannel;

		// A channel has been specified.
		if (channelId !== false) {
			targetChannel = command.guild.channels.get(channelId.toString());

			// Channel not found.
			if (targetChannel === undefined) {
				command.channel.send(`Sorry ${command.user}, I couldn't find the channel you've specified. It doesn't exist or belongs to another server. :thinking:`);
				command.botGuild.log(`Channel with ID ${channelId} not found.`);
				return;
			}
		}

		// Default to the channel command was sent in.
		if (targetChannel === undefined) targetChannel = command.channel;

		targetChannel.fetchMessages({ limit: 50 }).then(messages => {
			var nbAttachments = 0;
			var attachmentURL = false;

			messages.forEach((message, messageId) => {
				if (attachmentURL !== false || message.attachments.size <= 0) return;

				message.attachments.forEach((attachment, attachmentId) => {
					if (attachmentURL !== false) return;

					// Look for audio files.
					if (!attachment.filename.match(/\.(mp3|ogg|wav|flac|m4a|aac|webm)$/i)) return;

					nbAttachments++;

					// Find n-th attachment sent before command was sent.
					if (!isNaN(order) && order > 0 && nbAttachments != order) return;

					attachmentURL = attachment.proxyURL;
				});
			});

			// No attachments found.
			if (attachmentURL === false) {
				command.channel.send(`Sorry ${command.user}, I was unable to find recently sent attachments in ${targetChannel}. :cry:`);
				command.botGuild.log(`No attachments found in #${targetChannel.name}.`);
				return;
			}

			// Attempt to create a track.
			else {
				var track = new Track(attachmentURL, command.member, track => {
					command.botGuild.onTrackCreated(track, command.member, attachmentURL);
				});
			}
		})
		.catch(error => {
			console.log(error);
		});
	}
}