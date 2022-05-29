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
from engine import *


config["PACMEN_LIVES"] = 5
config["NUM_GHOSTS"] = 4
config["STARTING_POWER_PELLET_COUNT"] = 4
config["POWER_PELLET_DURATION"] = 10
config["PACMAN_MOVE_FREQ"] = 0.22
config["PACMAN_POWER_MOVE_FREQ"] = 0.18
config["GHOST_MOVE_FREQ"] = 0.22
config["GHOST_SCARED_MOVE_FREQ"] = 0.4
config["GHOST_RANDOMNESS"] = 0.5
config["PELLET_SCORE"] = 10
config["POWER_PELLET_SCORE"] = 50
config["GHOST_KILL_SCORE"] = 200
config["VICTORY_SCORE"] = 3000
config["MARGINAL_PACMAN_VICTORY_SCORE"] = 1000
config["PELLET_REGEN_FREQ"] = 1
config["POWER_PELLET_REGEN_FREQ"] = 30
config["SHARED_LIVES"] = True


data["score"] = 0
data["victory_score"] = 0
data["lives"] = config["PACMEN_LIVES"]
power_pulses = []

class PacMan(Game):
  name = __name__

  previous_pellet_generation_time = 0
  previous_power_pellet_generation_time = 0

  def setup(self):
    Game.setup(self)
    #North Pole Coords = 268-273 133-141 172
    Ghost(position=133)
    Ghost(position=137)
    Ghost(position=141)
    Ghost(position=172)
    Ghost(position=135)
    Ghost(position=139)
    Ghost(position=269)
    Ghost(position=272)
    Ghost(position=134)
    Ghost(position=138)

  def start_update(self):
    Game.start_update(self)

    ghost_count = 0
    num_ghosts = len(pacmen())
    for ghost in ghosts():
      ghost_count += 1
      ghost.is_playing = ghost_count <= num_ghosts

    self.spawn_pellets()

  def start_ontimeout(self):
    # Suppliment with AI ghosts
    ghost_count = 0
    num_ghosts = config["NUM_GHOSTS"] + len(pacmen())
    for ghost in ghosts():
      ghost_count += 1
      ghost.reset()
      ghost.is_playing = ghost_count <= num_ghosts

    Game.start_ontimeout(self)

    data["lives"] = config["PACMEN_LIVES"]
    data["victory_score"] = config["VICTORY_SCORE"] + len(pacmen_playing()) * config["MARGINAL_PACMAN_VICTORY_SCORE"]



  def countdown_ontimeout(self):
    for i in range(len(statuses)):
      statuses[i] = "pellet"
    for i in range(config["STARTING_POWER_PELLET_COUNT"]):
      statuses[randrange(len(statuses))] = "power"

    self.previous_pellet_generation_time = time()
    self.previous_power_pellet_generation_time = time()
    Game.countdown_ontimeout(self)


  def play_update(self):
    for player in playing_players():
      player.move()

    ghosts_win = True
    for player in playing_players():
      if player.is_pacman and player.is_alive:
        ghosts_win = False
        break

    if ghosts_win or data["lives"] <= 0:
      self.play_ontimeout()
      engine.victor = Dummy(
        name="Ghosts",
        color=(255, 0, 0),
        color_string="red")

    if data["score"] >= data["victory_score"]:
      self.play_ontimeout()
      engine.victor = Dummy(
        name="Pacmen",
        color=pacmen()[0].color,
        color_string=pacmen()[0].color_string)

    self.spawn_pellets()


  def spawn_pellets(self):
    if time() - self.previous_pellet_generation_time > config["PELLET_REGEN_FREQ"]:
      spawn("pellet")
      self.previous_pellet_generation_time = time()
    if time() - self.previous_power_pellet_generation_time > config["POWER_PELLET_REGEN_FREQ"]:
      spawn("power")
      self.previous_power_pellet_generation_time = time()


  def render_game(self):
    reversed_players = current_players()
    reversed_players.reverse()

    power_color = np.array((255,255,255))*(0.55 + 0.45*sin(time() * 16))
    for i in range(SIZE):
      if statuses[i] == "pellet":
        color_pixel(i, (10, 10, 10))
        #color_pixel(i, (50, 50, 50))
      elif statuses[i] == "power":
        color_pixel(i, power_color)

    for player in reversed_players:
      player.render()

    global power_pulses
    READY_PULSE_DURATION
    power_pulses = [pulse for pulse in power_pulses if time() < pulse[1] + READY_PULSE_DURATION]
    for (origin, start_time) in power_pulses:
      render_pulse(direction=-origin,
        color=(200,200,200),
        start_time=start_time,
        duration=READY_PULSE_DURATION)



def is_everyone_ready(minimum):
  return engine.is_everyone_ready(minimum) and len(pacmen()) > 0

def ghosts():
  return [player for player in players if not player.is_pacman]
def pacmen():
  return [player for player in players if player.is_pacman and player.is_claimed]
def pacmen_playing():
  return [player for player in players if player.is_pacman and player.is_playing]


# ================================ PLAYER =========================================

class Pacman(Player):
  def __init__(self, *args, **kwargs):
    #kwargs["color"] = (190, 195, 5)
    #kwargs["color_string"] = "#e7e023"
    Player.__init__(self, *args, **kwargs)
    self.is_pacman = True

  def reset(self):
    Player.reset(self)
    self.lives_left = config["PACMEN_LIVES"]
    self.power_pellet_end_time = 0

  def is_powerful(self):
    return time() < self.power_pellet_end_time

  def move_delay(self):
    if self.is_powerful() or time() - self.hit_time < config["INVULNERABILITY_TIME"]:
      return config["PACMAN_POWER_MOVE_FREQ"]
    else:
      return config["PACMAN_MOVE_FREQ"]

  def is_occupied(self, position):
    considered_players = claimed_players() if game.state == "start" else playing_players()
    for player in considered_players:
      if player.is_alive and player.is_pacman == self.is_pacman and player.position == position:
        return True
    return False

  def hit_check(self):
    if not self.is_alive:
      return

    for ghost in ghosts():
      if ghost.is_playing and ghost.position == self.position:
        if ghost.is_scared():
          sounds["kick"].play()
          ghost.stunned = True
          ghost.position = unique_antipodes[ghost.position]
          ghost.hit_time = time()
          ghost.power_pellet_end_time = 0 # ghost no longer scared
          data["score"] += config["GHOST_KILL_SCORE"]
          break
        elif time() - self.hit_time > config["INVULNERABILITY_TIME"]:
          self.hit_time = time()
          if config["SHARED_LIVES"]:
            data["lives"] -= 1
          else:
            self.lives_left -= 1
          if self.lives_left < 0:
            sounds["death"].play()
            self.is_alive = False
          else:
            sounds["hurt"].play()
          break


  def move(self):
    self.hit_check()
    if not self.is_alive:
      return
    Player.move(self)
    self.hit_check()

    # Pacman consumes pellets as they move
    if statuses[self.position] == "power":
      sounds["explosion"].play()
      power_pellet_end_time = time() + config["POWER_PELLET_DURATION"]
      for player in playing_players():
        player.power_pellet_end_time = power_pellet_end_time
      data["score"] += config["POWER_PELLET_SCORE"]
      statuses[self.position] = "blank"
      power_pulses.append((unique_coords[self.position], time()))
    elif statuses[self.position] == "pellet":
      data["score"] += config["PELLET_SCORE"]
      statuses[self.position] = "blank"

  def to_json(self):
    dictionary = Player.to_json(self)
    dictionary["isPacman"] = True
    dictionary["livesLeft"] = data["lives"] if config["SHARED_LIVES"] else self.lives_left
    return dictionary


class Ghost(Player):
  def __init__(self, *args, **kwargs):
    Player.__init__(self, *args, **kwargs)
    self.is_pacman = False
    self.set_color()

  def reset(self):
    Player.reset(self)
    self.power_pellet_end_time = 0

  def set_color(self):
    self.color = np.array((1, 0, 0))
    self.team_color = self.color
    self.color_string = "#ff0000"
    return

  def is_scared(self):
    return time() < self.power_pellet_end_time

  def current_color(self):
    base_color = self.color
    time_left = self.power_pellet_end_time - time()
    if time_left > 0:
      if time_left < 3 and time_left % 0.5 > 0.25:
        base_color = np.array((0, 0, 0))
      else:
        base_color = np.array((1,0,1))
    return 255*np.power(base_color,2)
    #return 255*base_color

  def cant_move(self):
    move_freq = config["GHOST_SCARED_MOVE_FREQ"] if self.is_scared() else config["GHOST_MOVE_FREQ"]
    return (self.stunned or
      time() - self.last_move_time < move_freq or # just moved
      (self.is_claimed and (self.move_direction == ZERO_2D).all())
    )

  def get_next_position(self):
    pos = self.position
    my_coord = unique_coords[self.position]

    if random() < config["GHOST_RANDOMNESS"]:
      goto = choice(neighbors[pos])
      while goto == self.prev_pos:
        goto = choice(neighbors[pos])
      return goto

    best_dist_sq = 1000
    closest_pacman_coord = my_coord
    for pacman in pacmen():
      pacman_coord = unique_coords[pacman.position]
      delta = pacman_coord - my_coord
      dist_sq = np.dot(delta, delta)
      if dist_sq < best_dist_sq:
        closest_pacman_coord = pacman_coord
        best_dist_sq = dist_sq

    new_pos = 0
    best_dist_sq = 0 if self.is_scared() else 1000
    for neighbor in neighbors[pos]:
      delta = unique_coords[neighbor] - closest_pacman_coord
      dist_sq = np.dot(delta, delta)

      if self.is_scared():
        is_better_dist = dist_sq > best_dist_sq
      else:
        is_better_dist = dist_sq < best_dist_sq

      if is_better_dist and neighbor != self.prev_pos:
        new_pos = neighbor
        best_dist_sq = dist_sq

    return new_pos


  def is_occupied(self, position):
    return False

  def render_ready(self):
    self.render()

  def render(self):
    if self.stunned:
      render_pulse(
        direction=unique_coords[self.position],
        color=self.current_color(),
        start_time=self.hit_time,
        duration=READY_PULSE_DURATION)

    Player.render(self)


game = PacMan(Pacman)
