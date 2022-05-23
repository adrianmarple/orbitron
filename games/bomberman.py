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


config["BOMB_FUSE_TIME"] = 3
config["BOMB_EXPLOSION_TIME"] = 0.9 # Should be less than INVUNERABILITY_TIME
config["STARTING_BOMB_POWER"] = 4 # 2
config["PICKUP_CHANCE"] = 0.3
config["NUM_WALLS"] = 60
config["WALL_SPAWN_TIME"] = 5
config["SANDBOX_WALL_NUM"] = 20
config["BOMB_MOVE_FREQ"] = 0.07
config["USE_SHIELDS"] = True
config["DEATHMATCH"] = False
config["TARGET_KILL_COUNT"] = 5
config["BATTLE_ROYALE_DURATION"] = 150
config["DEATH_CREEP_DURATION"] = 60
config["SUICIDE_STUN"] = True
config["EXPLODE_ON_IMPACT"] = False
config["FIXED_OWNERSHIP"] = False
config["TAP_TO_DETONATE"] = False
config["NEWTONS_CRADLE"] = True
config["TAP_BOMB_KICK"] = True
config["AUTO_KICK"] = False
config["MAX_BOMBS"] = 3


explosion_providence = [None] * SIZE

class Rhomberman(Game):
  name = __name__
  previous_wall_generation_time = 0


  def start_update(self):
    for player in claimed_players():
      player.move()

    wall_count = 0
    for status in statuses:
      if status == "wall":
        wall_count += 1
    for i in range(config["SANDBOX_WALL_NUM"] - wall_count):
      spawn("wall")



  def countdown_ontimeout(self):
    for player in playing_players():
      player.tap = 0 # Prevent bombs from being placed due to taps during countdown

    for i in range(config["NUM_WALLS"]):
      spawn("wall")

    Game.countdown_ontimeout(self)
    if config["DEATHMATCH"]:
      self.end_time = 0
    else:
      self.end_time = time() + config["BATTLE_ROYALE_DURATION"]
    self.previous_wall_generation_time = time()


  def play_update(self):
    for player in playing_players():
      player.move()

    if time() - self.previous_wall_generation_time > config["WALL_SPAWN_TIME"]:
      spawn("wall")
      self.previous_wall_generation_time = time()

    if config["DEATHMATCH"]:
      for player in playing_players():
        if player.kill_count >= config["TARGET_KILL_COUNT"]:
          Game.play_ontimeout(self)
          engine.victor = player
          break
    else:
      # Timer death creep from south pole
      phase = (self.end_time - time()) / config["DEATH_CREEP_DURATION"]
      threshold = COORD_MAGNITUDE * (1 - 2 * phase)
      threshold = min(threshold, COORD_MAGNITUDE * 0.8)
      for i in range(SIZE):
        z = unique_coords[i][2]
        if z < threshold:
          statuses[i] = "death"
          explosion_providence[i] = None

      live_player_count = 0
      last_player_alive = players[0]
      for player in playing_players():
        if player.is_alive:
          live_player_count += 1

        if player.is_alive or (not last_player_alive.is_alive and
            player.hit_time > last_player_alive.hit_time):
          last_player_alive = player

      # GAME OVER
      if live_player_count <= 1:
        Game.play_ontimeout(self)
        engine.victor = last_player_alive


  def render_game(self):
    for player in current_players():
      player.render_ghost_trail()

    for i in range(SIZE):
      if statuses[i] == "blank":
        # already handled
        pass
      elif statuses[i] == "death":
        color_pixel(i, (10, 0, 0))
      elif statuses[i] == "wall":
        color_pixel(i, (11, 9, 9))
      elif statuses[i] == "power_pickup":
        magnitude = 0.3 + 0.1 * sin(40*time() + i)
        magnitude = magnitude * magnitude
        color_pixel(i, np.array((180,100,140)) * magnitude)
      elif statuses[i] < time():
        statuses[i] = "blank"
        color_pixel(i, (0, 0, 0))
      else:
        render_explosion(i)



def render_explosion(index):
  x = 1 + (time() - statuses[index]) / config["BOMB_EXPLOSION_TIME"]
  if (x >= 0):
    sequence = explosion_providence[index].current_color_sequence()
    x *= len(sequence) - 1
    color_pixel(index, multi_lerp(x, sequence))


def is_pixel_blank(index):
  status = statuses[index]
  return status == "blank" 


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
    self.bomb_power = config["STARTING_BOMB_POWER"]
    self.kill_count = 0
    self.death_count = 0
    self.has_shield = config["USE_SHIELDS"]
    Player.reset(self)

  def set_ready(self):
    self.bombs = []
    Player.set_ready(self)

  def setup_for_game(self):
    Player.setup_for_game(self)
    self.bombs = []
    self.has_shield = config["USE_SHIELDS"]
    self.bomb_power = config["STARTING_BOMB_POWER"]

  def current_color_sequence(self):
    return self.explosion_color_sequence

  def is_occupied(self, position):
    if Player.is_occupied(self, position):
      return True

    for player in current_players():
      for bomb in player.bombs:
        if bomb.position == position:
          if bomb.move(self.position):
            # Successful bomb kick!
            sounds["kick"].play()
            if not config["FIXED_OWNERSHIP"]:
              # Transfer owenership on bomb kick
              bomb.bump_owner(self)
          else:
            return True

    return False

  def move(self):
    pos = self.position

    # resolve existing bombs
    for bomb in self.bombs.copy():
      bomb.resolve()

      if bomb.has_exploded and time() - bomb.explosion_time > SHOCKWAVE_DURATION:
        self.bombs.remove(bomb)



    if self.is_alive and statuses[pos] == "death":
      sounds["death"].play()
      self.death_count += 1
      self.is_alive = False
      return

    # non-blank status means either explosion or death
    if not is_pixel_blank(pos) and time() - self.hit_time > config["INVULNERABILITY_TIME"]:

      # Hurt
      killer = explosion_providence[pos]
      suicide = killer == self
      if suicide and config["SUICIDE_STUN"]:
        self.stunned = True
      else:
        self.stunned = False

        if game.state == "start":
          pass
        elif self.has_shield:
          self.has_shield = False
        else:
          self.death_count += 1
          if not config["DEATHMATCH"]:
            self.is_alive = False
          if suicide:
            self.kill_count -= 1
          elif killer:
            killer.kill_count += 1
            killer.score_timestamp = time()

      if self.is_alive:
        sounds["hurt"].play()
      else:
        sounds["death"].play()

      self.hit_time = time()


    # Try to place bomb if tapped
    tap = self.tap
    self.tap = 0 # consume tap signal

    if time() - tap < 0.1 and not self.stunned:
      if config["TAP_TO_DETONATE"] and len(self.bombs) > 0:
        for bomb in self.bombs:
          bomb.explode()
      else:
        can_place_bomb = self.is_alive and not self.stunned and len(self.bombs) < config["MAX_BOMBS"]
        for bomb in self.bombs:
          if pos == bomb.position:
            can_place_bomb = False
            if config["TAP_BOMB_KICK"] and bomb.move(self.prev_pos):
              sounds["kick"].play()

        if can_place_bomb:
          sounds["placeBomb"].play()
          bomb = Bomb(self)
          self.bombs.append(bomb)
          if config["AUTO_KICK"]:
            bomb.move(self.prev_pos)


    Player.move(self)
    # self.position is likely to have updated

    # Player clears away explosions when walking on them
    if not is_pixel_blank(self.position):
      statuses[pos] = "blank"
    if statuses[self.position] == "power_pickup":
      self.bomb_power += 1
      statuses[self.position] = "blank"


  def render(self):
    color = self.current_color()
    for bomb in self.bombs:
      bomb_factor = bomb.render()
      if bomb.position == self.position:
        color = color * (0.1 + bomb_factor * 1.2)

    if config["USE_SHIELDS"] and not self.has_shield:
      color = color / 12;

    flash_time = config["STUN_TIME"] if self.stunned else config["INVULNERABILITY_TIME"]
    if time() - self.hit_time < flash_time:
      factor = (time() * 2) % 1
      if self.stunned:
        factor = 1 - factor
        factor *= 0.7
      else:
        factor *= 1.3
      color = color * factor * factor

    if self.is_alive:
      color_pixel(self.position, color)

  def to_json(self):
    dictionary = Player.to_json(self)
    dictionary["bombPower"] = self.bomb_power
    dictionary["score"] = self.kill_count
    dictionary["deathCount"] = self.death_count

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
    new_pos = next_pixel.get(str((prev_pos, self.position)), None)
    if new_pos is None:
      return True

    occupied = statuses[new_pos] == "wall"

    for player in current_players():
      if not player.is_alive:
        continue

      if player.position == new_pos:
        occupied = True
        break

      for bomb in player.bombs:
        if bomb.position == new_pos:
          if config["NEWTONS_CRADLE"]:
            bomb_next = next_pixel.get(str((bomb.prev_pos, bomb.position)), None)
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
      render_pulse(
        direction=-unique_coords[self.position],
        color=(16, 16, 16),
        start_time=self.explosion_time,
        duration=SHOCKWAVE_DURATION)
      return 0

    x = config["BOMB_FUSE_TIME"] + self.timestamp - time()
    x += 4
    x = (300 / x)
    factor = (sin(x)+1.4) * 0.3
    factor *= factor
    color = self.owner.current_color() * factor
    color_pixel(self.position, color)
    return factor

  def resolve(self):
    if self.has_exploded:
      return

    impacted = False
    if self.position != self.prev_pos and time() - self.last_move_time > config["BOMB_MOVE_FREQ"]:
      impacted = not self.move(self.prev_pos)

    # Fuse has run out or hit by an explosion
    if time() - self.timestamp >= config["BOMB_FUSE_TIME"] or \
        not is_pixel_blank(self.position) or \
        (impacted and config["EXPLODE_ON_IMPACT"]):
      self.explode()

  def explode(self):
    if self.has_exploded:
      return

    # Propagate ownership if triggered by other bomb
    #if not is_pixel_blank(self.position) and statuses[self.position] != "death":
    #  self.bump_owner(explosion_providence[self.position])

    sounds["explosion"].play()
    finish_time = time() + config["BOMB_EXPLOSION_TIME"]

    statuses[self.position] = finish_time
    explosion_providence[self.position] = self.owner
    for neighbor in neighbors[self.position]:
      direction = (self.position, neighbor)
      for i in range(self.power):
        next_pos = direction[1]

        if statuses[next_pos] == "wall":
          if random() < config["PICKUP_CHANCE"]:
            statuses[next_pos] = "power_pickup"
          else:
            statuses[next_pos] = "blank"
          break

        finish_time = time() + config["BOMB_EXPLOSION_TIME"] + (i+1)/32
        statuses[next_pos] = finish_time
        explosion_providence[next_pos] = self.owner
        direction = (next_pos, next_pixel[str(direction)])

    self.has_exploded = True
    self.explosion_time = time()

  def bump_owner(self, new_owner):
    if new_owner:
      self.owner = new_owner


game = Rhomberman(Bomberman)
