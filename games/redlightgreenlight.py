#!/usr/bin/env python

import os
import sys
import numpy as np

from math import floor, pi, cos, sin, sqrt
from random import uniform
from time import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
import engine
Game = engine.Game
Player = engine.Player

additional_config = {
  "MIN_RED_LIGHT_TIME": 2,
  "MAX_RED_LIGHT_TIME": 4,
  "MIN_GREEN_LIGHT_TIME": 1.5,
  "MAX_GREEN_LIGHT_TIME": 6,
  "MIN_PULSE_DURATION": 0.25,
  "MAX_PULSE_DURATION": 0.6,
  "MOVE_FREQ": 0.24,
}


class RLGL(Game):
  name = __name__
  red_light = True
  light_change_time = 0
  pulse_duration = 0
  top_score = 0

  def start_ontimeout(self):
    self.top_score = 0
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

    for pos in engine.north_pole:
      engine.color_pixel(pos, pole_color)

    if not self.red_light:
      engine.render_pulse(
        color=engine.BAD_COLOR,
        start_time=self.light_change_time - self.pulse_duration,
        duration=self.pulse_duration)



class Runner(Player):
  previous_success_time = 0

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

    if self.position in engine.north_pole:
      self.score += 1
      self.score_timestamp = time()
      self.position = self.initial_position
      self.prev_pos = self.position
      self.previous_success_time = time()

  def render(self):
    Player.render(self)
    engine.render_pulse(
      direction=engine.coords[self.initial_position],
      color=self.current_color(),
      start_time=self.previous_success_time,
      duration=0.5)


game = RLGL(additional_config)
game.generate_players(Runner, positions=[79,39,12,113,352,401])
