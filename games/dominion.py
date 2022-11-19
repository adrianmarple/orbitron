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
  "ROTATION_SPEED": 0.01,
  "PUSH_COOLDOWN": 3,
  "PUSH_DISTANCE": 4,
  "PUSH_MOVE_FREQ": 0.1,
  "MOVE_FREQ": 0.28,
  "SELECTION_WEIGHTS": [0, 0, 1, 1, 1, 1],
  "NUM_SPOTLIGHTS": 3,
  "DOMAIN_THRESHOLD": 50, 
  "EXCLUDED_TOPOLOGIES": ["wall"],
}

class Dominion(Game):
  name = __name__
  leader = None

  spotlights = []

  def countdown_ontimeout(self):
    Game.countdown_ontimeout(self)
    self.spotlights.clear()
    for i in range(self.NUM_SPOTLIGHTS):
      self.spotlights.append(Spotlight())

  def play_update(self):
    for player in self.claimed_players():
      player.move()
      for spotlight in self.spotlights:
        spotlight.alter_ownership(player)

    for spotlight in self.spotlights:
      spotlight.light_up()
      spotlight.update_score()

  def render_game(self):
    for spotlight in self.spotlights:
      spotlight.render()


class Domineer(Player):
  last_push_time = 0
  push_count = 0

  def move(self):
    if self.push_count > 0:
      if time() - self.last_push_time < game.PUSH_MOVE_FREQ:
        return

      self.push_count -= 1
      next_pos = engine.next_pixel.get(str((self.prev_pos, self.position)), None)
      player_in_way = None
      for player in game.claimed_players():
        if player.position == next_pos:
          player_in_way = player

      if player_in_way is not None:
        sounds["kick"].play()
        player_in_way.push_count = game.PUSH_DISTANCE
        player_in_way.prev_pos = self.position
        self.push_count = 0
      elif next_pos is not None:
        self.prev_pos = self.position
        self.position = next_pos
        self.last_push_time = time()
      return


    Player.move(self)

    if time() - self.last_push_time < game.PUSH_COOLDOWN:
      return

    tap = self.tap
    self.tap = 0 # consume tap signal

    if time() - tap < 0.1:
      #self.last_push_time = time()
      self.push_count = game.PUSH_DISTANCE


  def current_color(self):
    if time() - self.last_push_time < game.PUSH_COOLDOWN:
      return self.color / 8
    else:
      return self.color

class Spotlight():
  def __init__(self):
    self.orientation = engine.random_unit_vector()
    self.rotation_axis = engine.random_unit_vector()
    self.secondary_rotation_axis = engine.random_unit_vector()
    self.lit_pixels = np.array((0,0,0)) * engine.coord_matrix
    self.owner = None
    self.locked_in = False
    self.amount_owned = 0


  def light_up(self):
    self.lit_pixels *= 0

    self.secondary_rotation_axis = engine.rotate(self.secondary_rotation_axis, self.orientation, game.ROTATION_SPEED/40 )
    self.rotation_axis = engine.rotate(self.rotation_axis, self.secondary_rotation_axis, game.ROTATION_SPEED/10 )
    self.orientation = engine.rotate(self.orientation, self.rotation_axis, game.ROTATION_SPEED)

    ds = self.orientation * engine.coord_matrix - game.DOMAIN_OFFSET
    ds = np.maximum(ds, 0)
    self.lit_pixels += np.sign(ds)

  def render(self):
    color = np.array((10,10,10))
    if self.owner is None:
      pass
    elif self.amount_owned >= game.DOMAIN_THRESHOLD:
      color = self.owner.current_color() / 4
    else:
      ownership_fraction = self.amount_owned * 1.0 / game.DOMAIN_THRESHOLD
      color = ownership_fraction * self.owner.current_color() / 10 + (1 - ownership_fraction) * color

    if self.locked_in:
      color *= 0.6 + sin(time() * 10) * 0.4

    engine.pixels += np.array(np.outer(self.lit_pixels, color), dtype="<u1")

  
  def alter_ownership(self, player):
    if not self.lit_pixels[0, player.position]:
      return

    if self.amount_owned == 0:
      self.owner = player

    if player == self.owner:
      if self.amount_owned < game.DOMAIN_THRESHOLD:
        self.amount_owned += 1
    else:
      self.amount_owned -= 1

    if self.amount_owned <= 0:
      self.locked_in = False

    if self.amount_owned >= game.DOMAIN_THRESHOLD:
      self.locked_in = True

  def update_score(self):
    if self.locked_in:
      self.owner.score += 1


game = Dominion(additional_config)
game.generate_players(Domineer)
