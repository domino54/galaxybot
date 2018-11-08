module.exports = {
	name: "relog",
	description: "Relog the GalaxyBot to (other) Discord account. Owner access only.",
	hidden: true,
	owner: true,

	execute: command => {
		command.galaxybot.login();
	}
}