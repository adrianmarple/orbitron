#!/usr/bin/env python

import os
import sys

from math import floor, pi, cos, sin, sqrt
from time import time
import numpy as np

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
import engine
Game = engine.Game
Player = engine.Player

additional_config = {
  "DOMAIN_OFFSET": 0.93,
  "ROTATION_SPEED": 0.02,
  "PUSH_COOLDOWN": 3,
  "PUSH_DISTANCE": 3,
  "PUSH_MOVE_FREQ": 0.1,
  "MOVE_FREQ": 0.28,
  "SELECTION_WEIGHTS": [0, 0, 1, 1, 1, 1],
}

class Dominion(Game):
  name = __name__
  leader = None

  spotlights = [
    engine.random_unit_vector(),
    engine.random_unit_vector(),
    engine.random_unit_vector()
  ]
  rotation_axes = [
    engine.random_unit_vector(),
    engine.random_unit_vector(),
    engine.random_unit_vector()
  ]
  lit_pixels = np.array((0,0,0)) * engine.coord_matrix

  def play_update(self):
    for player in self.claimed_players():
      player.move()

    self.lit_pixels *= 0
    for (i, spotlight) in enumerate(self.spotlights):
      axis1 = self.rotation_axes[i]
      axis2 = self.rotation_axes[(i+1) % len(self.spotlights)]
      angle = self.ROTATION_SPEED/10 # TODO make delta_time based
      axis1 = engine.rotate(axis1, axis2, angle)
      self.rotation_axes[i] = axis1
      angle = self.ROTATION_SPEED # TODO make delta_time based
      spotlight = engine.rotate(spotlight, axis1, angle)
      self.spotlights[i] = spotlight
      ds = spotlight * engine.coord_matrix - self.DOMAIN_OFFSET
      ds = np.maximum(ds, 0)
      self.lit_pixels += np.sign(ds)

    for player in self.claimed_players():
      player.score += self.lit_pixels[0, player.position]

  def render_game(self):
    engine.pixels += np.array(np.outer(self.lit_pixels, engine.GOOD_COLOR), dtype="<u1")


class Domineer(Player):
  last_push_time = 0
  push_count = 0

  def move(self):
    if self.push_count > 0:
      if time() - self.last_push_time < game.PUSH_MOVE_FREQ:
        return
      self.push_count -= 1
      next_pos = engine.next_pixel.get(str((self.prev_pos, self.position)), None)
      if next_pos is not None:
        self.prev_pos = self.position
        self.position = next_pos
        self.last_push_time = time()
      return


    Player.move(self)


    # Try to place bomb if tapped
    if time() - self.last_push_time < game.PUSH_COOLDOWN:
      return

    tap = self.tap
    self.tap = 0 # consume tap signal

    if time() - tap < 0.1:
      self.last_push_time = time()
      sounds["kick"].play()
      for player in game.claimed_players():
        if player.position in engine.neighbors[self.position]:
          player.push_count = game.PUSH_DISTANCE
          player.prev_pos = self.position


  def current_color(self):
    if time() - self.last_push_time < game.PUSH_COOLDOWN:
      return self.color / 8
    else:
      return self.color


game = Dominion(additional_config)
game.generate_players(Domineer)
