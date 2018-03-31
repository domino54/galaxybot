GalaxyBot
=========
A Discord bot providing multiple integrations for Nadeo games in ManiaPlanet platform, capable of playing some music and doing other useless stuff. Sometimes behaves extremely impolitely, but that's just her nature.

## Commands
All available commands of the GalaxyBot. Default command prefix is `!`.

Reference: `command <mandatory> [optional]`.

### General

| Command            | Description |
|:------------------:| ----------- |
| `about`            | Shows some details about the GalaxyBot.
| `help [command]`   | Sends a link to the commands reference or a description of the given command.
| `dommy`            | Mention [`Dommy#7014`](https://github.com/domino54/) with a thinking GIF. 🤔
| `git`              | Sends a link to the GitHub repository with source code of the GalaxyBot.
| `invite`           | Sends a link, which allows the user to add GalaxyBot to their server.
| `guilds`           | The number of guilds GalaxyBot is active in. Full list featuring guilds names is available only to the bot owner, through a direct message.
| `avatar [name]`    | Sends you direct link to your or someone's avatar.
| `user [name]`      | Display some information about your profile or the profile of a specific user.
| `playing <game>`   | Current number of users seen by the GalaxyBot, which are playing the given `game`.
| `oldest`           | Generate a Markdown file, containing a table listing all members of the server in order of the join time.
| `8ball [question]` | Ask the GalaxyBot a yes or no question, it knows the answer to everything.
| `time`             | Current time of the machine GalaxyBot is running on.

### Moderation

| Command                   | Description |
|:-------------------------:| ----------- |
| `settings <name> [value]` | Manage the GalaxyBot settings in the server. Anyone can view the bot settings, however only the GalaxyBot managers can edit them. See the [settings list](#Settings) below for more information.
| `purge <count> [user]`    | Removes up to 100 messages in current text channel. Requires both the sender and GalaxyBot to have **Manage messages** permissions in the channel. `user` can be specified to delete messages of a specific user.

### ManiaPlanet

| Command                     | Description |
|:---------------------------:| ----------- |
| `channel <sm\|tm>`          | See what's currently being played on channels. Use `sm` for ShootMania channel and `tm` for TrackMania channel.
| `servers <id\|code> [page]` | Listing up to 10 most populated servers of a specific ManiaPlanet title. By adding `page`, you can navigate through the list.
| `title <id\|code>`          | Shows information about the given title from the [ManiaPlanet website](http://maniaplanet.com/).
| `map <uid>`                 | Shows information about the given map from ManiaPlanet website.
| `mx <tm\|sm> <id\|query>`   | Search for a [Mania Exchange](http://mania-exchange.com/) map by its ID or the map name.
| `mpserver <login\|query>`   | Find a ManiaPlanet server by its login or name and show its current status.
| `addserver <login\|query>`  | Add a ManiaPlanet server status to the statuses channel. Up to 10 servers will be detected and updated.

Bot automatically reacts to ManiaPlanet titles and maps links, as well as Mania Exchange maps links. This can be turned off via guild settings.

Instead of using title `id` in commands you can use one of following short codes: canyon, storm, stadium, valley, lagoon, galaxy, pursuit, pursuit-s, royal, siege, battle, elite, combo, joust, warlords, heroes, tm2, competition, rpg, obstacle, stormuim, infection, speedball, alpine.

### Music player

**Note:** Supported platforms are YouTube, Facebook and Streamable.

| Command                         | Description |
|:-------------------------------:| ----------- |
| `play <url\|query> [now\|next]` | Connects to a voice channel and plays audio from the given link. You can request videos from SoundCloud, Mixcloud, YouTube, Vimeo, Dailymotion, Facebook and Streamable, send direct link to a file or a YouTube playlist. If an invalid URL is given, GalaxyBot will search the phrase in YouTube and play the first playable result. `now` and `next` allow GalaxyBot managers to play the track instantly or insert it at the beginning of the queue. If an audio file is attached to the message, GalaxyBot will attempt to play it.
| `playattachment [#] [channel]`  | Puts the latest audio file attachment sent in the channel in the queue. `#` can be used to determine which attachment should be played. Adding the `channel` parameter will search for an attachment in this particular channel.
| `yt <query>`                    | Search for a YouTube video or playlist and add it to the music player queue.
| `sc <query>`                    | Search for a SoundCloud track and add it to the music player queue.
| `undo [quantity\|all]`          | Removes the latest track you've requested. Specify `quantity` to remove a certain number of tracks, or `all` to remove all your requests.
| `now`                           | Shows what is currently being played.
| `next [me\|order]`              | Shows details of the next request in the queue. `me` shows your first upcoming request. `order` can tell which request is at specific position in the queue.
| `queue [me\|page]`              | Lists up to 10 upcoming entries in the music player queue. Specify `page` to browse a certain page of the queue. `me` can be used to list your upcoming requests.
| `skip`                          | Skips the currently played song. GalaxyBot managers can skip any song, while other users may skip it only if it's been requested by them.
| `stop`                          | Allows GalaxyBot managers to stop music playback and clear the queue.
| `pause`                         | Pauses the current track playback. The same command will resume the playback.
| `limit-access`                  | Shortcut to toggle the `limit-access` setting, which restricts the music player access to the GalaxyBot managers only.

## Settings
Available GalaxyBot settings, which server administrators can tweak to customize the bot behavior.

| Setting           | Type          | Default | Description |
|:-----------------:|:-------------:|:-------:| ----------- |
| `prefix`          | `char`        | `!`     | Character used to indicate commands.
| `roles`           | `snowflake[]` | `[]`    | Roles with permissions to manage the GalaxyBot settings and music player.
| `embed-mx`        | `bool`        | `true`  | Detect and send Mania Exchange links.
| `embed-titles`    | `bool`        | `true`  | Detect and send ManiaPlanet titles links.
| `embed-maps`      | `bool`        | `true`  | Detect and send ManiaPlanet maps links.
| `music-cmd-ch`    | `slowflake[]` | `[]`    | The only channels, where music player commands are accepted.
| `max-duration`    | `int`         | `1800`  | Maximum duration (in seconds) of music tracks users without full permissions can play. `0` = no limit.
| `limit-access`    | `bool`        | `false` | Disable music player commands for users without enough rights.
| `stalk-edits`     | `bool`        | `false` | Mock members for editing their messages.
| `enable-filter`   | `bool`        | `true`  | Enable or disable the words filtering feature of the GalaxyBot. Requires GalaxyBot to have the **Manage messages** permission in text channels for messages and roles filtering, as well as **Manage nicknames** for nicknames filtering.
| `filtered-words`  | `string[]`    | `[]`    | Remove messages, reactions and nicknames containing one (or more) of following words.
| `filter-admins`   | `bool`        | `false` | Whether the word filter should work on messages sent by administrators and GalaxyBot managers.
| `text-responses`  | `bool`        | `true`  | Let GalaxyBot react with some preprogrammed responses to messages.
| `mocking-joy`     | `bool`        | `true`  | Make fun of people, who tend to overuse the 😂 joy emoji.
| `servers-status`  | `snowflake`   | `null`  | Text channel, where GalaxyBot will post and update statuses of selected ManiaPlanet servers, added using the `addserver` command. Up to 10 latest messages sent in the channel will show a status below them.

Settings with array type require `add` and `remove` keywords, for example `!setings music-cmd-ch add #music-bot`.

## Screenshots

![Storm title card](https://i.imgur.com/Vf8J249.png)
![Music player](https://i.imgur.com/SCmZLUS.png)
![TrackMania channel](https://i.imgur.com/KwlzJwn.png)
![Mania Exchange map](https://i.imgur.com/2FIayqY.png)
![Servers status](https://i.imgur.com/FTZ7MXG.png)