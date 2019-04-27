module.exports = {
	name: "oldest",
	group: "info",
	description: "Generate a Markdown file, containing a table listing all members of the server in order of the join time.",
	serverOnly: true,

	execute: command => {
		// Command is still on cooldown.
		if (Date.now() < command.botGuild.nextOldestAllowed) {
			const diff = command.botGuild.nextOldestAllowed - Date.now();
			command.channel.send(`Sorry ${command.user}, you can't use this command right now. Try again in ${~~(diff / 1000)} second(s)!`);
			command.botGuild.log("Oldest members list has a timeout.");
			return;
		}

		var members = [];

		/**
		 * Append precending zeroes to an integer.
		 *
		 * @param {number} num - The integer to format.
		 * @param {number} length - The target length of the string.
		 * @returns {string} The formatted integer.
		 */
		function formatInt(num, length) {
			let string = Math.floor(num).toString();
			while (string.length < length) string = "0" + string;
			return string;
		}

		// Get the members 
		command.guild.members.forEach((member, memberID) => {
			members.push({
				id: memberID,
				tag: member.user.tag.replace(/\|/g, "\\|"),
				timestamp: member.joinedTimestamp,
				date:
					formatInt(member.joinedAt.getUTCDate(), 2) + "-" + formatInt(member.joinedAt.getUTCMonth() + 1, 2) + "-" + member.joinedAt.getUTCFullYear() + " " +
					formatInt(member.joinedAt.getUTCHours(), 2) + ":" + formatInt(member.joinedAt.getUTCMinutes(), 2),
				days: Math.floor((Date.now() - member.joinedAt.getTime()) / 86400000).toString()
			});
		});

		// Set the timeout (0.1 second per member).
		command.botGuild.nextOldestAllowed = Date.now() + members.length * 100;

		// Sort members by the join time, ascending.
		members = members.sort((a, b) => { return a.timestamp - b.timestamp; });

		var rows = [];
		var posLength = 0;
		var tagLength = 0;

		/**
		 * Append spaces after the strign to match the given length.
		 *
		 * @param {string} string - The string to format.
		 * @param {number} length - The target length of the string.
		 * @returns {string} The formatted string.
		 */
		function formatString(string, length) {
			while (string.length < length) string += " ";
			return string;
		}

		/**
		 * Generate a bar made of pauses of ceratin length.
		 *
		 * @param {number} length - The target length of the bar.
		 * @returns {string} The generated bar.
		 */
		function bars(length) {
			let string = "";
			while (string.length < length) string += "-";
			return string;
		}

		// Get the maxinum width of the table columns.
		for (var i = 0; i < members.length; i++) {
			const member = members[i];
			member.position = (i + 1).toString() + ".";

			if (posLength < member.position.length) posLength = member.position.length;
			if (tagLength < member.tag.length) tagLength = member.tag.length;
		}

		// Create the table header.
		rows.push(`| ${formatString("#", posLength)} | ${formatString("Member", tagLength)} | ${formatString("Days", 4)} | ${formatString("Join date", 16)} |`);
		rows.push(`|:${bars(posLength)}:| ${bars(tagLength)} |:${bars(4)}:|:${bars(16)}:|`);

		// Create a row for every member listed.
		for (const member of members) {
			rows.push(`| ${formatString(member.position, posLength)} | ${formatString(member.tag, tagLength)} | ${formatString(member.days, 4)} | ${member.date} |`);
		}

		// Send an attachment.
		command.channel.send(`I've genrated a nice Markdown table, where you can see the members of **${command.galaxybot.escapeMentions(command.guild.name)}** listed in order of join time, ${command.user}.`, {
			files: [{
				attachment: new Buffer(`# Oldest members of ${command.guild.name}\n\n${rows.join("\n")}`),
				name: "Oldest members.md"
			}]
		});
	}
}