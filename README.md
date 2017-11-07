GalaxyBot
=========
A Discord bot capable of playing some music and doing other stuff. Pretty cute, too.

## Commands
All available commands of the GalaxyBot. `!command <mandatory> [optional]`

### General
* `!dommy` - Mentions [Dommy](https://github.com/domino54/) with a thinking gif. 🤔
* `!git` - Paste link to this repository.
* `!invite` - Sends link allowing users to add the bot to their server.
* `!guilds` - Lists all servers the bot is currently in.
* `!avatar [name]` - Sends you direct link to your or someone's avatar.
* `!setting [name] <value>` - Manage bot settings in the server. See settings list below for more information.

### Music player
Supported platforms are: YouTube, Facebook, Streamable.

* `!play <url|query> [now|next]` - Connects to a voice channel and plays audio from given link. If something different than URL is given, bot will search YouTube and play first result. `now` and `next` allow administrators to play the track instantly or insert it at the beginning of the queue.
* `!undo` - Removes latest track added by the user.
* `!now` - Shows what is currently being played.
* `!next [me|order]` - Shows name of the next track in the queue. `me` shows upcoming song requested by the user. `order` can tell what song is at specific queue position.
* `!queue` - Lists up to 10 first entries in the queue.
* `!skip` - Skips currently played song. Administrators can skip any song, while other users may skip it only it it's been requested by them.
* `!stop` - Allows administrators to stop music playback and clear the queue.

### ManiaPlanet
Bot automatically reacts to ManiaPlanet titles and maps links, as well as Mania Exchange maps links.

* `!channel <sm|tm>` - See what's currently being played on channels.
* `!servers <id|code>` - Listing up to 10 most populated servers of a specific ManiaPlanet title.
* `!title <id|code>` - Shows information about given title from ManiaPlanet website.
* `!map <uid>` - Shows information about given map from ManiaPlanet website.
* `!mx <tm|sm> <id|query>` - Search for Mania Exchange map by ID or map name.

Instead of using title `id` in commands you can use cone of following short codes: canyon, storm, stadium, valley, lagoon, galaxy, pursuit, pursuit-s, royal, siege, battle, elite, combo, joust, warlords, heroes, tm2, competition, rpg, obstacle, stormuim, infection, speedball, alpine.

## Settings
Available bot settings, which server administrators can tweak to customize bot behavior.

* `prefix` - Character used to indicate commands.
* `embed-mx` - Detect and send Mania Exchange links.
* `embed-titles` - Detect and send ManiaPlanet titles links.
* `embed-maps` - Detect and send ManiaPlanet maps links.
* `roles` - Manage roles with permissions to manage GalaxyBot.
* `max-duration` - Maximum duration (in seconds) of music tracks users without full permissions can play. `0` = no limit.

## Screenshots

![Lagoon title card](https://i.imgur.com/7XQVvuE.png)
![Music player](https://i.imgur.com/SuogF37.png)
![ShootMania channel](https://i.imgur.com/u9tNQyU.png)
![Mania Exchange map](https://i.imgur.com/6sLhjAD.png)