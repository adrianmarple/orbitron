# How to make a new game

## TL:DR

- Copy `colorwar.py` and rename to your game's name.
- Edit this file to make a new game.
- Look to `engine.py` for reference.

## Understanding the Super Orbitron architecture

What you mainly need to understand is in engine.py. The engine works by running a core loop (each with a minimum 30fps frame time) where it calls the function `update()` every frame.

### The Game class

The first thing to be aware of is the `Game` class (still within engine.py). The engine has a global `current_game` (if it's none it choose a random one) and within the `update()` function it calls three relevant methods of this `Game` class:
 - `update()` this intended for changes of internal state within the game based on player input
 - `ontimeout()` which triggers whenever `current_game.end_time` has elapsed and is non-zero
 - `render()` which is intended as a function without mutation that writes information to the engine global `pixels`

Now the default `Game` in engine.py works by advancing a series of states: "start", "countdown", "play", "previctory", and "victory". After "victory" the game should quit itself and start a new game (this is handled in the default `Game`). You should continue to use this structure.

The default `update()` function is split in two based on this state: `start_update()` and `play_update()` (there should not be any player input during the other three states).

Similarly the `ontimeout()` function is split into five parts one for each state (`start_ontimeout()`, `countdown_ontimeout()`, `play_ontimeout()`, `previctory_ontimeout()`, `victory_ontimeout()`). The mostly likely of these that you'll want to alter is `countdown_ontimeout()` since this happens at the beginning of a match.

In order to make your own game you simply need to make a new python module (i.e. file) within the games folder (this one!). You should just copy colorwar.py as boilerplayer since it's the simplest game. Any game that is here will automatically get added to the Super Orbitron game rotation.

Here are the relevant fields that a game has:
 - `statuses`: A list of 420 entries representing the status of each pixel. Generally populated with strings. Defaults to all "blank"
 - `data`: An object with game-global information that needs to get sent to the controller.
 - `victor`: Player (or `Dummy` player) representing who won.
 - `players`: Pretty much what you'd expect. This list should never change once populated. If you want to reset the players do so to each player rather than repopulate the list.

And some helper methods attacted the base `Game` class:
 - `claimed_players()`: All players with `is_claimed` set to true.
 - `playing_players()`: All players with `is_playing` set to true.
 - `current_players()`: Same as `playing_players` unless `state` is "start" in which case it's the union of `playing_players` and  `claimed_players`.
 - `spawn(status)`: Adds a status (passed in as a parameter) to a random "blank" pixel that is not occupied by a player.
 - `clear()`: set all statuses to "blank"

### The Player class

The `Player` class (also defined in engine.py) is probably the most complex thing you'll have to understand and we'll likely be making changes to this to make it easier to use in the future.

The most important thing you'll have to understand is the function `move()`, which called during the default `start_update` and `play_update` functions for every player. Here is the code duplicated here for your convenience:
```
  def move(self):
    if self.cant_move():
      return

    new_pos = self.get_next_position()

    if not self.is_occupied(new_pos):
      self.ghost_positions.append(self.position)
      self.ghost_timestamps.append(time())
      self.prev_pos = self.position
      self.position = new_pos
      self.last_move_time = time()
```
You can ignore the stuff about ghosts, but the remaining functions are good to understand:
 - `cant_move()`: Is the player unable to move? (i.e. not enough time has passed, they aren't alive, or no controller movement has been registered recently)
 - `move_delay()`: How long the player must wait between moves, used in `cant_move()`.
 - `get_next_position()`: Based on controller movement, returns where would the player go next
 - `is_occupied(pos)`: Is a particular position invalid for the player to move to?

In order for your game to use a new class that inherits from player, you must call the `generate_players` function on a `Game` instance passing the class name as a parameter. E.g.
```
class Inkling(Player):
  def move(self):
    Player.move(self)
    game.statuses[self.position] = self

game = ColorWar()
game.generate_players(Inkling)
```
This function will generate the six player instances (a requirement for every Super Orbitron game) using the your new superclass and add each to the `player` field of that game.

Relevant `Player` fields:
 - `is_ready`: 
 - `is_claimed`: set to true when a player connects with a controller and gets assigned that player
 - `is_playing`: set to true when a player is claimed when a game starts
 - `is_alive`: used mainly for battle royale style games 
 - `color`: np.array with color. Do not change this.
 - `initial_position`: read only
 - `position`: current pixel index (see below)
 - `prev_position`: ...
 - `move_direction`: buffered input from controller
 - `last_move_input_time:`: timestamp of last move signal from controller
 - `tap`: timestamp of the last time the player tapped their controller. Set to `0` when tap is consumed
 - `score`: use this however you want, used by default to determine victor
 - `score_timestamp`: used to help break ties
 - `hit_time`: last time this player was damaged, used for iframes
 - `stunned`: probably don't use this

Other `Player` methods:
 - `occupies(pos)`: Is the player current on this pixel. Defaults to just checking if same as `self.position`
 - `reset()`: Everything that needs to get reset when a new round starts. Also called on initialization.
 - `set_ready()`: 
 - `set_unready()`: 
 - `setup_for_game()`: 

### Pixel Info

Information about pixels resides in a handful of data structures at the root level of engine.py. In particular note that while there are 480 LEDs, because LEDs overlap at vertices, there are only 420 uniqure coordinates. All positions and indices are based on these 420 unique coordinates. For instance `player.position` represents an index that is used for all the pixel info lists.

The pixel info you might need are:
 - `SIZE`: 420, the number of unique pixels.
 - `unique_coords`: A list of np.arrays with the 3D coordinates of each.
 - `unique_coord_matrix`: Same as `unique_coords`, but in matrix form.
 - `neightbors`: A list of lists each with the index of adjacent pixels. All of these list are of length 2 or 4.
 - `extended_neightbors`: Same as neighbors but pixels across the tip of a triangle also count as adjacent (they are the same distance). All of these list are of length 2, 3, or 4.
 - `next_pixel`: A map from tuples of adjacent pixels turned into strings (i.e. `(2,3)`) to next adjacent index that would come next in the series (i.e. `4`). This is used for continuous movement, like in snektron or kicked bombs.
 - `unique_antipodes`: A map from index to index of the complete opposite pixel.

Pixel info you should not need to know:
 - `RAW_Size`
 - `coordinates`
 - `coordinate_matrix`
 - `unique_to_dupes`
 - `dupes_to_unique`
 - `dupe_matrix`

### The Controller

A Super Orbitron controller is governed by the bloated (for now) `index.html`. You shouldn't need to change this much, but there is place to add rules and other pieces of copy. Note that config variables will automatically get placed in the settings page.
 - `name`: this should match the name of the python file (without the .py) you add to the games folder.
 - `label`: pretty straightforward, this is what is displayed when referencing this game.
 - `rules`: an array of objects each of which corresponds to a slide in the rules carosel for this game:
   - `image`: an large image (ideally a .gif) conveying some aspect of the rules
   - `words`: an array of strings each given its own paragraph
 - `tapInstruction`: don't include if your game doesn't use tap, otherwise a brief couple words for what tap does in your game
 - `victoryCondition`: this displays during countdown; should convey what it takes to win sussinctly
 - `statusDisplay`: how the game state is shown. Honestly this is pretty much bespoke for every game and you may have to alter the code elsewhere to get what you want
   - current options are: "rankedscore", "cooperativescore", and "battleroyale" 

### CONFIG

Addition configurations are added by passing an `additional_config` dictionary to your `Game`'s initializer. These are copied along with the global config and will be unique to that game an unaffected by identically named config variables in other games.

The contents of these dictionaries will be turned into attributes and so can be accessed with a `.` (e.g. as `game.MY_VAR` if `additional_config = {"MY_VAR": true}`).


## Other stuff your should know

### Command line args for server.js

- `-t`: no timeout. Controllers will not disconnect after 60 seconds nor when they loose focus and the normally do. Important for testing multiple controllers at once with one browser.
- `-g [game name]`: always choose this particular game first (presumably do this for the game you're creating)

### Audio

There are two arrys to import from `audio.py`, `sounds` and `music`. If you want to do something speical with `music` talk to Adrian or Mana first (the default behaviour is handled by the engine and this is subject to change in the near future). For SFX you have a bank of sounds to work from which you involve simply by calling the `play()` method on one of them (i.e. ). The full list is as follows:
- 'hurt': Use for conveying a negative state change.
- 'death': Basically as a stronger version of 'hurt'.
- 'kick': A low key sound used for simple feedback that something relatively neutral happened.
- 'explosion': Something happened that might negatively affect players.
- 'placeBomb': Use it if you feel like it.

### engine.py helper functions

 - `color_pixel`: Set a pixel to a specific color.
 - `add_color_to_pixel`: Name says it all.
 - `render_pulse`: Renders a pulse that spans the entire sphere (used for instance in the ready pulse, countdown, and explostion shockwaves)
 - `render_ring`: Renders a solid ring on the sphere (used in the victory sequence)

### Colors

The six colors used for the six players are fixed, but there are two colors dedicated to other meaningful things within your game:
 - Red (#f00): For bad things (e.g. PacMan ghosts, death creep, etc.)
 - Magenta (#f0f): For good things (e.g. scared ghosts, pickups, etc.)
Everything else should be grayscale.

### Final thoughts

If you have any recommendations (for little things or large architectual changes alike) contact Adrian Marple (Marplebot#4158 on discord) or make a pull request.

Thanks!
