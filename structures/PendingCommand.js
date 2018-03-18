/**
 * Pending command.
 * A command that awaits processing by GalaxyBot.
 */
class PendingCommand {
	/**
	 * Constructor.
	 *
	 * @param {GalaxyBot} galaxybot - GalaxyBot, obviously.
	 * @param {Guild} botGuild - The guild command was sent in.
	 * @param {User} botUser - The user, who sent the command.
	 * @param {string} name - Name of the command.
	 * @param {Array<string>} args - Arguments given in the command.
	 * @param {Message} message - The message in which command was sent.
	 */
	constructor(galaxybot, botGuild, botUser, name, args, message) {
		this.name = name;
		this.arguments = args;

		this.galaxybot = galaxybot;
		this.botGuild = botGuild ? botGuild : botUser;
		this.botUser = botUser;

		this.message = message;
		this.guild = message.guild;
		this.user = message.author;
		this.channel = message.channel;
		this.member = message.member;
	}
}

module.exports = PendingCommand;