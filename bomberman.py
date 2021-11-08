#!/usr/bin/env python

import numpy as np
import numbers

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random
from time import time, sleep

from audio import sounds, prewarm_audio
import engine
from engine import *


config["BOMB_FUSE_TIME"] = 3
config["BOMB_EXPLOSION_TIME"] = 0.9 # Should be less than INVUNERABILITY_TIME
config["STARTING_BOMB_POWER"] = 4 # 2
config["PICKUP_CHANCE"] = 0 # 0.3
config["NUM_WALLS"] = 60
config["BOMB_MOVE_FREQ"] = 0.07
config["USE_SHIELDS"] = False
config["DEATHMATCH"] = True
config["TARGET_KILL_COUNT"] = 5
config["BATTLE_ROYALE_DURATION"] = 150
config["DEATH_CREEP_DURATION"] = 60
config["SUICIDE_STUN"] = True



explosion_providence = [None] * SIZE
secondary_explosion_providence = [None] * SIZE

battle_channel = None
vamp = None

prewarm_audio(sound_file_names=[
    "battle1.ogg", "battle1Loop.ogg", "dm1.ogg", "dm1Loop.ogg", "explosion.wav",
    "kick.wav", "placeBomb.wav", "hurt.wav", "death.wav", "victory.mp3", "waiting.ogg",
  ], start_loop="waiting")



def bomberman_start():
  Bomberman(
    position=105,
    color=(0, 200, 0),
    team_color=(220, 30, 0),
    color_string="#4caf50") #green
  Bomberman(
    position=198,
    color=(1, 12, 200),
    team_color=(0, 0, 250),
    color_string="#1e88e5") #blue
  Bomberman(
    position=24,
    color=(200, 2, 20),
    team_color=(250, 20, 10),
    color_string="#e91e63") #pink
  Bomberman(
    position=54,
    color=(100, 0, 250),
    team_color=(50, 0, 150),
    color_string="#9575cd") #deep purple
  Bomberman(
    position=252,
    color=(180, 200, 5),
    team_color=(200, 70, 0),
    color_string="#c0ca33") #lime
  Bomberman(
    position=168,
    color=(200, 50, 0),
    team_color=(0, 120, 120),
    color_string="#ff9800") #orange

  global RED_TEAM, BLUE_TEAM

  RED_TEAM = Team(
    team_id=0,
    color=np.array((220, 30, 0)),
    color_string="orange",
    name="Orange Team",
    players=[players[0], players[2], players[4]]
  )
  BLUE_TEAM = Team(
    team_id=1,
    color=np.array((0, 0, 255)),
    color_string="blue",
    name="Blue Team",
    players=[players[1], players[3], players[5]]
  )
  teams.append(RED_TEAM)
  teams.append(BLUE_TEAM)


def start_update():
  for player in claimed_players():
    if not player.is_ready:
      player.move()

  if engine.state_end_time == 0 and is_everyone_ready(minimum=2):
    for player in claimed_players():
      player.is_playing = True
      player.has_shield = config["USE_SHIELDS"]
      player.bomb_power = config["STARTING_BOMB_POWER"]

    clear()
    for i in range(config["NUM_WALLS"]):
      pos = randrange(SIZE)
      bad_spot = pos in START_POSITIONS
      for start_pos in START_POSITIONS:
        bad_spot = bad_spot or pos in neighbors[start_pos]

      if not bad_spot:
        statuses[pos] = "wall"
    engine.state_end_time = time() + 4
    broadcast_state()
    sounds["waiting"].fadeout(4000)


def play_update():
  if battle_channel.get_queue() is None:
    battle_channel.queue(vamp)

  for player in playing_players():
    player.move()

  if config["DEATHMATCH"]:
    if config["TEAM_MODE"]:
      if BLUE_TEAM.kill_count() >= config["TARGET_KILL_COUNT"]:
        gameover(BLUE_TEAM)
      if RED_TEAM.kill_count() >= config["TARGET_KILL_COUNT"]:
        gameover(RED_TEAM)
    else:
      for player in playing_players():
        if player.kill_count >= config["TARGET_KILL_COUNT"]:
          gameover(player)
          break
  else:
    # Timer death creep from south pole
    phase = (engine.state_end_time - time()) / config["DEATH_CREEP_DURATION"]
    threshold = COORD_MAGNITUDE * (1 - 2 * phase)
    threshold = min(threshold, COORD_MAGNITUDE * 0.8)
    for i in range(SIZE):
      z = unique_coords[i][2]
      if z < threshold:
        statuses[i] = "death"
        explosion_providence[i] = None


    if config["TEAM_MODE"]:
      if not BLUE_TEAM.is_alive():
        gameover(RED_TEAM)
      if not RED_TEAM.is_alive():
        gameover(BLUE_TEAM)
    else:
      live_player_count = 0
      last_player_alive = players[0]
      for player in playing_players():
        if player.is_alive:
          live_player_count += 1

        if player.is_alive or (not last_player_alive.is_alive and
            player.hit_time > last_player_alive.hit_time):
          last_player_alive = player

      # GAME OVER
      if live_player_count <= 1:
        gameover(last_player_alive)



def start_ontimeout():
  global battle_channel, vamp
  engine.game_state = play_state
  engine.state_end_time = time() + config["BATTLE_ROYALE_DURATION"]

  if config["DEATHMATCH"]:
    battle_channel = sounds["dm1"].play()
    vamp = sounds["dm1Loop"]
  else:
    battle_channel = sounds["battle1"].play()
    vamp = sounds["battle1Loop"]

def previctory_ontimeout():
  engine.game_state = victory_state
  engine.state_end_time = time() + 10
  sounds["victory"].play()

  clear()
  for player in players:
    player.reset()

def victory_ontimeout():
  engine.game_state = start_state
  engine.state_end_time = 0
  sounds["victory"].fadeout(1000)
  sounds["waiting"].play(loops=-1, fade_ms=2000)



def render_sandbox():
  if engine.state_end_time > 0:
    countdown = ceil(engine.state_end_time - time())
    countup = 5 - countdown
    render_pulse(
      direction=(0,0,COORD_MAGNITUDE),
      color=np.array((60,60,60)) * countup,
      start_time=engine.state_end_time - countdown,
      duration=READY_PULSE_DURATION)

  for i in range(SIZE):
    if isinstance(statuses[i], float):
      if statuses[i] < time():
        statuses[i] = "blank"
      else:
        render_explosion(i)

  for player in claimed_players():
    if player.is_ready:
      player.render_ready()
    else:
      player.render()

def render_game():
  for player in playing_players():
    player.render_ghost_trail()

  for i in range(SIZE):
    if statuses[i] == "blank":
      # already handled
      pass
    elif statuses[i] == "death":
      color_pixel(i, (10, 0, 0))
    elif statuses[i] == "wall":
      color_pixel(i, (11, 9, 9))
    elif statuses[i] == "power_pickup":
      magnitude = 0.3 + 0.1 * sin(40*time() + i)
      magnitude = magnitude * magnitude
      color_pixel(i, np.array((180,100,140)) * magnitude)
    elif statuses[i] < time():
      statuses[i] = "blank"
      color_pixel(i, (0, 0, 0))
    else:
      render_explosion(i)

  for player in playing_players():
    player.render()



start_state = State("start", start_update, start_ontimeout, render_sandbox)
play_state = State("play", play_update, None, render_game)
previctory_state = State("previctory", None, previctory_ontimeout, render_game)
victory_state = State("victory", start_update, victory_ontimeout, render_victory)




def render_explosion(index):
  x = 1 + (time() - statuses[index]) / config["BOMB_EXPLOSION_TIME"]
  if (x >= 0):
    sequence = explosion_providence[index].current_color_sequence()
    x *= len(sequence) - 1
    color_pixel(index, multi_lerp(x, sequence))


def is_pixel_blank(index):
  status = statuses[index]
  return status == "blank" or (
      isinstance(status, numbers.Number) and status - time() > config["BOMB_EXPLOSION_TIME"])


def gameover(winner):
  engine.game_state = previctory_state
  engine.state_end_time = time() + 2
  engine.victory_color = winner.color
  engine.victory_color_string = winner.color_string
  battle_channel.stop()
  broadcast_state()


# ================================ TEAM =========================================

# TODO inherit from engine.Team
class Team:
  def __init__(self, team_id, color, color_string, name, players):
    self.id = team_id
    self.color = color
    self.color_string = color_string
    self.name = name
    self.players = players
    for player in players:
      player.team = self

  def kill_count(self):
    count = 0
    for player in self.players:
      count += player.kill_count
    return count

  def death_count(self):
    count = 0
    for player in self.players:
      count += player.death_count
    return count

  def is_alive(self):
    for player in self.players:
      if player.is_playing and player.is_alive:
        return True
    return False


  def to_json(self):
    return {
      "id": self.id,
      "color": self.color_string,
      "killCount": self.kill_count(),
      "deathCount": self.death_count(),
      "players": [player.id for player in self.players],
    }

# ================================ PLAYER =========================================

class Bomberman(Player):
  def __init__(self, *args, **kwargs):
    Player.__init__(self, *args, **kwargs)

    self.explosion_color_sequence = [
      (0, self.color),
      (1, self.color/3),
      (1, np.array((40,0,0))),
      (1, np.array((10,0,0))),
    ]
    self.explosion_color_sequence_team = [
      (0, self.team_color),
      (1, self.team_color/3),
      (1, np.array((40,0,0))),
      (1, np.array((10,0,0))),
    ]


  def reset(self):
    self.bombs = []
    self.bomb_power = config["STARTING_BOMB_POWER"]
    self.kill_count = 0
    self.death_count = 0
    self.has_shield = config["USE_SHIELDS"]
    Player.reset(self)

  def set_ready(self):
    self.bombs = []
    Player.set_ready(self)

  def current_color_sequence(self):
    return self.explosion_color_sequence_team if config["TEAM_MODE"] else self.explosion_color_sequence

  def is_occupied(self, position):
    if Player.is_occupied(self, position):
      return True

    considered_players = claimed_players() if engine.game_state == start_state else playing_players()
    for player in considered_players:
      for bomb in player.bombs:
        if bomb.position == position:
          if bomb.move(self.position):
            # Successful bomb kick!
            sounds["kick"].play()
            # Transfer owenership on bomb kick
            bomb.bump_owner(self)
          else:
            return True

    return False

  def move(self):
    pos = self.position

    # resolve existing bombs
    for bomb in self.bombs.copy():
      bomb.resolve()

      if bomb.has_exploded and time() - bomb.explosion_time > SHOCKWAVE_DURATION:
        self.bombs.remove(bomb)



    # non-blank status means either explosion or death
    if engine.game_state == play_state and not is_pixel_blank(pos) and \
        time() - self.hit_time > config["INVULNERABILITY_TIME"]:

      # Hurt
      if statuses[pos] != "death" and self.has_shield:
        sounds["hurt"].play()
        self.has_shield = False
      else:
        killer = explosion_providence[pos]
        if killer != self:
          if killer.team != self.team or not config["TEAM_MODE"]:
            killer.kill_count += 1
        else: # Suicide
          if config["SUICIDE_STUN"]:
            self.stunned = True
          else:
            self.kill_count -= 1

        self.death_count += 1

        if config["DEATHMATCH"]:
          sounds["hurt"].play()
          pass
        else:
          sounds["death"].play()
          self.is_alive = False

      self.hit_time = time()
      broadcast_state()


    # Try to place bomb if tapped
    tap = self.tap
    self.tap = 0 # consume tap signal
    can_place_bomb = self.is_alive and not self.stunned
    for bomb in self.bombs:
      if pos == bomb.position:
        can_place_bomb = False
    if can_place_bomb and time() - tap < 0.1:
      sounds["placeBomb"].play()
      self.bombs.append(Bomb(self))


    Player.move(self)
    # self.position is likely to have updated

    # Player clears away explosions when walking on them
    if not is_pixel_blank(self.position):
      statuses[pos] = "blank"
    if statuses[self.position] == "power_pickup":
      self.bomb_power += 1
      statuses[self.position] = "blank"


  def render(self):
    color = self.current_color()
    for bomb in self.bombs:
      bomb_factor = bomb.render()
      if bomb.position == self.position:
        color = color * (0.1 + bomb_factor * 1.2)

    if config["USE_SHIELDS"] and not self.has_shield:
      color = color / 12;

    flash_time = config["STUN_TIME"] if self.stunned else config["INVULNERABILITY_TIME"]
    if time() - self.hit_time < flash_time:
      factor = (time() * 2) % 1
      if self.stunned:
        factor = 1 - factor
        factor *= 0.7
      else:
        factor *= 1.3
      color = color * factor * factor

    if self.is_alive:
      color_pixel(self.position, color)


  def to_json(self):
    # TODO use base class to_json
    return {
      "isClaimed": self.is_claimed,
      "isReady": self.is_ready,
      "isPlaying": self.is_playing,
      "isAlive": self.is_alive,
      "color": self.color_string,
      "position": self.position,
      "bombPower": self.bomb_power,
      "killCount": self.kill_count,
      "deathCount": self.death_count,
      "team": self.team.id,
    }



# ================================ BOMB =========================================
BOMB_COLOR_SEQUENCE = [
  (0, np.array((20,0,160))),
  (1, np.array((20,80,80))),
  (1, np.array((20,200,0))),
  (1, np.array((180,100,0))),
  (1, np.array((255,10,10))),
  (1, np.array((180,0,80))),
  (1, np.array((20,0,160))),
]
EXPLOSION_COLOR_SEQUENCE = [
  (0, np.array((0,0,255))),
  (1, np.array((0,100,200))),
  (1, np.array((150,100,0))),
  (1, np.array((200,50,0))),
  (1, np.array((255,0,0))),
  (1, np.array((120,0,0))),
  (1, np.array((40,0,0))),
  (1, np.array((10,0,0))),
]


class Bomb:

  def __init__(self, player):
    self.owner = player
    self.secondary_owner = None
    self.position = player.position
    self.prev_pos = player.position
    self.last_move_time = time()
    self.timestamp = time()
    self.power = player.bomb_power
    self.has_exploded = False
    self.explosion_time = 0

  def move(self, prev_pos):
    new_pos = next_pixel.get(str((prev_pos, self.position)), None)
    if new_pos is None:
      return

    occupied = statuses[new_pos] == "wall"
    
    considered_players = playing_players() if engine.game_state == play_state else claimed_players()
    for player in considered_players:
      if not player.is_alive:
        continue

      if player.position == new_pos:
        occupied = True
        break

      for bomb in player.bombs:
        if bomb.position == new_pos:
          occupied = True
          break

      if occupied:
        break

    self.prev_pos = self.position
    if not occupied:
      self.position = new_pos
      self.last_move_time = time()

    return not occupied


  def render(self):
    if self.has_exploded:
      render_pulse(
        direction=-unique_coords[self.position],
        color=(16, 16, 16),
        start_time=self.explosion_time,
        duration=SHOCKWAVE_DURATION)
      return 0

    x = config["BOMB_FUSE_TIME"] + self.timestamp - time()
    x += 4
    x = (300 / x)
    factor = (sin(x)+1.05) * 0.3
    factor *= factor
    color = self.owner.current_color() * factor
    color_pixel(self.position, color)
    return factor

  def resolve(self):
    if self.has_exploded:
      return

    if self.position != self.prev_pos and time() - self.last_move_time > config["BOMB_MOVE_FREQ"]:
      self.move(self.prev_pos)

    # Fuse has run out or hit by an explosion
    if time() - self.timestamp >= config["BOMB_FUSE_TIME"] or not is_pixel_blank(self.position):
      # Propagate ownership if triggered by other bomb
      #if not is_pixel_blank(self.position) and statuses[self.position] != "death":
      #  self.bump_owner(explosion_providence[self.position])

      sounds["explosion"].play()
      finish_time = time() + config["BOMB_EXPLOSION_TIME"]

      self.set_explosion_status(self.position, finish_time)
      for neighbor in neighbors[self.position]:
        self.explode((self.position, neighbor), self.power)

      self.has_exploded = True
      self.explosion_time = time()

  def bump_owner(self, new_owner):
    if new_owner and self.owner != new_owner:
      self.secondary_owner = self.owner
      self.owner = new_owner

  def explode(self, direction, power):
    for i in range(power):
      next_pos = direction[1]

      if statuses[next_pos] == "wall":
        if random() < config["PICKUP_CHANCE"]:
          statuses[next_pos] = "power_pickup"
        else:
          statuses[next_pos] = "blank"
        return

      finish_time = time() + config["BOMB_EXPLOSION_TIME"] + i/32
      self.set_explosion_status(next_pos, finish_time)
      direction = (next_pos, next_pixel[str(direction)])

  def set_explosion_status(self, pos, finish_time):
    statuses[pos] = finish_time
    explosion_providence[pos] = self.owner
    secondary_explosion_providence[pos] = self.secondary_owner



# ================================ Actual Start =========================================

start(bomberman_start, start_state)
