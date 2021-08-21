#!/usr/bin/env python

import asyncio
import board
import collections
import json
import numpy as np
import neopixel
import pathlib
import socket
import ssl
import subprocess
import urllib.request
import websockets

from math import exp, ceil, floor, pi, cos, sin, sqrt
from pygame import mixer
from random import randrange, random
from threading import Thread
from time import time, sleep



# mixer.init(devicename="USB Audio Device, USB Audio")
# waiting_music = mixer.Sound("/home/pi/Rhomberman/waiting.wav")
# waiting_music.play()

# Actual constants
COORD_MAGNITUDE = 4.46590101883
COORD_SQ_MAGNITUDE = 19.94427190999916


MAX_BOMBS = 5
BOMB_FUSE_TIME = 5
BOMB_EXPLOSION_TIME = 1
BOMB_MOVE_FREQ = 0.07
MOVE_FREQ = 0.18
STARTING_BOMB_POWER = 2
PICKUP_CHANCE = 0.3
NUM_WALLS = 100

READY_PULSE_DURATION = 0.75
SHOCKWAVE_DURATION = 0.5


f = open("/home/pi/Rhomberman/pixels.json", "r")
pixel_info = json.loads(f.read())
f.close()
SIZE = pixel_info["SIZE"]
RAW_SIZE = pixel_info["RAW_SIZE"]
neighbors = pixel_info["neighbors"]
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
players = []
statuses = ["blank"] * SIZE

game_state = "start"
state_end_time = 0
victory_color = None
victory_color_string = None


def start():
  players.append(Player(
    position=54,
    color=(120, 2, 200),
    color_string="#9575cd")) #deep purple
  players.append(Player(
    position=105,
    color=(0, 200, 0),
    color_string="#4caf50")) #green
  players.append(Player(
    position=198,
    color=(1, 12, 200),
    color_string="#1e88e5")) #blue
  players.append(Player(
    position=24,
    color=(200, 2, 20),
    color_string="#e91e63")) #pink
  players.append(Player(
    position=125,
    color=(0, 200, 200),
    color_string="#00bcd4")) #cyan
  players.append(Player(
    position=179,
    color=(180, 200, 5),
    color_string="#c0ca33")) #lime
  players.append(Player(
    position=168,
    color=(200, 50, 0),
    color_string="#ff9800")) #orange
  players.append(Player(
    position=252,
    color=(100, 100, 255),
    color_string="#ddddff")) #bluewhite


def set_walls():
  global statuses
  statuses = ["blank"] * SIZE
  for i in range(NUM_WALLS):
    pos = randrange(SIZE)
    bad_spot = pos in START_POSITIONS
    for start_pos in START_POSITIONS:
      bad_spot = bad_spot or pos in neighbors[start_pos]

    if not bad_spot:
      statuses[pos] = "wall"

def clear_walls():
  global statuses
  statuses = ["blank"] * SIZE

# ================================ UPDATE =========================================

prev_time = 0

def update():
  global game_state
  global state_end_time
  global victory_color
  global victory_color_string
  global pixels

  # global prev_time
  # frame_time = time() - prev_time
  # print("Frame rate %f\nFrame time %dms" % (1/frame_time, int(frame_time * 1000)))
  # prev_time = time()


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
      set_walls()
      state_end_time = time() + 4
      broadcast_state()

  elif game_state == "play":
    # Timer death creep from sphere south
    threshold = 5 + (time() - state_end_time)/4
    for i in range(SIZE):
      if unique_coords[i][2] < threshold:
        statuses[i] = "death"

    # Test for game over conditions    
    live_player_count = 0
    last_player_alive = players[0]
    for player in playing_players():
      player.bomb()
      player.move()
      if player.is_alive:
        live_player_count += 1

      if player.is_alive or (not last_player_alive.is_alive and 
          player.bomb_hit_time > last_player_alive.bomb_hit_time):
        last_player_alive = player

    # GAME OVER
    if live_player_count <= 1:
      game_state = "previctory"
      state_end_time = time() + 2
      victory_color = last_player_alive.color
      victory_color_string = last_player_alive.color_string
      broadcast_state()




  if state_end_time <= time() and state_end_time > 0:
    if game_state == "victory":
      game_state = "start"
      state_end_time = 0
    elif game_state == "start":
      game_state = "play"
      state_end_time = time() + 120
    elif game_state == "previctory":
      game_state = "victory"
      state_end_time = time() + 6

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


indicies = np.arange(RAW_SIZE)

def render_snake():
  global raw_pixels

  phases = indicies / 40 + time()/2
  phases = np.minimum(1, np.mod(phases, 6))
  phases = np.sin(pi * phases) * 50
  raw_pixels = np.outer(phases, np.ones((1, 3)))

  for i in range(SIZE):
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
      color_pixel(i, (10, 10, 10))
    elif statuses[i] == "power_pickup":
      magnitude = 0.3 + 0.2 * sin(4*time() + i)
      magnitude = magnitude * magnitude
      color_pixel(i, np.array((255,100,200)) * magnitude)
    elif statuses[i] < time():
      statuses[i] = "blank"
      color_pixel(i, (0, 0, 0))
    else:
      render_explosion(i)

  for player in playing_players():
    player.render_player()

def render_explosion(index):
  x = 1 + (time() - statuses[index]) / BOMB_EXPLOSION_TIME
  x *= len(EXPLOSION_COLOR_SEQUENCE) - 1
  color_pixel(index, multi_lerp(x, EXPLOSION_COLOR_SEQUENCE))

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
  # for dupe in unique_to_dupes[index]:
  #   pixels[dupe] = (
  #     max(0, min(255, int(color[0]))),
  #     max(0, min(255, int(color[1]))),
  #     max(0, min(255, int(color[2]))))

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

# ================================ PLAYER =========================================
GHOST_BUFFER_LEN = 20

class Player:

  def __init__(self, position, color, color_string):
    self.index = len(players)  # WARNING not super robust
    self.initial_position = position
    self.color = np.array(color)
    self.color_string = color_string
    self.last_move_time = 0
    self.ready_time = 0
    self.is_claimed = False
    self.is_playing = False
    self.move_direction = np.array((0, 0))
    self.prev_move = np.array((0, 0))
    self.tap = False
    self.websocket = None

    self.ghost_positions = collections.deque(maxlen=GHOST_BUFFER_LEN)
    self.ghost_timestamps = collections.deque(maxlen=GHOST_BUFFER_LEN)
    for i in range(GHOST_BUFFER_LEN):
      self.ghost_positions.append(0)
      self.ghost_timestamps.append(0)

    self.reset()

  def reset(self):
    self.is_ready = False
    self.is_alive = True
    self.has_shield = True
    self.is_playing = False
    self.bomb_hit_time = 0
    self.position = self.initial_position
    self.bombs = []
    self.bomb_power = STARTING_BOMB_POWER

  def set_ready(self):
    self.position = self.initial_position
    self.bombs = []
    self.is_ready = True
    self.ready_time = time()
    broadcast_state()

  def set_unready(self):
    self.is_ready = False
    broadcast_state()

  def move(self):
    if game_state == "start" and self.is_ready:
      return

    if time() - self.last_move_time < MOVE_FREQ or not self.is_alive:
      return

    pos = self.position
    # non-blank status means either explosion or death
    # invulernable for a second after being hit
    if game_state == "play" and statuses[pos] != "blank" and \
      time() - self.bomb_hit_time > 1:
      if statuses[pos] != "death" and self.has_shield:
        self.has_shield = False
      else:
        self.is_alive = False
      self.bomb_hit_time = time()
      broadcast_state()

    if self.move_direction[0] == 0 and self.move_direction[1] == 0:
      return

    up = unique_coords[pos]
    up = up / np.linalg.norm(up)
    north = np.array((0, 0, 1))
    north = ortho_proj(north, up)
    north = north / np.linalg.norm(north)
    east = np.cross(up, north)

    basis = np.array((east, north, up))

    max_dot = 0
    new_pos = pos
    for n in neighbors[pos]:
      delta = unique_coords[pos] - unique_coords[n]
      rectified_delta = -np.matmul(basis, delta)[0:2]
      new_move = self.move_direction - self.prev_move/2
      dot = np.dot(rectified_delta, new_move)

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
          if not bomb.move(self.position):
            occupied = True
          break

      if occupied:
        break

    if not occupied:
      self.ghost_positions.append(pos)
      self.ghost_timestamps.append(time())
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
    if not self.is_alive or len(self.bombs) >= MAX_BOMBS:
      return
    for bomb in self.bombs:
      if self.position == bomb.position:
        return

    if time() - tap < 0.1:
      self.bombs.append(Bomb(self.position, time(), self.bomb_power))


  def render_ghost_trail(self):
    if not self.has_shield:
      return

    for i in range(GHOST_BUFFER_LEN):
      delta_t = time() - self.ghost_timestamps[i]
      color = self.color / 16 * exp(-16 * delta_t * delta_t)
      color_pixel(self.ghost_positions[i], color)

  def render_player(self):
    color = self.color
    for bomb in self.bombs:
      bomb_x = bomb.render()
      if bomb.position == self.position:
        color = color * (0.5 + 0.5*sin(pi * bomb_x / 1.5))

    if not self.has_shield:
      color = color / 6;

    if time() - self.bomb_hit_time < 1.5:
      # color = self.color * exp(2 * (self.bomb_hit_time - time()))
      color = color * sin(time() * 20)

    if self.is_alive:
      color_pixel(self.position, color)


  def render_ready(self):
    color = self.color
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

  async def transmit(self, message):
    if self.websocket is None:
      return

    message["self"] = self.index
    await self.websocket.send(json.dumps(message))

  def to_json(self):
    return {
      "isClaimed": self.is_claimed,
      "isReady": self.is_ready,
      "isPlaying": self.is_playing,
      "isAlive": self.is_alive,
      "color": self.color_string,
      "position": self.position,
      "bombPower": self.bomb_power,
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

  def __init__(self, position, timestamp, power):
    self.position = position
    self.prev_pos = position
    self.last_move_time = time()
    self.timestamp = timestamp
    self.power = power
    self.has_exploded = False
    self.explosion_time = 0

  def move(self, prev_pos):
    new_pos = next_pixel[str((prev_pos, self.position))]

    occupied = statuses[new_pos] == "wall"
    
    considered_players = playing_players() if game_state == "play" else claimed_players()
    for player in considered_players:
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

    x = BOMB_FUSE_TIME - time() + self.timestamp
    x += 2
    x = (200 / x) % 6
    color = multi_lerp(x, BOMB_COLOR_SEQUENCE)
    color_pixel(self.position, color)
    return x

  def resolve(self):
    if self.has_exploded:
      return

    if self.position != self.prev_pos and time() - self.last_move_time > BOMB_MOVE_FREQ:
      self.move(self.prev_pos)

    # fuse has run out or hit by an explosion
    if time() - self.timestamp >= BOMB_FUSE_TIME or statuses[self.position] != "blank":
      broadcast_event({
          "event": "explosion",
          "position": self.position})
      
      statuses[self.position] = time() + BOMB_EXPLOSION_TIME - self.power/32
      for neighbor in neighbors[self.position]:
        explode((self.position, neighbor), self.power - 1)

      self.has_exploded = True
      self.explosion_time = time()

def explode(direction, power):
  if power < 0:
    return


  if statuses[direction[1]] == "wall":
    if random() < PICKUP_CHANCE:
      statuses[direction[1]] = "power_pickup"
    else:
      statuses[direction[1]] = "blank"
    return

  finish_time = time() + BOMB_EXPLOSION_TIME - power/32
  statuses[direction[1]] = finish_time
  explode((direction[1], next_pixel[str(direction)]), power - 1)



# ================================ WebSocket stuff =========================================

def broadcast_event(event):
  print(json.dumps(event))

def broadcast_state():
  message = {
    "players": [player.to_json() for player in players],
    "gameState": game_state,
    "timeRemaining": state_end_time - time(),
    "victoryColor": victory_color_string,
  }
  print(json.dumps(message))


import fileinput


def consume_input():
  for line in fileinput.input():
    try:
      message = json.loads(line)

      player = players[message["self"]]

      if message["type"] == "move":
        player.prev_move = player.move_direction
        player.move_direction = np.array(message["move"])
      elif message["type"] == "ready":
        player.set_ready()
      elif message["type"] == "unready":
        player.set_unready()
      elif message["type"] == "claim":
        player.is_claimed = True
        broadcast_state()
      elif message["type"] == "release":
        player.is_claimed = False
        broadcast_state()
      elif message["type"] == "tap":
        player.tap = time()
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
  # print(time() - last_frame_time)
  last_frame_time = time()


