GalaxyBot
=========
A Discord bot capable of playing some music and doing other stuff. Pretty cute, too.

## Commands
All available commands of the GalaxyBot. Default command prefix is `!`.

Reference: `command <mandatory> [optional]`.

### General

| Command                   | Description |
|:-------------------------:| ----------- |
| `dommy`                   | Mentions [Dommy](https://github.com/domino54/) with a thinking gif. 🤔
| `git`                     | Paste a link to this repository.
| `invite`                  | Sends link allowing users to add the bot to their server.
| `guilds`                  | Lists all servers the bot is currently in. Available only to the bot owner, via direct message.
| `avatar [name]`           | Sends you direct link to your or someone's avatar.
| `settings [name] <value>` | Manage bot settings in the server. See the [settings list](#Settings) below for more information.
| `time`                    | Current time of the bot server machine.

### ManiaPlanet

| Command                   | Description |
|:-------------------------:| ----------- |
| `channel <sm\|tm>`        | See what's currently being played on channels.
| `servers <id\|code>`      | Listing up to 10 most populated servers of a specific ManiaPlanet title.
| `title <id\|code>`        | Shows information about given title from [ManiaPlanet website](http://maniaplanet.com/).
| `map <uid>`               | Shows information about given map from ManiaPlanet website.
| `mx <tm\|sm> <id\|query>` | Search for [Mania Exchange](http://mania-exchange.com/) map by ID or map name.

Bot automatically reacts to ManiaPlanet titles and maps links, as well as Mania Exchange maps links. This can be turned off via guild ettings.

Instead of using title `id` in commands you can use one of following short codes: canyon, storm, stadium, valley, lagoon, galaxy, pursuit, pursuit-s, royal, siege, battle, elite, combo, joust, warlords, heroes, tm2, competition, rpg, obstacle, stormuim, infection, speedball, alpine.

### Music player

**Note:** Supported platforms are YouTube, Facebook and Streamable.

| Command                         | Description |
|:-------------------------------:| ----------- |
| `play <url\|query> [now\|next]` | Connects to a voice channel and plays audio from given link. If something different than URL is given, bot will search YouTube and play first result. `now` and `next` allow administrators to play the track instantly or insert it at the beginning of the queue.
| `undo`                          | Removes latest track added by the user.
| `now`                           | Shows what is currently being played.
| `next [me\|order]`              | Shows name of the next track in the queue. `me` shows upcoming song requested by you. `order` can tell what song is at specific queue position.
| `queue`                         | Lists up to 10 first entries in the queue.
| `skip`                          | Skips currently played song. Administrators can skip any song, while other users may skip it only it it's been requested by them.
| `stop`                          | Allows administrators to stop music playback and clear the queue.
| `pause`                         | Pauses the current track playback. The same command will resume the playback.

## Settings
Available bot settings, which server administrators can tweak to customize the bot's behavior.

| Setting        | Type          | Description |
|:--------------:|:-------------:| ----------- |
| `prefix`       | `char`        | Character used to indicate commands.
| `embed-mx`     | `bool`        | Detect and send Mania Exchange links.
| `embed-titles` | `bool`        | Detect and send ManiaPlanet titles links.
| `embed-maps`   | `bool`        | Detect and send ManiaPlanet maps links.
| `roles`        | `string[]`    | Manage roles with permissions to manage GalaxyBot.
| `max-duration` | `int`         | Maximum duration (in seconds) of music tracks users without full permissions can play. `0` = no limit.
| `unit-convert` | `bool`        | Convert imperial (retarded) unit system values into metric.
| `music-cmd-ch` | `slowflake[]` | The only channels, where music player commands are accepted.
| `stalk-edits`  |` bool`        | Mock members for editing their messages.

Settings with array type require `add` and `remove` keywords, for example `!setings music-cmd-ch add #music-bot`.

## Screenshots

![Lagoon title card](https://i.imgur.com/n41wMvK.png)
![Music player](https://i.imgur.com/hGyRSFq.png)
![ShootMania channel](https://i.imgur.com/95Z3hSG.png)
![Mania Exchange map](https://i.imgur.com/2FIayqY.png)
