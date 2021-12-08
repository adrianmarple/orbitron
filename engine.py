#!/usr/bin/env python

import board
import collections
import json
from neopixel_write import neopixel_write
import digitalio
import numpy as np

from math import exp, ceil, floor, pi, cos, sin, sqrt
from pygame import mixer  # https://www.pygame.org/docs/ref/mixer.html
from random import randrange, random
# from threading import Thread
from time import time

from audio import sounds,prewarm_audio

prewarm_audio(sound_file_names=[
    "battle1.ogg", "battle1Loop.ogg", "dm1.ogg", "dm1Loop.ogg","waiting.ogg","victory.mp3",
    "kick.wav", "placeBomb.wav", "hurt.wav", "death.wav", "explosion.wav"
  ],
  #stubs=["battle1.ogg", "battle1Loop.ogg", "dm1.ogg", "dm1Loop.ogg","waiting.ogg","victory.mp3"]
  start_loop="waiting"
)

# Actual constants
COORD_MAGNITUDE = 4.46590101883
COORD_SQ_MAGNITUDE = 19.94427190999916

config = {
  "INVULNERABILITY_TIME": 2,
  "STUN_TIME": 5,
  "MOVE_FREQ": 0.18,
  "ALLOW_CROSS_TIP_MOVE": False,
  "MOVE_BIAS": 0.5,
  "TEAM_MODE": True,
}

READY_PULSE_DURATION = 0.75
SHOCKWAVE_DURATION = 0.5
ZERO_2D = np.array((0, 0))

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
dupe_to_unique = pixel_info["dupe_to_unique"]
unique_antipodes = pixel_info["unique_antipodes"]

pixels = np.zeros((SIZE, 3),dtype="<u1")
raw_pixels = np.zeros((RAW_SIZE, 3),dtype="<u1")
dupe_matrix = np.zeros((RAW_SIZE, SIZE),dtype="<u1")
for (i, dupes) in enumerate(unique_to_dupes):
  for dupe in dupes:
    dupe_matrix[dupe, i] = 1

pin = digitalio.DigitalInOut(board.D18)
pin.direction = digitalio.Direction.OUTPUT
print("Running %s pixels" % pixel_info["RAW_SIZE"])

START_POSITIONS = [54, 105, 198, 24, 125, 179, 168, 252]
statuses = ["blank"] * SIZE

current_game = ""
game_state = None
start_state = None
state_end_time = 0
victor = None

data = {}
players = []
teams = []




class State:
  def __init__(self, name, update=None, ontimeout=None, render=None):
    self.name = name
    if update:
      self.update = update
    if ontimeout:
      self.ontimeout = ontimeout
    if render:
      self.render = render

  def update(self):
    pass

  def ontimeout(self):
    pass

  def render(self):
    pass


# ================================ START =========================================

def start(starting_state):
  global start_state, game_state
  start_state = starting_state
  game_state = start_state

def quit():
  global start_state, game_state, current_game, state_end_time, victor
  current_game = ""
  game_state = None
  start_state = None
  state_end_time = 0
  clear()
  for sound in sounds:
    if sound=="waiting":
      if sounds[sound].get_num_channels()<=0:
        sounds[sound].play(loops=-1, fade_ms=2000)
    else: 
      sounds[sound].stop()

# ================================ UPDATE =========================================


def update():
  global game_state, state_end_time
  global pixels


  if not game_state:
    render_snake()
    return
  if len(claimed_players()) == 0:
    quit()
    return


  game_state.update()

  if state_end_time <= time() and state_end_time > 0:
    game_state.ontimeout()
    broadcast_state()

  # For countdown on phone
  remaining_time = state_end_time - time()
  if game_state == start_state and remaining_time > 0 and remaining_time % 1 < 0.05:
    broadcast_state()


  pixels *= 0
  game_state.render()

  pixels = np.minimum(pixels, 255)
  pixels = np.maximum(pixels, 0)
  raw_pixels = np.matmul(dupe_matrix,pixels)
  raw_pixels[:, [0, 1]] = raw_pixels[:, [1, 0]]
  output=np.array(raw_pixels,dtype="<u1").tobytes()
  neopixel_write(pin,output)


# ================================ TEAM =========================================

class Team:
  def __init__(self, team_id, color, color_string, name, players):
    self.id = team_id
    self.color = np.array(color)
    self.color_string = color_string
    self.name = name
    self.players = players
    for player in players:
      player.team = self

  def to_json(self):
    return {
      "id": self.id,
      "name": self.name,
      "color": self.color_string,
      "players": [player.id for player in self.players],
    }

# ================================ PLAYER =========================================
GHOST_BUFFER_LEN = 20

class Player:
  def __init__(self,
      position=0,
      color=(150,150,150),
      color_string="white",
      team_color=None,
      template_player=None):

    self.initial_position = position
    self.color = np.array(color)
    if team_color:
      self.team_color = np.array(team_color)
    else:
      self.team_color = self.color
    self.color_string = color_string
    self.last_move_time = 0
    self.ready_time = 0
    self.is_claimed = False
    self.is_playing = False
    self.move_direction = np.array((0, 0))
    self.prev_pos = 0
    self.tap = 0
    self.vote = ""


    self.ghost_positions = collections.deque(maxlen=GHOST_BUFFER_LEN)
    self.ghost_timestamps = collections.deque(maxlen=GHOST_BUFFER_LEN)
    for i in range(GHOST_BUFFER_LEN):
      self.ghost_positions.append(0)
      self.ghost_timestamps.append(0)

    self.reset()

    if template_player:
      self.initial_position = template_player.initial_position
      self.position = template_player.position
      self.is_claimed = template_player.is_claimed
      self.is_ready = template_player.is_ready
      self.is_playing = template_player.is_playing
      self.id = template_player.id
      players[self.id] = self
    else:
      self.id = len(players)
      players.append(self)

  def reset(self):
    self.is_ready = False
    self.is_alive = True
    self.is_playing = False
    self.position = self.initial_position
    self.prev_pos = self.position
    self.stunned = False
    self.hit_time = 0
    self.ready_from_direction = None

  def set_ready(self):
    self.ready_from_direction = unique_coords[self.position]
    self.ready_time = time()
    self.position = self.initial_position
    self.is_ready = True
    broadcast_state()

  def set_unready(self):
    self.is_ready = False
    self.tap = 0
    broadcast_state()

  def current_color(self):
    return self.team_color if config["TEAM_MODE"] else self.color

  def pulse(self):
    self.ready_from_direction = None
    self.ready_time = time()
    broadcast_state()

  def cant_move(self):
    return (not self.is_alive or
      self.stunned or
      (game_state == start_state and self.is_ready) or # Don't move when marked ready
      time() - self.last_move_time < config["MOVE_FREQ"] or # just moved
      (self.move_direction == ZERO_2D).all()
    )


  def get_next_position(self):
    pos = self.position

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

    return new_pos


  def is_occupied(self, position):
    if statuses[position] == "wall":
      return True

    considered_players = claimed_players() if game_state == start_state else playing_players()
    for player in considered_players:
      if player.is_alive and player.position == position:
        return True

    return False


  def move(self):
    if self.stunned and time() - self.hit_time > config["STUN_TIME"]:
      self.stunned = False

    if self.cant_move():
      return

    new_pos = self.get_next_position()

    if not self.is_occupied(new_pos):
      self.ghost_positions.append(self.position)
      self.ghost_timestamps.append(time())
      self.prev_pos = self.position
      self.position = new_pos
      self.last_move_time = time()
      broadcast_state()


  def render_ghost_trail(self):
    for i in range(GHOST_BUFFER_LEN):
      delta_t = time() - self.ghost_timestamps[i]
      color = self.current_color() / 16 * exp(-16 * delta_t * delta_t)
      color_pixel(self.ghost_positions[i], color)

  def render(self):
    if not self.is_alive:
      return
    color = self.current_color()

    flash_time = config["STUN_TIME"] if self.stunned else config["INVULNERABILITY_TIME"]
    flash_speed = 16 if self.stunned else 30
    if time() - self.hit_time < flash_time:
      color = color * sin(time() * flash_speed)

    color_pixel(self.position, color)


  def render_ready(self):
    color = self.current_color()
    color_pixel(self.position, color)
    for n in neighbors[self.position]:
      color_pixel(n, color / 32 * (1 + sin(time()*2)))

    render_pulse(
      direction=unique_coords[self.position],
      # from_direction=self.ready_from_direction,
      color=self.current_color(),
      start_time=self.ready_time,
      duration=READY_PULSE_DURATION)


  def to_json(self):
    dictionary = {
      "isClaimed": self.is_claimed,
      "isReady": self.is_ready,
      "isPlaying": self.is_playing,
      "isAlive": self.is_alive,
      "color": self.color_string,
      "position": self.position,
      "vote": self.vote,
    }
    if hasattr(self, "team"):
      dictionary["team"] = self.team.id

    return dictionary


# ================================ MISC =========================================

def claimed_players():
  return [player for player in players if player.is_claimed]
def playing_players():
  return [player for player in players if player.is_playing]

def color_pixel(index, color):
  pixels[index] = color

def add_color_to_pixel(index, color):
  pixels[index] += np.array(color,dtype="<u1")

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

def is_everyone_ready(minimum):
  claimed = claimed_players()
  if len(claimed) < minimum:
    return False
  for player in claimed:
    if not player.is_ready:
      return False
  return True


def clear():
  for i in range(len(statuses)):
    statuses[i] = "blank"


indicies = np.arange(RAW_SIZE)
def render_snake():
  global raw_pixels

  phases = indicies / 40 + time()/2
  phases = np.minimum(1, np.mod(phases, 6))
  phases = np.sin(pi * phases) * 50
  raw_pixels = np.outer(phases, np.ones((1, 3)))

  output=np.array(raw_pixels,dtype="<u1").tobytes()
  neopixel_write(pin,output)


def render_pulse(direction=np.array((COORD_MAGNITUDE,0,0)),
    from_direction=None,
    color=(200,200,200), start_time=0, duration=1):

  global pixels
  t = (time() - start_time) / duration

  if (t < 1):
    if from_direction is not None:
      alpha = 1.4 * t - 0.2
      alpha = max(alpha, 0)
      alpha = min(alpha, 1)
      direction = alpha * direction - (1 - alpha) * from_direction

    direction /= np.linalg.norm(direction)

    ds = direction * unique_coord_matrix / COORD_MAGNITUDE / 2 + 0.5
    ds = ds * 6 - (t * 7 - 1)
    # ds = 6*(ds + 1) - 7*t
    # ds *= -1
    ds = np.maximum(0, np.multiply(ds, (1 - ds)) / 3)
    pixels += np.array(np.outer(ds, color), dtype="<u1")

def render_victory():
  for (i, coord) in enumerate(unique_coords):
    color_pixel(i, victor.color * sin(coord[2] - 4*time()))


def victory_ontimeout():
  global game_state, state_end_time
  game_state = start_state
  state_end_time = 0
  sounds["victory"].fadeout(1000)
  if sounds["waiting"].get_num_channels() <= 0:
    sounds["waiting"].play(loops=-1, fade_ms=2000)
  clear()
  for player in players:
    player.reset()


# ================================ Communication with node.js =========================================

def touchall():
  print("touchall\n")

def broadcast_event(event):
  print(json.dumps(event))

last_broadcast_time = 0
def broadcast_state():
  global last_broadcast_time
  if time() - last_broadcast_time < 0.01:
    return
  message = {
    "game": current_game,
    "players": [player.to_json() for player in players],
    "teams": [team.to_json() for team in teams],
    "gameState": game_state.name if game_state else "none",
    "timeRemaining": state_end_time - time(),
    "victor": victor.to_json() if victor else {},
    "config": config,
    "data": data,
  }
  print(json.dumps(message))
  last_broadcast_time = time()



# ================================ Core loop =========================================

def run_core_loop():
  for i in range(6):
    Player()

  last_frame_time = time()
  while True:
    update()
    frame_time = time() - last_frame_time
    # print("Frame rate %f\nFrame  time %dms" % (1/frame_time, int(frame_time * 1000)))
    last_frame_time = time()

