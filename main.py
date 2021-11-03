#!/usr/bin/env python

import asyncio
import board
import collections
import json
import neopixel
import numpy as np
import numbers
import pathlib
import socket
import ssl
import subprocess
import urllib.request
import websockets

from math import exp, ceil, floor, pi, cos, sin, sqrt
from pygame import mixer  # https://www.pygame.org/docs/ref/mixer.html
from random import randrange, random
from threading import Thread
from time import time, sleep



class ChannelShell:
  def stop(self):
    pass
  def get_queue(self):
    pass
  def queue(self, sound):
    pass

class SoundShell:
  def play(self, loops=0, fade_ms=0):
    return ChannelShell()
  def stop(self):
    pass
  def fadeout(self, duration):
    pass

battle_music = SoundShell()
battle_vamp = SoundShell()
deathmatch_music = SoundShell()
deathmatch_vamp = SoundShell()
battle_channel = None
vamp = None

explosion_sound = SoundShell()
kick_sound = SoundShell()
place_bomb_sound = SoundShell()
hurt_sound = SoundShell()
death_sound = SoundShell()

victory_music = SoundShell()
waiting_music = SoundShell()


def prewarm_audio():
  global battle_music, battle_vamp, deathmatch_music, deathmatch_vamp
  global explosion_sound, kick_sound, place_bomb_sound, hurt_sound, death_sound
  global victory_music, waiting_music

  mixer.init(devicename="USB Audio Device, USB Audio")

  MUSIC_DIRECTORY = "/home/pi/Rhomberman/audio/"

  battle_music = mixer.Sound(MUSIC_DIRECTORY + "battle1.ogg")
  battle_vamp = mixer.Sound(MUSIC_DIRECTORY + "battle1Loop.ogg")
  deathmatch_music = mixer.Sound(MUSIC_DIRECTORY + "dm1.ogg")
  deathmatch_vamp = mixer.Sound(MUSIC_DIRECTORY + "dm1Loop.ogg")

  explosion_sound = mixer.Sound(MUSIC_DIRECTORY + "explosion.wav")
  kick_sound = mixer.Sound(MUSIC_DIRECTORY + "kick.wav")
  place_bomb_sound = mixer.Sound(MUSIC_DIRECTORY + "placeBomb.wav")
  hurt_sound = mixer.Sound(MUSIC_DIRECTORY + "hurt.wav")
  death_sound = mixer.Sound(MUSIC_DIRECTORY + "death.wav")

  victory_music = mixer.Sound(MUSIC_DIRECTORY + "ff7-victory-fanfare.mp3")
  waiting_music = mixer.Sound(MUSIC_DIRECTORY + "waiting.ogg")
  waiting_music.play(loops=-1)

  print("Finished prewarming audio.")


prewarm_thread = Thread(target=prewarm_audio)
prewarm_thread.start()


# Actual constants
COORD_MAGNITUDE = 4.46590101883
COORD_SQ_MAGNITUDE = 19.94427190999916

config = {
  "BOMB_FUSE_TIME": 3,
  "BOMB_EXPLOSION_TIME": 0.9,
  "INVULNERABILITY_TIME": 2, # Should be greater than BOMB_EXPLOSION_TIME
  "STARTING_BOMB_POWER": 4, # 2,
  "PICKUP_CHANCE": 0, # 0.3,
  "NUM_WALLS": 60,
  "MAX_BOMBS": 8,
  "BOMB_MOVE_FREQ": 0.07,
  "MOVE_FREQ": 0.18,
  "USE_SHIELDS": True,
  "DEATHMATCH": True,
  "ALLOW_CROSS_TIP_MOVE": False,
  "TARGET_KILL_COUNT": 5,
  "BATTLE_ROYALE_DURATION": 150,
  "DEATH_CREEP_DURATION": 60,
  "MOVE_BIAS": 0.5,
  "SUICIDE_PENALTY": True,
  "TEAM_MODE": True,
  "STUN_TIME": 5,
}

READY_PULSE_DURATION = 0.75
SHOCKWAVE_DURATION = 0.5


f = open("/home/pi/Rhomberman/pixels.json", "r")
pixel_info = json.loads(f.read())
f.close()
SIZE = pixel_info["SIZE"]
RAW_SIZE = pixel_info["RAW_SIZE"]
neighbors = pixel_info["neighbors"]
expanded_neighbors = pixel_info["expanded_neighbors"]
next_pixel = pixel_info["next_pixel"]
coordinates = [np.array(coord) for coord in pixel_info["coordinates"]]
coordinate_matrix = np.matrix(coordinates).transpose()
unique_coords = [np.array(coord) for coord in pixel_info["unique_coords"]]
unique_coord_matrix = np.matrix(unique_coords).transpose()
unique_to_dupes = pixel_info["unique_to_dupes"]
dupe_to_unique = [0] * RAW_SIZE

pixels = np.zeros((SIZE, 3))
raw_pixels = np.zeros((RAW_SIZE, 3))
dupe_matrix = np.zeros((RAW_SIZE, SIZE))
for (i, dupes) in enumerate(unique_to_dupes):
  for dupe in dupes:
    dupe_to_unique[dupe] = i
    dupe_matrix[dupe, i] = 1

neopixels = neopixel.NeoPixel(board.D18, RAW_SIZE, auto_write=False)
print("Running %s pixels" % pixel_info["RAW_SIZE"])

START_POSITIONS = [54, 105, 198, 24, 125, 179, 168, 252]
statuses = ["blank"] * SIZE
explosion_providence = [None] * SIZE
secondary_explosion_providence = [None] * SIZE

game_state = "start"
state_end_time = 0
victory_color = None
victory_color_string = None


players = []
teams = []

def start():
  players.append(Player(
    position=105,
    color=(0, 200, 0),
    team_color=(220, 30, 0),
    color_string="#4caf50")) #green
  players.append(Player(
    position=198,
    color=(1, 12, 200),
    team_color=(0, 0, 250),
    color_string="#1e88e5")) #blue
  players.append(Player(
    position=24,
    color=(200, 2, 20),
    team_color=(200, 2, 20),
    color_string="#e91e63")) #pink
  players.append(Player(
    position=54,
    color=(100, 0, 250),
    team_color=(70, 0, 150),
    color_string="#9575cd")) #deep purple
  players.append(Player(
    position=252,
    color=(180, 200, 5),
    team_color=(250, 2, 0),
    color_string="#c0ca33")) #lime
  players.append(Player(
    position=168,
    color=(200, 50, 0),
    team_color=(0, 120, 120),
    color_string="#ff9800")) #orange
  # players.append(Player(
  #   position=179,
  #   color=(100, 100, 255),
  #   color_string="#ddddff")) #bluewhite
  # players.append(Player(
  #   position=125,
  #   color=(0, 200, 100),
  #   color_string="#00bcd4")) #cyan

  global RED_TEAM, BLUE_TEAM

  RED_TEAM = Team(
    team_id=0,
    color=np.array((255, 0, 0)),
    color_string="red",
    name="Red Team",
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



# ================================ UPDATE =========================================


def update():
  global game_state, state_end_time
  global victory_color, victory_color_string
  global pixels

  global vamp, battle_channel


  if game_state == "start":
    claimed = claimed_players()
    for player in claimed:
      if not player.is_ready:
        # sandbox mode
        player.bomb()
        player.move()

    is_everyone_ready = True
    if len(claimed) <= 1:
      is_everyone_ready = False

    for player in claimed:
      is_everyone_ready = is_everyone_ready and player.is_ready

    if is_everyone_ready and state_end_time == 0:
      for player in claimed:
        player.is_playing = True
        player.has_shield = config["USE_SHIELDS"]
        player.bomb_power = config["STARTING_BOMB_POWER"]
      set_walls()
      state_end_time = time() + 4
      broadcast_state()
      waiting_music.fadeout(4000)

  elif game_state == "play":
    if battle_channel.get_queue() is None:
      battle_channel.queue(vamp)

    for player in playing_players():
      player.bomb()
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
      phase = (state_end_time - time()) / config["DEATH_CREEP_DURATION"]
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
              player.bomb_hit_time > last_player_alive.bomb_hit_time):
            last_player_alive = player

        # GAME OVER
        if live_player_count <= 1:
          gameover(last_player_alive)




  if state_end_time <= time() and state_end_time > 0:
    if game_state == "victory":
      game_state = "start"
      state_end_time = 0
      victory_music.fadeout(1000)
      waiting_music.play(loops=-1, fade_ms=2000)
    elif game_state == "start":
      game_state = "play"
      state_end_time = time() + config["BATTLE_ROYALE_DURATION"]

      if config["DEATHMATCH"]:
        battle_channel = deathmatch_music.play()
        vamp = deathmatch_vamp
      else:
        battle_channel = battle_music.play()
        vamp = battle_vamp
    elif game_state == "previctory":
      game_state = "victory"
      state_end_time = time() + 10
      victory_music.play()

      clear_walls()
      for player in players:
        player.reset()

    
    broadcast_state()

  # For countdown on phone
  remaining_time = state_end_time - time()
  if game_state == "start" and remaining_time > 0 and remaining_time % 1 < 0.05:
    broadcast_state()

  # Render
  if game_state == "start" and len(claimed_players()) == 0:
    render_snake()
    return

  pixels *= 0
  if game_state == "start":
    render_sandbox()
  elif game_state == "victory":
    render_victory()
  else:
    render_game()

  pixels = np.minimum(pixels, 255)
  pixels = np.maximum(pixels, 0)
  for i in range(RAW_SIZE):
    neopixels[i] = pixels[dupe_to_unique[i]]
  neopixels.show()


def gameover(winner):
  global game_state, state_end_time, victory_color, victory_color_string, battle_channel

  game_state = "previctory"
  state_end_time = time() + 2
  victory_color = winner.color
  victory_color_string = winner.color_string
  battle_channel.stop()
  broadcast_state()



indicies = np.arange(RAW_SIZE)

def render_snake():
  global raw_pixels

  phases = indicies / 40 + time()/2
  phases = np.minimum(1, np.mod(phases, 6))
  phases = np.sin(pi * phases) * 50
  raw_pixels = np.outer(phases, np.ones((1, 3)))

  for i in range(RAW_SIZE):
    neopixels[i] = raw_pixels[i]
  neopixels.show()

def render_sandbox():
  # TODO add timer pulses

  if state_end_time > 0:
    countdown = ceil(state_end_time - time())
    countup = 5 - countdown
    render_pulse(
      direction=(0,0,COORD_MAGNITUDE),
      color=np.array((20,20,20)) * countup*countup,
      start_time=state_end_time - countdown,
      duration=READY_PULSE_DURATION)


  for i in range(SIZE):
    if isinstance(statuses[i], float):
      if statuses[i] < time():
        statuses[i] = "blank"
      else:
        render_explosion(i)

  for player in claimed_players():
    player.render_ready()



def render_victory():
  for (i, coord) in enumerate(unique_coords):
    color_pixel(i, victory_color * sin(coord[2] - 4*time()))


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
    player.render_player()

def render_explosion(index):
  x = 1 + (time() - statuses[index]) / config["BOMB_EXPLOSION_TIME"]
  if (x >= 0):
    sequence = explosion_providence[index].current_color_sequence()
    x *= len(sequence) - 1
    color_pixel(index, multi_lerp(x, sequence))

def render_pulse(direction=np.array((COORD_MAGNITUDE,0,0)),
    color=(200,200,200), start_time=0, duration=1):

  global pixels
  t = (time() - start_time) / duration
  if (t < 1):
    ds = direction * unique_coord_matrix / COORD_SQ_MAGNITUDE / 2 + 0.5
    ds = ds * 6 - (t * 8 - 1)
    ds = np.maximum(0, np.multiply(ds, (ds - 1)) / -3)
    pixels += np.outer(ds, color)

# ================================ MISC =========================================

def claimed_players():
  return [player for player in players if player.is_claimed]
def playing_players():
  return [player for player in players if player.is_playing]

def color_pixel(index, color):
  pixels[index] = color

def is_pixel_blank(index):
  status = statuses[index]
  return status == "blank" or (
    isinstance(status, numbers.Number) and status - time() > config["BOMB_EXPLOSION_TIME"])

def color_raw_pixel(index, color):
  raw_pixels[index] = color

def add_color_to_pixel(index, color):
  for dupe in unique_to_dupes[index]:
    pixels[dupe] = (
      max(0, min(255, pixels[dupe][0] + int(color[0]))),
      max(0, min(255, pixels[dupe][1] + int(color[1]))),
      max(0, min(255, pixels[dupe][2] + int(color[2]))))

def multi_lerp(x, control_points):
  if x < 0:
    return control_points[0][1]

  index = 1
  prev_v = control_points[0][1]
  while index < len(control_points):
    max_x = control_points[index][0]
    next_v = control_points[index][1]
    if x > max_x:
      x -= max_x
      prev_v = next_v
      index += 1
      continue

    alpha = x / max_x
    return alpha * next_v + (1-alpha) * prev_v

  return control_points[index - 1][1]

def latlong_delta(ll0, ll1):
  delta = [ll0[0] - ll1[0], ll0[1] - ll1[1]]
  if delta[0] > pi:
    delta[0] -= 2*pi
  if delta[1] > pi:
    delta[1] -= 2*pi
  if delta[0] < -pi:
    delta[0] += 2*pi
  if delta[1] < -pi:
    delta[1] += 2*pi
  return delta

def projection(u, v): # assume v is normalized
  return v * np.dot(u,v)

def ortho_proj(u, v):
  return u - projection(u,v)


def set_walls():
  global statuses
  statuses = ["blank"] * SIZE
  for i in range(config["NUM_WALLS"]):
    pos = randrange(SIZE)
    bad_spot = pos in START_POSITIONS
    for start_pos in START_POSITIONS:
      bad_spot = bad_spot or pos in neighbors[start_pos]

    if not bad_spot:
      statuses[pos] = "wall"

def clear_walls():
  global statuses
  statuses = ["blank"] * SIZE

# ================================ TEAM =========================================

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
GHOST_BUFFER_LEN = 20

class Player:
  def __init__(self, position, color, team_color, color_string):
    self.id = len(players)  # WARNING not super robust
    self.initial_position = position
    self.color = np.array(color)
    self.team_color = np.array(team_color)
    self.color_string = color_string
    self.last_move_time = 0
    self.ready_time = 0
    self.is_claimed = False
    self.is_playing = False
    self.move_direction = np.array((0, 0))
    self.prev_pos = 0
    self.tap = 0
    self.websocket = None
    self.kill_count = 0
    self.death_count = 0
    self.stunned = False
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


    self.ghost_positions = collections.deque(maxlen=GHOST_BUFFER_LEN)
    self.ghost_timestamps = collections.deque(maxlen=GHOST_BUFFER_LEN)
    for i in range(GHOST_BUFFER_LEN):
      self.ghost_positions.append(0)
      self.ghost_timestamps.append(0)

    self.reset()

  def reset(self):
    self.is_ready = False
    self.is_alive = True
    self.has_shield = config["USE_SHIELDS"]
    self.is_playing = False
    self.bomb_hit_time = 0
    self.position = self.initial_position
    self.prev_pos = self.position
    self.bombs = []
    self.bomb_power = config["STARTING_BOMB_POWER"]
    self.kill_count = 0
    self.death_count = 0

  def set_ready(self):
    self.position = self.initial_position
    self.bombs = []
    self.is_ready = True
    self.ready_time = time()
    broadcast_state()

  def set_unready(self):
    self.is_ready = False
    self.tap = 0
    broadcast_state()

  def current_color(self):
    return self.team_color if config["TEAM_MODE"] else self.color

  def current_color_sequence(self):
    return self.explosion_color_sequence_team if config["TEAM_MODE"] else self.explosion_color_sequence

  def pulse(self):
    self.ready_time = time()
    broadcast_state()

  def move(self):
    if game_state == "start" and self.is_ready:
      return

    if self.stunned and time() - self.bomb_hit_time < config["STUN_TIME"]:
        return
    self.stunned = False

    if time() - self.last_move_time < config["MOVE_FREQ"] or not self.is_alive:
      return

    pos = self.position
    # non-blank status means either explosion or death
    # invulernable for a second after being hit
    if game_state == "play" and not is_pixel_blank(pos) and \
        time() - self.bomb_hit_time > config["INVULNERABILITY_TIME"]:

      # Hurt
      if statuses[pos] != "death" and self.has_shield:
        hurt_sound.play()
        self.has_shield = False
      else:
        killer = explosion_providence[pos]
        #if killer and killer == self:
        #  killer = secondary_explosion_providence[pos]
        if killer != self:
          if killer.team != self.team or not config["TEAM_MODE"]:
            killer.kill_count += 1
        elif config["SUICIDE_PENALTY"]: # Suicide
          #self.kill_count -= 1
          self.stunned = True
        self.death_count += 1

        if config["DEATHMATCH"]:
          hurt_sound.play()
          pass
        else:
          death_sound.play()
          self.is_alive = False

      self.bomb_hit_time = time()
      broadcast_state()

    # Player clears away explosions when walking on them
    if not is_pixel_blank(pos):
      statuses[pos] = "blank"


    if self.move_direction[0] == 0 and self.move_direction[1] == 0:
      return

    up = unique_coords[pos]
    up = up / np.linalg.norm(up)
    north = np.array((0, 0, 1))
    north = ortho_proj(north, up)
    north /= np.linalg.norm(north) # normalize
    east = np.cross(up, north)

    basis = np.array((east, north, up))

    max_dot = 0
    new_pos = pos
    local_neighbors = (expanded_neighbors if config["ALLOW_CROSS_TIP_MOVE"] else neighbors)[pos]
    for n in local_neighbors:
      delta = unique_coords[pos] - unique_coords[n]
      delta += config["MOVE_BIAS"] * (unique_coords[self.prev_pos] - unique_coords[pos]) # Bias towards turning or moving backwards
      delta /= np.linalg.norm(delta)  # normalize
      rectified_delta = -np.matmul(basis, delta)[0:2]
      dot = np.dot(rectified_delta, self.move_direction)

      if dot > max_dot:
        max_dot = dot
        new_pos = n

    if statuses[new_pos] == "power_pickup":
      self.bomb_power += 1
      statuses[new_pos] = "blank"

    occupied = statuses[new_pos] == "wall"

    considered_players = playing_players() if game_state == "play" else claimed_players()

    for player in considered_players:
      if player.is_alive and player.position == new_pos:
        occupied = True
        break

      for bomb in player.bombs:
        if bomb.position == new_pos:
          if bomb.move(self.position):
            # Successful bomb kick!
            # Transfer owenership on bomb kick
            kick_sound.play()
            bomb.bump_owner(self)
          else:
            occupied = True
          break

      if occupied:
        break

    if not occupied:
      self.ghost_positions.append(pos)
      self.ghost_timestamps.append(time())
      self.prev_pos = self.position
      self.position = new_pos
      self.last_move_time = time()
      broadcast_state()

  def bomb(self):
    # resolve existing bombs
    for bomb in self.bombs.copy():
      bomb.resolve()

      if bomb.has_exploded and time() - bomb.explosion_time > SHOCKWAVE_DURATION:
        self.bombs.remove(bomb)


    # consume tap signal
    tap = self.tap
    self.tap = 0

    # see if the player places a new bomb
    if not self.is_alive or len(self.bombs) >= config["MAX_BOMBS"]:
      return
    for bomb in self.bombs:
      if self.position == bomb.position:
        return

    if time() - tap < 0.1:
      place_bomb_sound.play()
      self.bombs.append(Bomb(self))


  def render_ghost_trail(self):
    if not self.has_shield:
      return

    for i in range(GHOST_BUFFER_LEN):
      delta_t = time() - self.ghost_timestamps[i]
      color = self.current_color() / 16 * exp(-16 * delta_t * delta_t)
      color_pixel(self.ghost_positions[i], color)

  def render_player(self):
    color = self.current_color()
    for bomb in self.bombs:
      bomb_x = bomb.render()
      if bomb.position == self.position:
        color = color * (0.5 + 0.5*sin(pi * bomb_x / 1.5))

    if config["USE_SHIELDS"] and not self.has_shield:
      color = color / 12;

    flash_time = config["STUN_TIME"] if self.stunned else config["INVULNERABILITY_TIME"]
    if time() - self.bomb_hit_time < flash_time:
      # color = self.color * exp(2 * (self.bomb_hit_time - time()))
      color = color * sin(time() * 20)

    if self.is_alive:
      color_pixel(self.position, color)


  def render_ready(self):
    color = self.current_color()
    for bomb in self.bombs:
      bomb_x = bomb.render()
      if bomb.position == self.position:
        color = color * (0.5 + 0.5*cos(pi * bomb_x / 1.5))

    color_pixel(self.position, color)

    if self.is_ready:
      render_pulse(
        direction=unique_coords[self.position],
        color=self.color,
        start_time=self.ready_time,
        duration=READY_PULSE_DURATION)

      for n in neighbors[self.position]:
        color_pixel(n, color / 32 * (1 + sin(time()*2)))

  # async def transmit(self, message):
  #   if self.websocket is None:
  #     return

  #   message["self"] = self.id
  #   await self.websocket.send(json.dumps(message))

  def to_json(self):
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
    
    considered_players = playing_players() if game_state == "play" else claimed_players()
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

    # TODO special case: newton's cradle for kicked bombs?

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
    x = (300 / x)# % 6
    #color = multi_lerp(x, BOMB_COLOR_SEQUENCE)
    factor = (sin(x)+1.05) * 0.3
    color = self.owner.current_color() * factor * factor
    color_pixel(self.position, color)
    return x

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

      explosion_sound.play()
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



# ================================ WebSocket stuff =========================================

def broadcast_event(event):
  print(json.dumps(event))

last_broadcast_time = 0
def broadcast_state():
  global last_broadcast_time
  if time() - last_broadcast_time < 0.01:
    return
  message = {
    "players": [player.to_json() for player in players],
    "teams": [team.to_json() for team in teams],
    "gameState": game_state,
    "timeRemaining": state_end_time - time(),
    "victoryColor": victory_color_string,
    "config": config,
  }
  print(json.dumps(message))
  last_broadcast_time = time()


import fileinput


def consume_input():
  for line in fileinput.input():
    try:
      message = json.loads(line)

      player = players[message["self"]]

      if message["type"] == "move":
        player.move_direction = np.array(message["move"])
      elif message["type"] == "ready":
        player.set_ready()
      elif message["type"] == "unready":
        player.set_unready()
      elif message["type"] == "pulse":
        player.pulse()
      elif message["type"] == "claim":
        player.is_claimed = True
        broadcast_state()
      elif message["type"] == "release":
        player.is_claimed = False
        broadcast_state()
      elif message["type"] == "tap":
        player.tap = time()
      elif message["type"] == "settings":
        config.update(message["update"])
        broadcast_state()
      else:
        print("Unknown message type:")
        print(message)
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line)


thread = Thread(target=consume_input)
thread.start()

start()

last_frame_time = time()
while True:
  update()
  frame_time = time() - last_frame_time
  # print("Frame rate %f\nFrame  time %dms" % (1/frame_time, int(frame_time * 1000)))
  last_frame_time = time()


