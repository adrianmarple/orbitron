#!/usr/bin/env python

import numpy as np

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random, choice
from time import time, sleep
import collections

from audio import sounds, prewarm_audio
import engine
from engine import *


config["ROUND_TIME"] = 150
config["START_LENGTH"] = 4
config["ADDITIONAL_APPLES"] = 25


battle_channel = None
vamp = None


prewarm_audio(sound_file_names=[
    "battle1.ogg", "battle1Loop.ogg", "waiting.ogg", "victory.mp3",
    "hurt.wav",
  ],
  #stubs=["battle1.ogg", "battle1Loop.ogg", "dm1.ogg", "dm1Loop.ogg","waiting.ogg","victory.mp3"]
  #, start_loop="waiting"
  )

def setup():
  Snek(position=105,
    color=(0, 200, 0),
    color_string="#4caf50") #green
  Snek(position=198,
    color=(1, 12, 200),
    color_string="#1e88e5") #blue
  Snek(position=24,
    color=(200, 2, 20),
    color_string="#e91e63") #pink
  Snek(position=252,
    color=(100, 0, 250),
    color_string="#9575cd") #deep purple
  Snek(position=168,
    color=(180, 200, 5),
    color_string="#c0ca33") #lime
  Snek(position=311,
    color=(200, 50, 0),
    team_color=(0, 120, 120),
    color_string="#ff9800") #orange

def handle_event(message, player):
    pass

def start_update():
  for player in claimed_players():
    if not player.is_ready:
      player.move()

  if engine.state_end_time == 0 and is_everyone_ready(minimum=2):
    for player in claimed_players():
      player.is_playing = True

    engine.state_end_time = time() + 4
    broadcast_state()
    sounds["waiting"].fadeout(4000)


def play_update():
  if battle_channel.get_queue() is None:
    battle_channel.queue(vamp)

  for player in playing_players():
    player.move()

def play_ontimeout():
  battle_channel.stop()
  sounds["victory"].play()
  engine.game_state = victory_state
  top_score = 0
  top_score_time = 0
  for player in playing_players():
    if player.score > top_score or (player.score == top_score and player.score_timestamp < top_score_time):
      top_score = player.score
      top_score_time = player.score_timestamp
      engine.victor = player
  engine.state_end_time = time() + 10
  clear()
  for player in players:
    player.reset()

  touchall()
  broadcast_state()

def start_ontimeout():
  global battle_channel, vamp
  engine.state_end_time = time() + config["ROUND_TIME"]
  engine.game_state = play_state
  battle_channel = sounds["battle1"].play()
  vamp = sounds["battle1Loop"]
  for i in range(len(playing_players()) + config["ADDITIONAL_APPLES"]):
    spawn_apple()

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

  for player in claimed_players():
    if player.is_ready:
      player.render_ready()
    else:
      player.render()

def render_game():
  if engine.state_end_time - time() < 5:
    countdown = ceil(engine.state_end_time - time())
    countup = 5 - countdown
    render_pulse(
      direction=(0,0,COORD_MAGNITUDE),
      color=np.array((60,60,60)) * countup,
      start_time=engine.state_end_time - countdown,
      duration=READY_PULSE_DURATION)

  for i in range(SIZE):
    if statuses[i] == "blank":
      # already handled
      pass
    elif statuses[i] == "apple":
      color_pixel(i, (10, 10, 10))

  for player in playing_players():
    player.render()

def spawn_apple():
  while True:
    apple_pos = randrange(0,SIZE)
    if statuses[apple_pos] == "apple":
      continue
    occupied = False
    for player in playing_players():
      if player.occupies(apple_pos):
        occupies = True
        break
    if occupied:
      continue
    statuses[apple_pos] = "apple"
    return

start_state = State("start", start_update, start_ontimeout, render_sandbox)
play_state = State("play", play_update, play_ontimeout, render_game)
victory_state = State("victory", start_update, victory_ontimeout, render_victory)


# ================================ PLAYER =========================================

class Snek(Player):
  def __init__(self, *args, **kwargs):
    self.tail = collections.deque(maxlen=SIZE)
    Player.__init__(self, *args, **kwargs)

  def reset(self):
    self.buffered_move = ZERO_2D
    self.last_move_input_time = 0
    self.score_timestamp = 0
    self.score = config["START_LENGTH"]
    self.tail.clear()
    self.shrinking = False
    for i in range(config["START_LENGTH"]):
      self.tail.append(self.initial_position)
    Player.reset(self)

  def set_ready(self):
    Player.set_ready(self)
    self.tail.clear()
    for i in range(config["START_LENGTH"]):
      self.tail.append(self.initial_position)


  def occupies(self, pos):
    for position in self.tail:
      if pos == position:
        return True
    return False

  def tail_occupies(self, pos):
    for (i, position) in enumerate(self.tail):
      if i == 0:
        continue
      if pos == position:
        return True
    return False

  def die(self):
    self.shrinking = True
    # while len(self.tail)>config["START_LENGTH"]:
    #   self.tail.popleft()
    # self.position = self.tail[0]
    # self.prev_pos = self.tail[1]


  def cant_move(self):
    return (
      (engine.game_state == start_state and self.is_ready) or # Don't move when marked ready
      time() - self.last_move_time < config["MOVE_FREQ"] # just moved
    )

  def get_next_position(self):
    pos = self.position

    direction_string = str((self.prev_pos, pos))
    if direction_string in next_pixel:
      continuation_pos = next_pixel[direction_string]
    else:
      continuation_pos = pos

    local_neighbors = (expanded_neighbors if config["ALLOW_CROSS_TIP_MOVE"] else neighbors)[pos]
    if continuation_pos != pos and len(local_neighbors) <= 2:
      return continuation_pos

    up = unique_coords[pos]
    up = up / np.linalg.norm(up)
    north = np.array((0, 0, 1))
    north = ortho_proj(north, up)
    north /= np.linalg.norm(north) # normalize
    east = np.cross(up, north)

    basis = np.array((east, north, up))

    max_dot = 0
    new_pos = pos
    for n in local_neighbors:
      delta = unique_coords[pos] - unique_coords[n]
      delta /= np.linalg.norm(delta)  # normalize
      rectified_delta = -np.matmul(basis, delta)[0:2]
      dot = np.dot(rectified_delta, self.buffered_move)
      if n == continuation_pos:
        dot *= (1 - config["MOVE_BIAS"])

      if dot > max_dot:
        max_dot = dot
        new_pos = n

    if new_pos == self.position or new_pos == self.tail[1]:
      return continuation_pos
    else:
      return new_pos

  def move(self):
    if len(self.tail) <= config["START_LENGTH"]:
      self.shrinking = False
    if self.shrinking:
      self.tail.popleft()
      self.position = self.tail[0]
      self.prev_pos = self.tail[1]


    if engine.game_state == play_state:
      for player in playing_players():
        if player == self:
          if player.tail_occupies(self.position):
            self.die()
        elif player.occupies(self.position):
          self.die()
          if player.position==self.position:
            player.die()

    if not (self.move_direction == ZERO_2D).all():
      self.buffered_move = self.move_direction
      self.last_move_input_time = time()
    elif time() - self.last_move_input_time > config["MOVE_FREQ"] * 2:
      self.buffered_move = ZERO_2D

    if self.cant_move():
      return

    new_pos = self.get_next_position()

    self.prev_pos = self.position
    self.position = new_pos
    self.last_move_time = time()

    self.tail.appendleft(self.position)
    if statuses[self.position] == "apple":
      if len(self.tail) > self.score:
        self.score = len(self.tail)
        self.score_timestamp = time()

      statuses[self.position] = "blank"
      spawn_apple()
    else:
      self.tail.pop()

    broadcast_state()

  def to_json(self):
    dictionary = Player.to_json(self)
    dictionary["length"] = len(self.tail)
    dictionary["score"] = self.score
    return dictionary

  def render(self):
    if not self.is_alive:
      return
    for position in self.tail:
      color_pixel(position, self.current_color()/8)
    color_pixel(self.position, self.current_color())

