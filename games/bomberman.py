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
Game = engine.Game
Player = engine.Player

additional_settings = {
  "BOMB_FUSE_TIME": 3,
  "BOMB_EXPLOSION_TIME": 0.9, # Should be less than INVUNERABILITY_TIME
  "STARTING_BOMB_POWER": 4,
  "PICKUP_CHANCE": 0, #0.3
  "NUM_WALLS": 60,
  "WALL_SPAWN_TIME": 10,
  "BOMB_MOVE_FREQ": 0.07,
  "USE_SHIELDS": True,
  "ROUND_TIME": 150,
  "DEATH_CREEP_DURATION": 60,
  "FIXED_OWNERSHIP": True,
  "NEWTONS_CRADLE": True,
  "TAP_BOMB_KICK": True,
  "MAX_BOMBS": 3,
  "SHOCKWAVE_DURATION": 0.5,
}

class Rhomberman(Game):
  previous_wall_generation_time = 0
  explosion_providence = [None] * engine.SIZE

  def countdown_ontimeout(self):
    for player in self.claimed_players():
      player.tap = 0 # Prevent bombs from being placed due to taps during countdown

    self.clear()
    for i in range(self.NUM_WALLS):
      self.spawn("wall")

    Game.countdown_ontimeout(self)
    self.previous_wall_generation_time = time()


  def play_update(self):
    for player in self.claimed_players():
      player.move()

    if time() - self.previous_wall_generation_time > self.WALL_SPAWN_TIME:
      self.spawn("wall")
      self.previous_wall_generation_time = time()

    # Timer death creep from south pole
    phase = (self.end_time - time()) / self.DEATH_CREEP_DURATION
    threshold = 1 - 2 * phase
    threshold = min(threshold, 0.8)
    for i in range(engine.SIZE):
      z = engine.coords[i][engine.UP]
      if z < threshold:
        self.statuses[i] = "death"
        self.explosion_providence[i] = None

    live_player_count = 0
    last_player_alive = self.players[0]
    for player in self.claimed_players():
      if player.is_alive:
        live_player_count += 1

      if player.is_alive or (not last_player_alive.is_alive and
          player.hit_time > last_player_alive.hit_time):
        last_player_alive = player

    # GAME OVER
    if live_player_count <= 1:
      Game.play_ontimeout(self)
      self.victors = [last_player_alive]


  def render_game(self):
    for player in self.claimed_players():
      player.render_ghost_trail()

    for i in range(len(self.statuses)):
      if self.statuses[i] == "blank":
        # already handled
        pass
      elif self.statuses[i] == "death":
        engine.color_pixel(i, engine.BAD_COLOR / 16)
      elif self.statuses[i] == "wall":
        engine.color_pixel(i, (11, 9, 9))
      elif self.statuses[i] == "power_pickup":
        magnitude = 0.3 + 0.1 * sin(20*time() + i)
        magnitude = magnitude * magnitude
        engine.color_pixel(i, engine.GOOD_COLOR * magnitude)
      elif self.statuses[i] < time():
        self.statuses[i] = "blank"
        engine.color_pixel(i, (0, 0, 0))
      else:
        x = 1 + (time() - self.statuses[i]) / self.BOMB_EXPLOSION_TIME
        if (x >= 0):
          sequence = self.explosion_providence[i].explosion_color_sequence
          x *= len(sequence) - 1
          engine.color_pixel(i, engine.multi_lerp(x, sequence))


  def is_pixel_blank(self, index):
    return self.statuses[index] == "blank"

# ================================ PLAYER =========================================

class Bomberman(Player):
  def __init__(self, *args, **kwargs):
    Player.__init__(self, *args, **kwargs)

    self.explosion_color_sequence = [
      (0, self.color),
      (1, self.color/3),
      (1, np.array((40,0,0))),
      (1, np.array((10,0,0))),
    ]


  def reset(self):
    self.bombs = []
    self.bomb_power = game.STARTING_BOMB_POWER
    self.has_shield = game.USE_SHIELDS
    self.opacity = 1
    Player.reset(self)

  def set_ready(self):
    self.bombs = []
    Player.set_ready(self)

  def setup_for_game(self):
    Player.setup_for_game(self)
    self.bombs = []
    self.has_shield = game.USE_SHIELDS
    self.bomb_power = game.STARTING_BOMB_POWER

  def current_color(self):
    color = self.color * self.opacity
    if game.USE_SHIELDS and not self.has_shield:
      return color / 12
    else:
      return color

  def is_occupied(self, position):
    if Player.is_occupied(self, position):
      return True

    for player in game.claimed_players():
      for bomb in player.bombs:
        if bomb.position == position:
          if bomb.move(self.position):
            # Successful bomb kick!
            sounds["kick"].play()
          else:
            return True

    return False

  def move(self):
    pos = self.position

    # resolve existing bombs
    for bomb in self.bombs.copy():
      bomb.resolve()

      if bomb.has_exploded and time() - bomb.explosion_time > game.SHOCKWAVE_DURATION:
        self.bombs.remove(bomb)

    if not self.is_alive:
      return False

    if game.statuses[pos] == "death":
      sounds["death"].play()
      self.is_alive = False
      return False

    # non-blank status means either explosion or death
    if not game.is_pixel_blank(pos) and time() - self.hit_time > game.INVULNERABILITY_TIME:
      # Hurt
      if game.state == "start":
        pass
      elif self.has_shield:
        self.has_shield = False
      else:
        self.is_alive = False

      if self.is_alive:
        sounds["hurt"].play()
      else:
        sounds["death"].play()

      self.hit_time = time()


    # Try to place bomb if tapped
    tap = self.tap
    self.tap = 0 # consume tap signal

    if time() - tap < 0.1:
      can_place_bomb = self.is_alive and len(self.bombs) < game.MAX_BOMBS
      for bomb in self.bombs:
        if pos == bomb.position:
          can_place_bomb = False
          if game.TAP_BOMB_KICK and bomb.move(self.prev_pos):
            sounds["kick"].play()

      if can_place_bomb:
        sounds["placeBomb"].play()
        bomb = Bomb(self)
        self.bombs.append(bomb)


    Player.move(self)
    # self.position is likely to have updated

    # Player clears away explosions when walking on them
    if not game.is_pixel_blank(self.position):
      game.statuses[pos] = "blank"
    if game.statuses[self.position] == "power_pickup":
      self.bomb_power += 1
      game.statuses[self.position] = "blank"


  def render(self):
    self.opacity = 1
    for bomb in self.bombs:
      bomb_factor = bomb.render()
      if bomb.position == self.position:
        self.opacity =  (0.1 + bomb_factor * 1.2)

    Player.render(self)

  def to_json(self):
    dictionary = Player.to_json(self)
    dictionary["bombPower"] = self.bomb_power

    return dictionary


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
  def __init__(self, player):
    self.owner = player
    self.position = player.position
    self.prev_pos = player.position
    self.last_move_time = time()
    self.timestamp = time()
    self.power = player.bomb_power
    self.has_exploded = False
    self.explosion_time = 0

  def move(self, prev_pos):
    new_pos = engine.next_pixel.get(str((prev_pos, self.position)), None)
    if new_pos is None:
      return True

    occupied = game.statuses[new_pos] == "wall"

    for player in game.claimed_players():
      if not player.is_alive:
        continue

      if player.position == new_pos:
        occupied = True
        break

      for bomb in player.bombs:
        if bomb.position == new_pos:
          if game.NEWTONS_CRADLE:
            bomb_next = engine.next_pixel.get(str((bomb.prev_pos, bomb.position)), None)
            if bomb_next == self.position:
              bomb.prev_pos = bomb.position
            else:
              bomb.move(self.position)
          occupied = True
          break

      if occupied:
        break

    self.prev_pos = self.position
    if not occupied:
      self.position = new_pos
      self.last_move_time = time()

    return not occupied


  def render(self):
    if self.has_exploded:
      engine.render_pulse(
        direction=engine.coords[self.position],
        color=(16, 16, 16),
        start_time=self.explosion_time,
        duration=game.SHOCKWAVE_DURATION,
        reverse=True)
      return 0

    x = game.BOMB_FUSE_TIME + self.timestamp - time()
    x += 4
    x = (300 / x)
    factor = (sin(x)+1.4) * 0.3
    factor *= factor
    color = self.owner.current_color() * factor
    engine.color_pixel(self.position, color)
    return factor

  def resolve(self):
    if self.has_exploded:
      return

    impacted = False
    if self.position != self.prev_pos and time() - self.last_move_time > game.BOMB_MOVE_FREQ:
      impacted = not self.move(self.prev_pos)

    # Fuse has run out or hit by an explosion
    if time() - self.timestamp >= game.BOMB_FUSE_TIME or \
        not game.is_pixel_blank(self.position):
      self.explode()

  def explode(self):
    if self.has_exploded:
      return

    sounds["explosion"].play()
    finish_time = time() + game.BOMB_EXPLOSION_TIME

    game.statuses[self.position] = finish_time
    game.explosion_providence[self.position] = self.owner
    for neighbor in engine.neighbors[self.position]:
      direction = (self.position, neighbor)
      for i in range(self.power):
        next_pos = direction[1]

        if game.statuses[next_pos] == "wall":
          if random() < game.PICKUP_CHANCE:
            game.statuses[next_pos] = "power_pickup"
          else:
            game.statuses[next_pos] = "blank"
          break

        finish_time = time() + game.BOMB_EXPLOSION_TIME + (i+1)/32
        game.statuses[next_pos] = finish_time
        game.explosion_providence[next_pos] = self.owner
        direction = (next_pos, engine.next_pixel[str(direction)])

    self.has_exploded = True
    self.explosion_time = time()

  def bump_owner(self, new_owner):
    if new_owner:
      self.owner = new_owner


game = Rhomberman(additional_settings)
game.generate_players(Bomberman)
