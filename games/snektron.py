#!/usr/bin/env python

import numpy as np
import numbers
import os
import sys

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random
from time import time, sleep

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds, music
import engine
from engine import *


config["SNEK_ROUND_TIME"] = 94.6
config["START_LENGTH"] = 4
config["SANDBOX_APPLES_PER_SNEK"] = 15
config["ADDITIONAL_APPLES"] = 25
config["INTERSECTION_PAUSE_FACTOR"] = 0.2
config["SNAKE_MOVE_FREQ"] = 0.25
config["SNEK_REQUIRED_LEAD_TIME"] = 10
config["SNEK_LEAD_THRESHOLD"] = 10
config["SNEK_FIXED_TIME_ROUNDS"] = True


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
    color_string="#ff9800") #orange

def handle_event(message, player):
  pass


def start_update():
  apple_count = 0
  for status in statuses:
    if status == "apple":
      apple_count += 1
  total_snek_length = 0
  for snek in claimed_players():
    total_snek_length += len(snek.tail)
  max_total_length = config["SANDBOX_APPLES_PER_SNEK"] * len(claimed_players())
  for i in range(max_total_length - total_snek_length - apple_count):
    spawn("apple")

  for player in claimed_players():
    player.move()


def countdown_ontimeout():
  for i in range(len(playing_players()) + config["ADDITIONAL_APPLES"]):
    spawn("apple")
  data["current_leader"] = -1
  if config["SNEK_FIXED_TIME_ROUNDS"]:
    engine.state_end_time = time() + config["SNEK_ROUND_TIME"]
  else:
    engine.state_end_time = 0
  engine.game_state = play_state
  music["snekBattle"].play()


def play_update():
  for player in playing_players():
    player.move()


  if not config["SNEK_FIXED_TIME_ROUNDS"]:
    leader = None
    runner_up = None
    for player in playing_players():
      if leader is None or len(leader.tail) < len(player.tail):
        runner_up = leader
        leader = player
      elif runner_up is None or len(runner_up.tail) < len(player.tail):
        runner_up = player

    if data["current_leader"] >= 0: #someone is in the lead
      if leader.id != data["current_leader"]:
        engine.state_end_time = 0
        data["current_leader"] = -1
    elif len(leader.tail) - len(runner_up.tail)  > config["SNEK_LEAD_THRESHOLD"]:
      engine.state_end_time = time() + config["SNEK_REQUIRED_LEAD_TIME"]
      data["current_leader"] = leader.id


def play_ontimeout():
  music["snekBattle"].fadeout(1000)
  engine.game_state = previctory_state
  top_score = 0
  top_score_time = 0
  for player in playing_players():
    if player.score > top_score or (player.score == top_score and player.score_timestamp < top_score_time):
      top_score = player.score
      top_score_time = player.score_timestamp
      engine.victor = player
  engine.state_end_time = time() + 1

def previctory_ontimeout():
  engine.game_state = victory_state
  engine.state_end_time = time() + config["VICTORY_TIMEOUT"]
  music["victory"].play()

def render_game():
  countdown_length = 7 if engine.game_state == play_state else 5
  if engine.game_state == play_state and engine.state_end_time > 0 and engine.state_end_time - time() < 7:
    countdown = ceil(engine.state_end_time - time())
    countup = 7 - countdown
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


  if engine.game_state == countdown_state:
    for player in playing_players():
      player.render_ready()
  else:
    for player in current_players():
      player.render()



start_state = State("start", start_update, start_ontimeout, render_game)
countdown_state = State("countdown", None, countdown_ontimeout, render_countdown)
play_state = State("play", play_update, play_ontimeout, render_game)
previctory_state = State("previctory", None, previctory_ontimeout, render_game)
victory_state = State("victory", None, victory_ontimeout, render_victory)


# ================================ PLAYER =========================================

class Snek(Player):
  def __init__(self, *args, **kwargs):
    self.tail = collections.deque(maxlen=SIZE)
    Player.__init__(self, *args, **kwargs)

  def reset(self):
    Player.reset(self)
    self.buffered_move = ZERO_2D
    self.last_move_input_time = 0
    self.score = config["START_LENGTH"]
    self.tail.clear()
    self.shrinking = False
    for i in range(config["START_LENGTH"]):
      self.tail.append(self.initial_position)

  def setup_for_game(self):
    Player.setup_for_game(self)
    self.score = config["START_LENGTH"]
    self.tail.clear()
    self.shrinking = False
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

  def move_delay(self):
    speed = config["SNAKE_MOVE_FREQ"] * sqrt(config["START_LENGTH"]/len(self.tail))
    if len(neighbors[self.position]) == 4:
      speed *= 1 + config["INTERSECTION_PAUSE_FACTOR"]
    if len(neighbors[self.prev_pos]) == 4:
      speed *= 1 / (1 + config["INTERSECTION_PAUSE_FACTOR"]/2)
    return speed

  def cant_move(self):
    return time() - self.last_move_time < self.move_delay() # just moved

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
        dot *= 1 - config["MOVE_BIAS"]
      if n == self.prev_pos:
        dot *= 0.1

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
      broadcast_state()

    for player in current_players():
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

    move_freq = config["SNAKE_MOVE_FREQ"] * sqrt(config["START_LENGTH"]/len(self.tail))
    self.last_move_time += move_freq
    self.last_move_time = max(self.last_move_time, time() - move_freq)

    self.tail.appendleft(self.position)
    if statuses[self.position] == "apple":
      if len(self.tail) > self.score:
        self.score = len(self.tail)
        self.score_timestamp = time()

      statuses[self.position] = "blank"
      if engine.game_state != start_state:
        spawn("apple")
      broadcast_state()
    else:
      self.tail.pop()


  def to_json(self):
    dictionary = Player.to_json(self)
    dictionary["length"] = len(self.tail)
    dictionary["vibrating"] = self.shrinking
    return dictionary

  def render(self):
    if not self.is_alive:
      return
    for position in self.tail:
      if position != self.position:
        add_color_to_pixel(position, self.current_color()/8)
    add_color_to_pixel(self.position, self.current_color())