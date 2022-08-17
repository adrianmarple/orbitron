#!/usr/bin/env python

import numpy as np
import os
import sys

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random, choice
from time import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
import engine
Game = engine.Game
Player = engine.Player

additional_config = {
  "CONTINUOUS_MOVEMENT": True,
  "LIVES": 3,
  "STARTING_SPAWN_DELAY": 8,
  "ENDING_SPAWN_DELAY": 3,
  "MIN_INVADER_MOVE_FREQ": 0.3,
  "MAX_INVADER_MOVE_FREQ": 0.5,
  "PULSE_DURATION": 0.75,
  "ROUND_TIME": 90,
  "SELECTION_WEIGHTS": [0, 0.5, 1, 1, 1, 1],
}


class BaseDefense(Game):
  name = __name__

  invaders = []
  previous_spawn_time = 0

  def restart(self):
    Game.restart(self)
    self.invaders = []
    self.data["lives"] = self.LIVES

  def play_ontimeout(self):
    Game.play_ontimeout(self)
    self.victors = self.claimed_players()

  def play_update(self):
    for player in self.claimed_players():
      player.move()
    for invader in self.invaders:
      invader.move()

    if self.data["lives"] <= 0:
      self.play_ontimeout()
      self.victors = engine.ENEMY_TEAM


    game_completion = 1 - (self.end_time - time()) / self.ROUND_TIME
    spawn_delay = game_completion * self.ENDING_SPAWN_DELAY + \
        (1 - game_completion) * self.STARTING_SPAWN_DELAY
    spawn_delay /= len(self.claimed_players())
    if time() - self.previous_spawn_time > spawn_delay:
      self.invaders.append(Invader())
      self.previous_spawn_time = time()


  def render_game(self):
    for pos in engine.north_pole:
      engine.color_pixel(pos, engine.BAD_COLOR)
    for pos in engine.south_pole:
      engine.color_pixel(pos, engine.GOOD_COLOR)

    for invader in self.invaders:
      invader.render()


# ================================ PLAYER =========================================

class Defender(Player):
  def move(self):
    Player.move(self)
    for invader in game.invaders:
      if invader.is_alive and invader.position == self.position:
        invader.color = engine.GOOD_COLOR
        invader.die()


class Invader(Player):
  def __init__(self):
    Player.__init__(self,
      position=choice(engine.north_pole),
      color=engine.BAD_COLOR,
      color_string=engine.BAD_COLOR_STRING)
    self.move_freq = game.MIN_INVADER_MOVE_FREQ + random() * (
      game.MAX_INVADER_MOVE_FREQ - game.MIN_INVADER_MOVE_FREQ)

  def die(self):
    self.is_alive = False
    self.hit_time = time()

  def get_next_position(self):
    my_z = engine.coords[self.position][2]
    weights = []
    neighbors = engine.neighbors[self.position]
    for neighbor in neighbors:
      weight = my_z - engine.coords[neighbor][2]
      if weight > 0:
        weights.append(weight)
      else:
        weights.append(0)

    next_pos = engine.weighted_random(weights=weights, values=neighbors)
    if next_pos is None:
      return self.position
    else:
      return next_pos


  def cant_move(self):
    return not self.is_alive or time() - self.last_move_time < self.move_freq

  def is_occupied(self, position):
    return False

  def move(self):
    if not self.is_alive and time() - self.hit_time > game.PULSE_DURATION:
      game.invaders.remove(self)
      return

    if not Player.move(self):
      return

    if self.position in engine.south_pole:
      game.data["lives"] -= 1
      self.die()

  def render(self):
    if time() - self.hit_time < game.PULSE_DURATION:
      engine.render_pulse(
        direction=engine.coords[self.position],
        color=self.current_color(),
        start_time=self.hit_time,
        duration=game.PULSE_DURATION/2)

    Player.render(self)


game = BaseDefense(additional_config)
game.generate_players(Defender)
