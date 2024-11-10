#!/usr/bin/env python

import collections
import numpy as np
import os
import sys

from math import ceil, floor, pi, cos, sin, sqrt
from time import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
import engine
Game = engine.Game
Player = engine.Player

additional_settings = {
  "CONTINUOUS_MOVEMENT": True,
  "ROUND_TIME": 94.6,
  "START_LENGTH": 4,
  "SANDBOX_APPLES_PER_SNEK": 15,
  "ADDITIONAL_APPLES": 25,
  "MOVE_FREQ": 0.25,
  "SHRINK_FREQ": 0.03,
  "SELECTION_WEIGHTS": [1, 1, 1, 1, 1, 1],
}

class Snektron(Game):
  battle_music = "snekBattle"

  def countdown_ontimeout(self):
    Game.countdown_ontimeout(self)
    for i in range(len(self.claimed_players()) + self.ADDITIONAL_APPLES):
      self.spawn("apple")

  def render_game(self):
    for i in range(len(self.statuses)):
      if self.statuses[i] == "apple":
        engine.color_pixel(i, engine.GOOD_COLOR/4)




# ================================ PLAYER =========================================

class Snek(Player):
  def __init__(self, *args, **kwargs):
    self.tail = collections.deque(maxlen=engine.SIZE)
    Player.__init__(self, *args, **kwargs)

  def reset(self):
    Player.reset(self)
    self.buffered_move = engine.ZERO_2D
    self.last_move_input_time = 0
    self.score = game.START_LENGTH
    self.tail.clear()
    self.shrinking = 0
    for i in range(game.START_LENGTH):
      self.tail.append(self.position)

  def set_ready(self):
    Player.set_ready(self)
    self.tail.clear()
    self.shrinking = 0
    for i in range(game.START_LENGTH):
      self.tail.append(self.position)

    self.score = game.START_LENGTH


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
    if not self.shrinking and len(self.tail) > game.START_LENGTH:
      self.shrinking = time()
      sounds["hurt"].play()

  def move_delay(self):
    # Speed up the longer your snake gets
    return Player.move_delay(self) * sqrt(game.START_LENGTH/len(self.tail))

  def cant_move(self):
    return time() - self.last_move_time < self.move_delay() # just moved

  def move(self):
    if len(self.tail) <= game.START_LENGTH:
      self.shrinking = 0
    if self.shrinking and time() - self.shrinking > game.SHRINK_FREQ:
      self.tail.popleft()
      self.position = self.tail[0]
      self.prev_pos = self.tail[1]
      self.shrinking = time()

    for player in game.claimed_players():
      if player == self:
        if player.tail_occupies(self.position):
          self.die()
      elif player.occupies(self.position):
        self.die()
        if player.position==self.position:
          player.die()

    if not Player.move(self):
      return

    self.tail.appendleft(self.position)
    if game.statuses[self.position] == "apple":
      if len(self.tail) > self.score:
        self.score = len(self.tail)
        self.score_timestamp = time()

      game.statuses[self.position] = "blank"
      if game.state != "start":
        game.spawn("apple")
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
        engine.add_color_to_pixel(position, self.current_color()/8)
    engine.add_color_to_pixel(self.position, self.current_color())


game = Snektron(additional_settings)
game.generate_players(Snek)
