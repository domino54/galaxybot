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

### Music player
* `!play <url|query> [now|next]` - Connects to a voice channel and plays audio from given link. If something different than URL is given, bot will search YouTube and play first result.
* `!undo` - Removes latest track added by the user.
* `!now` - Shows what is currently being played.
* `!next [me|order]` - Shows name of the next track in the queue. `me` shows upcoming song requested by the user. `order` can tell what song is at specific queue position.
* `!queue` - Lists up to 10 first entries in the queue.
* `!skip` - Skips currently played song. Administrators can skip any song, while other users may skip it only it it's been requested by them.
* `!stop` - Allows administrators to stop music playback and clear the queue.

### ManiaPlanet
* `!servers [galaxy|pursuit|stadium]` - Listing up to 10 most populated servers of a specific ManiaPlanet title.
