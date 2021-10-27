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
  "NUM_PACMEN": 1,
  "NUM_GHOSTS": 4,
  "PACMAN_MOVE_FREQ": 0.18,
  "GHOST_MOVE_FREQ": 0.22,
  "WINNING_PELLET_RATIO": 0.2,
  "CONSTANT_MOTION": False,
  "ALLOW_CROSS_TIP_MOVE": False,
  "MOVE_BIAS": 0.5,
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

statuses = ["blank"] * SIZE

game_state = "start"
state_end_time = 0
victory_color = None
victory_color_string = None


players = []

def start():
  players.append(Player(
    position=252,
    color=(190, 200, 5),
    color_string="#dada23")) #yellow
  players.append(Player(
    position=105,
    color=(255, 0, 0),
    color_string="#ff0000")) #red
  players.append(Player(
    position=24,
    color=(200, 5, 30),
    color_string="#e91e63")) #pink
  players.append(Player(
    position=198,
    color=(2, 60, 200),
    color_string="#1e88e5")) #cyan
  players.append(Player(
    position=168,
    color=(200, 50, 0),
    color_string="#ff9800")) #orange



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
        player.move()

    is_everyone_ready = True
    if len(claimed) <= 0:
      is_everyone_ready = False

    for player in claimed:
      is_everyone_ready = is_everyone_ready and player.is_ready

    if is_everyone_ready and state_end_time == 0:
      for player in claimed:
        player.is_playing = True
      set_pellets()
      state_end_time = time() + 4
      broadcast_state()
      waiting_music.fadeout(4000)

  elif game_state == "play":
    if battle_channel.get_queue() is None:
      battle_channel.queue(vamp)

    for player in playing_players():
      player.move()


    ghosts_win = True
    for player in playing_players():
      if player.is_pacman and player.is_alive:
        ghosts_win = False
        break

    if ghosts_win:
      gameover("ghosts")

    pellet_count = 0
    for status in statuses:
      if status == "pellet":
        pellet_count += 1

    if pellet_count / 420.0 <= config["WINNING_PELLET_RATIO"]:
      gameover("pacmen")




  if state_end_time <= time() and state_end_time > 0:
    if game_state == "victory":
      game_state = "start"
      state_end_time = 0
      victory_music.fadeout(1000)
      waiting_music.play(loops=-1, fade_ms=2000)
    elif game_state == "start":
      game_state = "play"
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
  if winner == "pacmen":
    victory_color = players[0].color
    victory_color_string = players[0].color_string
  else:
    victory_color = players[1].color
    victory_color_string = players[1].color_string
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
    elif statuses[i] == "pellet":
      color_pixel(i, (11, 9, 9))

  for player in playing_players():
    player.render_player()

def render_explosion(index):
  x = 1 + (time() - statuses[index]) / config["BOMB_EXPLOSION_TIME"]
  if (x >= 0):
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


def set_pellets():
  global statuses
  statuses = ["pellet"] * SIZE

def clear_walls():
  global statuses
  statuses = ["blank"] * SIZE



# ================================ PLAYER =========================================
GHOST_BUFFER_LEN = 20

class Player:
  def __init__(self, position, color, color_string):
    self.id = len(players)  # WARNING not super robust
    self.initial_position = position
    self.color = np.array(color)
    self.color_string = color_string
    self.last_move_time = 0
    self.ready_time = 0
    self.is_claimed = False
    self.is_playing = False
    self.move_direction = np.array((0, 0))
    # self.tap = 0
    self.websocket = None

    self.ghost_positions = collections.deque(maxlen=GHOST_BUFFER_LEN)
    self.ghost_timestamps = collections.deque(maxlen=GHOST_BUFFER_LEN)
    for i in range(GHOST_BUFFER_LEN):
      self.ghost_positions.append(0)
      self.ghost_timestamps.append(0)

    self.is_pacman = self.id == 0

    self.reset()

  def reset(self):
    self.is_ready = False
    self.is_alive = True
    self.is_playing = False
    self.bomb_hit_time = 0
    self.position = self.initial_position
    self.prev_pos = self.position

  def set_ready(self):
    self.position = self.initial_position
    self.is_ready = True
    self.ready_time = time()
    broadcast_state()

  def set_unready(self):
    self.is_ready = False
    # self.tap = 0
    broadcast_state()

  def current_color(self):
    return self.color

  def pulse(self):
    self.ready_time = time()
    broadcast_state()

  def move(self):
    if game_state == "start" and self.is_ready:
      return

    move_freq = config["PACMAN_MOVE_FREQ"] if self.is_pacman else config["GHOST_MOVE_FREQ"]
    if time() - self.last_move_time < move_freq or not self.is_alive:
      return

    pos = self.position

    if self.is_pacman:
      # Pacman consumes pellets as they move
      statuses[pos] = "blank"

      for player in playing_players():
        if not player.is_pacman and player.position == pos:
          self.is_alive = False
          broadcast_state()
          return

    if self.move_direction[0] == 0 and self.move_direction[1] == 0:
      direction_string = str((self.prev_pos, pos))
      if config["CONSTANT_MOTION"] and direction_string in next_pixel:
        new_pos = next_pixel[direction_string]
      else:
        return

    else:
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

    occupied = statuses[new_pos] == "wall"
    considered_players = playing_players() if game_state == "play" else claimed_players()

    for player in considered_players:
      if player.is_alive and player.is_pacman == self.is_pacman and player.position == new_pos:
        occupied = True
        break

    if not occupied:
      self.ghost_positions.append(pos)
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

  def render_player(self):
    if self.is_alive:
      color_pixel(self.position, self.current_color())


  def render_ready(self):
    color = self.current_color()
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
    }


# ================================ WebSocket stuff =========================================

def broadcast_event(event):
  print(json.dumps(event))

def broadcast_state():
  message = {
    "players": [player.to_json() for player in players],
    "gameState": game_state,
    "timeRemaining": state_end_time - time(),
    "victoryColor": victory_color_string,
    "config": config,
  }
  print(json.dumps(message))


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


