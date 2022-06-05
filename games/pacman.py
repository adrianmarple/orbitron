#!/usr/bin/env python

import numpy as np
import os
import sys

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random, choice
from time import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
from engine import Game, Dummy, Player, color_pixel, render_pulse, unique_coords, unique_antipodes, neighbors, SIZE

additional_config = {
  "PACMEN_LIVES": 5,
  "NUM_GHOSTS": 4,
  "STARTING_POWER_PELLET_COUNT": 4,
  "POWER_PELLET_DURATION": 10,
  "PACMAN_MOVE_FREQ": 0.22,
  "PACMAN_POWER_MOVE_FREQ": 0.18,
  "GHOST_MOVE_FREQ": 0.22,
  "GHOST_SCARED_MOVE_FREQ": 0.4,
  "GHOST_RANDOMNESS": 0.3,
  "PELLET_SCORE": 10,
  "POWER_PELLET_SCORE": 50,
  "GHOST_KILL_SCORE": 200,
  "VICTORY_SCORE": 3000,
  "MARGINAL_PACMAN_VICTORY_SCORE": 1000,
  "PELLET_REGEN_FREQ": 1,
  "POWER_PELLET_REGEN_FREQ": 30,
  "SHARED_LIVES": True,
  "PULSE_DURATION": 0.75,
}


class PacMan(Game):
  name = __name__

  power_pulses = []
  previous_pellet_generation_time = 0
  previous_power_pellet_generation_time = 0

  def generate_players(self, player_class):
    Game.generate_players(self, player_class)
    #North Pole Coords = 268-273 133-141 172
    self.players += [
      Ghost(position=133),
      Ghost(position=137),
      Ghost(position=141),
      Ghost(position=172),
      Ghost(position=135),
      Ghost(position=139),
      Ghost(position=269),
      Ghost(position=272),
      Ghost(position=134),
      Ghost(position=138),
    ]

  def restart(self):
    Game.restart(self)
    self.data["score"] = 0
    self.data["victory_score"] = 0
    self.data["lives"] = self.PACMEN_LIVES

  def ghosts(self):
    return [player for player in self.players if not player.is_pacman]
  def pacmen(self):
    if self.state == "start":
      return [player for player in self.players if player.is_pacman and player.is_claimed]
    else:
      return [player for player in self.players if player.is_pacman and player.is_playing]


  def start_update(self):
    Game.start_update(self)

    ghost_count = 0
    num_ghosts = len(self.pacmen())
    for ghost in self.ghosts():
      ghost_count += 1
      ghost.is_playing = ghost_count <= num_ghosts
      if ghost.is_playing:
        ghost.move()

    self.spawn_pellets()

  def start_ontimeout(self):
    # Suppliment with AI ghosts
    ghost_count = 0
    num_ghosts = self.NUM_GHOSTS + len(self.pacmen())
    for ghost in self.ghosts():
      ghost_count += 1
      ghost.reset()
      ghost.is_playing = ghost_count <= num_ghosts

    Game.start_ontimeout(self)

    self.data["lives"] = self.PACMEN_LIVES
    self.data["victory_score"] = self.VICTORY_SCORE + len(self.pacmen()) * self.MARGINAL_PACMAN_VICTORY_SCORE



  def countdown_ontimeout(self):
    for i in range(len(self.statuses)):
      self.statuses[i] = "pellet"
    for i in range(self.STARTING_POWER_PELLET_COUNT):
      self.statuses[randrange(len(self.statuses))] = "power"

    self.previous_pellet_generation_time = time()
    self.previous_power_pellet_generation_time = time()
    Game.countdown_ontimeout(self)


  def play_update(self):
    for player in self.playing_players():
      player.move()

    ghosts_win = True
    for player in self.playing_players():
      if player.is_pacman and player.is_alive:
        ghosts_win = False
        break

    if ghosts_win or self.data["lives"] <= 0:
      self.play_ontimeout()
      self.victor = Dummy(
        name="Ghosts",
        color=(255, 0, 0),
        color_string="red")

    if self.data["score"] >= self.data["victory_score"]:
      self.play_ontimeout()
      self.victor = Dummy(
        name="Pacmen",
        color=self.pacmen()[0].color,
        color_string=self.pacmen()[0].color_string)

    self.spawn_pellets()


  def spawn_pellets(self):
    if time() - self.previous_pellet_generation_time > self.PELLET_REGEN_FREQ:
      self.spawn("pellet")
      self.previous_pellet_generation_time = time()
    if time() - self.previous_power_pellet_generation_time > self.POWER_PELLET_REGEN_FREQ:
      self.spawn("power")
      self.previous_power_pellet_generation_time = time()


  def render_game(self):
    reversed_players = self.current_players()
    reversed_players.reverse()

    power_color = np.array((255,255,255))*(0.55 + 0.45*sin(time() * 16))
    for i in range(SIZE):
      if self.statuses[i] == "pellet":
        color_pixel(i, (10, 10, 10))
        #color_pixel(i, (50, 50, 50))
      elif self.statuses[i] == "power":
        color_pixel(i, power_color)

    for player in reversed_players:
      player.render()

    self.power_pulses = [pulse for pulse in self.power_pulses if time() < pulse[1] + self.PULSE_DURATION]
    for (origin, start_time) in self.power_pulses:
      render_pulse(direction=-origin,
        color=(200,200,200),
        start_time=start_time,
        duration=self.PULSE_DURATION)


# ================================ PLAYER =========================================

class Pacman(Player):
  def __init__(self, *args, **kwargs):
    #kwargs["color"] = (190, 195, 5)
    #kwargs["color_string"] = "#e7e023"
    Player.__init__(self, *args, **kwargs)
    self.is_pacman = True

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

  def hit_check(self):
    if not self.is_alive:
      return

    for ghost in game.ghosts():
      if ghost.is_playing and ghost.position == self.position:
        if ghost.is_scared():
          sounds["kick"].play()
          ghost.stunned = True
          ghost.position = unique_antipodes[ghost.position]
          ghost.hit_time = time()
          ghost.power_pellet_end_time = 0 # ghost no longer scared
          game.data["score"] += game.GHOST_KILL_SCORE
          break
        elif time() - self.hit_time > game.INVULNERABILITY_TIME:
          self.hit_time = time()
          if game.SHARED_LIVES:
            game.data["lives"] -= 1
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
    if game.statuses[self.position] == "power":
      sounds["explosion"].play()
      power_pellet_end_time = time() + game.POWER_PELLET_DURATION
      for player in game.playing_players():
        player.power_pellet_end_time = power_pellet_end_time
      game.data["score"] += game.POWER_PELLET_SCORE
      game.statuses[self.position] = "blank"
      game.power_pulses.append((unique_coords[self.position], time()))
    elif game.statuses[self.position] == "pellet":
      game.data["score"] += game.PELLET_SCORE
      game.statuses[self.position] = "blank"

  def to_json(self):
    dictionary = Player.to_json(self)
    dictionary["isPacman"] = True
    dictionary["livesLeft"] = game.data["lives"] if game.SHARED_LIVES else self.lives_left
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
    move_freq = game.GHOST_SCARED_MOVE_FREQ if self.is_scared() else game.GHOST_MOVE_FREQ
    return (self.stunned or
      time() - self.last_move_time < move_freq or # just moved
      (self.is_claimed and (self.move_direction == ZERO_2D).all())
    )

  def get_next_position(self):
    pos = self.position
    my_coord = unique_coords[self.position]

    if random() < game.GHOST_RANDOMNESS:
      goto = choice(neighbors[pos])
      while goto == self.prev_pos:
        goto = choice(neighbors[pos])
      return goto

    best_dist_sq = 1000
    closest_pacman_coord = my_coord
    for pacman in game.pacmen():
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
        duration=game.PULSE_DURATION)

    Player.render(self)


game = PacMan(additional_config)
game.generate_players(Pacman)
