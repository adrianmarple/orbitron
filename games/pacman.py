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

additional_settings = {
  "PACMEN_LIVES": 8,
  "NUM_GHOSTS": 3,
  "STARTING_POWER_PELLET_COUNT": 4,
  "POWER_PELLET_DURATION": 10,
  "PACMAN_MOVE_FREQ": 0.22,
  "PACMAN_POWER_MOVE_FREQ": 0.18,
  "GHOST_MOVE_FREQ": 0.25,
  "GHOST_SCARED_MOVE_FREQ": 0.4,
  "GHOST_RANDOMNESS": 0.3,
  "PELLET_SCORE": 10,
  "POWER_PELLET_SCORE": 50,
  "GHOST_KILL_SCORE": 200,
  "VICTORY_SCORE": 3000,
  "MARGINAL_PACMAN_VICTORY_SCORE": 500,
  "PELLET_REGEN_FREQ": 1,
  "POWER_PELLET_REGEN_FREQ": 20,
  "PULSE_DURATION": 0.75,
  "GHOST_STUN_TIME": 5,
  "SELECTION_WEIGHTS": [0, 0.5, 0.5, 0.5, 0.5, 0],
  "REQUIREMENTS": ["north_pole"],
}


class PacMan(Game):
  power_pulses = []
  previous_pellet_generation_time = 0
  previous_power_pellet_generation_time = 0

  def restart(self):
    Game.restart(self)
    self.data["score"] = 0
    self.data["victory_score"] = 0
    self.data["lives"] = self.PACMEN_LIVES

  def start_ontimeout(self):
    # Suppliment with AI ghosts
    num_ghosts = self.NUM_GHOSTS + len(self.claimed_players())
    self.ghosts = []
    for i in range(num_ghosts):
      if i < len(engine.north_pole):
        self.ghosts.append(Ghost(engine.north_pole[i]))

    Game.start_ontimeout(self)

    self.data["lives"] = self.PACMEN_LIVES
    self.data["victory_score"] = self.VICTORY_SCORE + len(self.claimed_players()) * self.MARGINAL_PACMAN_VICTORY_SCORE


  def countdown_ontimeout(self):
    for i in range(self.STARTING_POWER_PELLET_COUNT):
      self.spawn("power")
    for i in range(len(self.statuses)):
      if self.statuses[i] == "blank":
        self.statuses[i] = "pellet"

    self.previous_pellet_generation_time = time()
    self.previous_power_pellet_generation_time = time()
    Game.countdown_ontimeout(self)
    self.end_time = 0


  def play_update(self):
    for player in self.claimed_players():
      player.move()
    for ghost in self.ghosts:
      ghost.move()

    if self.data["lives"] <= 0:
      self.play_ontimeout()
      self.victors = engine.ENEMY_TEAM

    if self.data["score"] >= self.data["victory_score"]:
      self.play_ontimeout()
      self.victors = self.claimed_players()

    if time() - self.previous_pellet_generation_time > self.PELLET_REGEN_FREQ:
      self.spawn("pellet")
      self.previous_pellet_generation_time = time()
    if time() - self.previous_power_pellet_generation_time > self.POWER_PELLET_REGEN_FREQ:
      self.spawn("power")
      self.previous_power_pellet_generation_time = time()


  def render_game(self):
    power_color = np.array((255,255,255))*(0.55 + 0.45*sin(time() * 16))
    for i in range(len(self.statuses)):
      if self.statuses[i] == "pellet":
        engine.color_pixel(i, (10, 10, 10))
      elif self.statuses[i] == "power":
        engine.color_pixel(i, power_color)

    for ghost in self.ghosts:
      ghost.render()
    for player in self.claimed_players():
      player.render()

    self.power_pulses = [pulse for pulse in self.power_pulses if time() < pulse[1] + self.PULSE_DURATION]
    for (origin, start_time) in self.power_pulses:
      engine.render_pulse(direction=-origin,
        color=(200,200,200),
        start_time=start_time,
        duration=self.PULSE_DURATION)


# ================================ PLAYER =========================================

class Pacman(Player):
  def reset(self):
    Player.reset(self)
    self.lives_left = game.PACMEN_LIVES
    self.power_pellet_end_time = 0

  def is_powerful(self):
    return time() < self.power_pellet_end_time

  def move_delay(self):
    if self.is_powerful() or time() - self.hit_time < game.INVULNERABILITY_TIME:
      return game.PACMAN_POWER_MOVE_FREQ
    else:
      return game.PACMAN_MOVE_FREQ

  def move(self):
    Player.move(self)

    for ghost in game.ghosts:
      if ghost.position == self.position:
        if ghost.is_scared():
          sounds["kick"].play()
          ghost.position = choice(engine.north_pole)
          ghost.hit_time = time()
          ghost.power_pellet_end_time = 0 # ghost no longer scared
          game.data["score"] += game.GHOST_KILL_SCORE
          break
        elif time() - self.hit_time > game.INVULNERABILITY_TIME:
          self.hit_time = time()
          game.data["lives"] -= 1
          sounds["hurt"].play()
          break

    # Pacman consumes pellets as they move
    if game.statuses[self.position] == "power":
      sounds["explosion"].play()
      power_pellet_end_time = time() + game.POWER_PELLET_DURATION
      for player in game.claimed_players():
        player.power_pellet_end_time = power_pellet_end_time
      for ghost in game.ghosts:
        ghost.power_pellet_end_time = power_pellet_end_time
      game.data["score"] += game.POWER_PELLET_SCORE
      game.statuses[self.position] = "blank"
      game.power_pulses.append((engine.coords[self.position], time()))
    elif game.statuses[self.position] == "pellet":
      game.data["score"] += game.PELLET_SCORE
      game.statuses[self.position] = "blank"


class Ghost(Player):
  def reset(self):
    Player.reset(self)
    self.power_pellet_end_time = 0

  def is_scared(self):
    return time() < self.power_pellet_end_time

  def current_color(self):
    time_left = self.power_pellet_end_time - time()
    if time_left > 0 and time_left < 3 and time_left % 0.5 > 0.25:
      return np.array((0, 0, 0))
    elif time_left > 0:
      return engine.GOOD_COLOR
    else:
      return engine.BAD_COLOR

  def cant_move(self):
    move_freq = game.GHOST_SCARED_MOVE_FREQ if self.is_scared() else game.GHOST_MOVE_FREQ
    return (time() - self.hit_time < game.GHOST_STUN_TIME or
      time() - self.last_move_time < move_freq or # just moved
      (self.is_claimed and (self.move_direction == ZERO_2D).all())
    )

  def get_next_position(self):
    pos = self.position
    my_coord = engine.coords[self.position]

    if random() < game.GHOST_RANDOMNESS:
      goto = choice(engine.neighbors[pos])
      while goto == self.prev_pos:
        goto = choice(engine.neighbors[pos])
      return goto

    best_dist_sq = 1000
    closest_pacman_coord = my_coord
    for pacman in game.claimed_players():
      pacman_coord = engine.coords[pacman.position]
      delta = pacman_coord - my_coord
      dist_sq = np.dot(delta, delta)
      if dist_sq < best_dist_sq:
        closest_pacman_coord = pacman_coord
        best_dist_sq = dist_sq

    new_pos = 0
    best_dist_sq = 0 if self.is_scared() else 1000
    for neighbor in engine.neighbors[pos]:
      delta = engine.coords[neighbor] - closest_pacman_coord
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
    if time() - self.hit_time < game.GHOST_STUN_TIME:
      engine.render_pulse(
        direction=engine.coords[self.position],
        color=self.current_color(),
        start_time=self.hit_time,
        duration=game.PULSE_DURATION)

    Player.render(self)


game = PacMan(additional_settings)
game.generate_players(Pacman)
