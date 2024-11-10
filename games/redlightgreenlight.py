#!/usr/bin/env python

import os
import sys
import numpy as np

from math import floor, pi, cos, sin, sqrt
from random import randrange, uniform
from time import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
import engine
Game = engine.Game
Player = engine.Player

additional_settings = {
  "MIN_RED_LIGHT_TIME": 2,
  "MAX_RED_LIGHT_TIME": 4,
  "MIN_GREEN_LIGHT_TIME": 1.5,
  "MAX_GREEN_LIGHT_TIME": 6,
  "MIN_PULSE_DURATION": 0.25,
  "MAX_PULSE_DURATION": 0.6,
  "MOVE_FREQ": 0.24,
}


class RLGL(Game):
  red_light = True
  light_change_time = 0
  pulse_duration = 0
  top_score = 0

  goals = []

  def start_ontimeout(self):
    self.top_score = 0
    self.goals.clear()
    goal_count = len(self.claimed_players()) - 1
    goal_count = max(goal_count, 2)
    for i in range(goal_count):
      self.spawn_goal()
    Game.start_ontimeout(self)

  def play_update(self):
    Game.play_update(self)

    for player in self.claimed_players():
      self.top_score = max(self.top_score, player.score)

    if self.light_change_time < time():
      self.red_light = not self.red_light
      min_wait = 0
      max_wait = 0
      if self.red_light:
        min_wait = self.MIN_RED_LIGHT_TIME
        max_wait = self.MAX_RED_LIGHT_TIME
      else:
        min_wait = self.MIN_GREEN_LIGHT_TIME
        max_wait = self.MAX_GREEN_LIGHT_TIME


      self.pulse_duration = uniform(self.MIN_PULSE_DURATION, self.MAX_PULSE_DURATION)
      self.light_change_time = time() + uniform(min_wait, max_wait)

  def render_game(self):
    if self.red_light:
      pole_color = engine.BAD_COLOR
    else:
      pole_color = engine.GOOD_COLOR * (0.5 + 0.5 * sin(time() * 15))

    for pos in self.goals:
      engine.color_pixel(pos, pole_color)

    if not self.red_light:
      direction = np.array((0,1.2,0)) if engine.IS_WALL else np.array((0,0,1))

      for goal in self.goals:
        engine.render_pulse(
          direction=engine.coords[goal],
          color=engine.BAD_COLOR,
          start_time=self.light_change_time - self.pulse_duration,
          duration=self.pulse_duration)

  def spawn_goal(self):
    points_to_avoid = set()
    for goal in self.goals:
      points_to_avoid.add(goal)
    for player in self.claimed_players():
      points_to_avoid.add(player.position)

    for i in range(5):
      points_to_avoid = self.all_neighbors(points_to_avoid)
    
    for i in range(100):
      pos = randrange(engine.SIZE)
      if pos not in points_to_avoid:
        self.goals.append(pos)
        return


class Runner(Player):
  previous_success_time = 0

  def reset(self):
    self.initial_position = self.random_teleport_pos()
    Player.reset(self)

  def ready(self):
    Player.ready(self)
    self.position = self.initial_position

  def move_delay(self):
    return (5 + self.score) / (5 + game.top_score) * game.MOVE_FREQ

  def move(self):
    starting_position = self.position
    Player.move(self)
    if game.red_light and time() - self.last_move_time < 0.01:
      self.position = self.initial_position
      self.prev_pos = self.position
      if starting_position != self.initial_position:
        sounds["hurt"].play()

    if self.position in game.goals:
      game.goals.remove(self.position)
      game.spawn_goal()

      self.score += 1
      self.score_timestamp = time()
      # self.initial_position = self.random_teleport_pos()
      self.initial_position = self.position
      # self.position = self.initial_position
      self.prev_pos = self.position
      self.previous_success_time = time()

  def render(self):
    Player.render(self)
    engine.render_pulse(
      direction=engine.coords[self.position],
      color=self.current_color(),
      start_time=self.previous_success_time,
      duration=0.5)


game = RLGL(additional_settings)
game.generate_players(Runner, positions=engine.SOUTHERLY_INITIAL_POSITIONS)
