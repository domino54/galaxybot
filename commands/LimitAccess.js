module.exports = {
	name: "limitaccess",
	description: "Shortcut to toggle the `limit-access` setting, which restricts the music player access to the GalaxyBot managers only.",
	serverOnly: true,
	musicPlayer: true,

	execute: command => {
		// No permissions to change the setting.
		if (!command.botGuild.isGalaxyBotManager(command.member)) {
			command.channel.send("Sorry <@" + command.user.id + ">, you don't have permissions to edit my settings. :no_entry:");
			command.botGuild.log("No permissions to limit music access.");
			return;
		}

		const isLimitedAccess = !command.botGuild.isPlayerLimitedAccess();
		command.botGuild.setPlayerLimitedAccess(isLimitedAccess);

		// Enable the ristriction.
		if (isLimitedAccess) {
			const rolesList = command.botGuild.createRolesList();
			var rolesText = "";

			if (rolesList && rolesList.length > 0) {
				rolesText = " and members with one of following roles: " + rolesList.join(", ");
			}

			command.channel.send("Sure <@" + command.user.id + ">, from now on I will respond only to the music player commands sent by the server administrators" + rolesText + ". :ok_hand:");
		}

		// Disable the ristriction.
		else command.channel.send("All members have access to the music player now! :butterfly:");
	}
}