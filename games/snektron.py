#!/usr/bin/env python

import numpy as np
import os
import sys

from math import ceil, floor, pi, cos, sin
from time import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
from engine import *


config["SNEK_ROUND_TIME"] = 94.6
config["START_LENGTH"] = 4
config["SANDBOX_APPLES_PER_SNEK"] = 15
config["ADDITIONAL_APPLES"] = 25
config["INTERSECTION_PAUSE_FACTOR"] = 0.2
config["SNAKE_MOVE_FREQ"] = 0.25
config["SHRINK_FREQ"] = 0.03



class Snektron(Game):
  name = __name__

  def countdown_ontimeout(self):
    Game.countdown_ontimeout(self)
    data["current_leader"] = -1

  def start_update(self):
    for player in claimed_players():
      player.move()

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

  def countdown_ontimeout(self):
    Game.countdown_ontimeout(self)
    for i in range(len(playing_players()) + config["ADDITIONAL_APPLES"]):
      spawn("apple")

  def render_game(self):
    for i in range(SIZE):
      if statuses[i] == "apple":
        color_pixel(i, (10, 10, 10))




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
    self.shrinking = 0
    for i in range(config["START_LENGTH"]):
      self.tail.append(self.initial_position)

  def setup_for_game(self):
    Player.setup_for_game(self)
    self.score = config["START_LENGTH"]
    self.tail.clear()
    self.shrinking = 0
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
    if not self.shrinking and len(self.tail) > config["START_LENGTH"]:
      self.shrinking = time()
      sounds["hurt"].play()

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
      self.shrinking = 0
    if self.shrinking and time() - self.shrinking > config["SHRINK_FREQ"]:
      self.tail.popleft()
      self.position = self.tail[0]
      self.prev_pos = self.tail[1]
      self.shrinking = time()

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
      if game.state != "start":
        spawn("apple")
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


game = Snektron(Snek, battle_music="snekBattle")
