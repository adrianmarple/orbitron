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

game_state = None
state_end_time = 0
victory_color = None
victory_color_string = None

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

def start(start_function, starting_state):
  start_function()
  global start_state, game_state
  start_state = starting_state
  game_state = start_state

  last_frame_time = time()
  while True:
    update()
    frame_time = time() - last_frame_time
    # print("Frame rate %f\nFrame  time %dms" % (1/frame_time, int(frame_time * 1000)))
    last_frame_time = time()


# ================================ UPDATE =========================================


def update():
  global game_state, state_end_time
  global victory_color, victory_color_string
  global pixels

  game_state.update()

  if state_end_time <= time() and state_end_time > 0:
    game_state.ontimeout()
    broadcast_state()

  # For countdown on phone
  remaining_time = state_end_time - time()
  if game_state == start_state and remaining_time > 0 and remaining_time % 1 < 0.05:
    broadcast_state()

  # Render special idle state if no one is there
  if game_state == start_state and len(claimed_players()) == 0:
    render_snake()
    return

  pixels *= 0
  game_state.render()

  pixels = np.minimum(pixels, 255)
  pixels = np.maximum(pixels, 0)
  for i in range(RAW_SIZE):
    neopixels[i] = pixels[dupe_to_unique[i]]
  neopixels.show()



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

  def to_json(self):
    return {
      "id": self.id,
      "color": self.color_string,
      "players": [player.id for player in self.players],
    }

# ================================ PLAYER =========================================
GHOST_BUFFER_LEN = 20

class Player:
  def __init__(self, position, color, color_string, team_color=None):
    self.id = len(players)
    players.append(self)
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
    self.is_playing = False
    self.position = self.initial_position
    self.prev_pos = self.position
    self.stunned = False
    self.hit_time = 0

  def set_ready(self):
    self.position = self.initial_position
    self.is_ready = True
    self.ready_time = time()
    broadcast_state()

  def set_unready(self):
    self.is_ready = False
    self.tap = 0
    broadcast_state()

  def current_color(self):
    return self.color if not config["TEAM_MODE"] else self.team_color

  def pulse(self):
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
    color = self.current_color()

    flash_time = config["STUN_TIME"] if self.stunned else config["INVULNERABILITY_TIME"]
    if time() - self.hit_time < flash_time:
      color = color * sin(time() * 20)

    if self.is_alive:
      color_pixel(self.position, color)


  def render_ready(self):
    color = self.current_color()
    color_pixel(self.position, color)
    for n in neighbors[self.position]:
      color_pixel(n, color / 32 * (1 + sin(time()*2)))

    render_pulse(
      direction=unique_coords[self.position],
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

  for i in range(RAW_SIZE):
    neopixels[i] = raw_pixels[i]
  neopixels.show()


def render_pulse(direction=np.array((COORD_MAGNITUDE,0,0)),
    color=(200,200,200), start_time=0, duration=1):

  global pixels
  t = (time() - start_time) / duration
  if (t < 1):
    ds = direction * unique_coord_matrix / COORD_SQ_MAGNITUDE / 2 + 0.5
    ds = ds * 6 - (t * 8 - 1)
    ds = np.maximum(0, np.multiply(ds, (ds - 1)) / -3)
    pixels += np.outer(ds, color)

def render_victory():
  for (i, coord) in enumerate(unique_coords):
    color_pixel(i, victory_color * sin(coord[2] - 4*time()))


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
    "gameState": game_state.name,
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
