#!/usr/bin/env python

import os
import sys
import numpy as np

from math import floor, pi, cos, sin, sqrt
from random import uniform
from time import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
from engine import Game, Player, color_pixel, render_pulse, SIZE, GOOD_COLOR, BAD_COLOR, north_pole

additional_config = {
  "MIN_RED_LIGHT_TIME": 2,
  "MAX_RED_LIGHT_TIME": 4,
  "MIN_GREEN_LIGHT_TIME": 2,
  "MAX_GREEN_LIGHT_TIME": 8,
  "MIN_PULSE_DURATION": 0.3,
  "MAX_PULSE_DURATION": 1,
}


class RLGL(Game):
  name = __name__
  red_light = True
  light_change_time = 0
  pulse_duration = 0

  def start_update(self):
    Game.start_update(self)
    self.update_lights()

  def play_update(self):
    Game.play_update(self)
    self.update_lights()

  def update_lights(self):
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
    for pos in north_pole:
      color_pixel(pos, BAD_COLOR if self.red_light else GOOD_COLOR)

    if not self.red_light:
      render_pulse(
        color=BAD_COLOR,
        start_time=self.light_change_time - self.pulse_duration,
        duration=self.pulse_duration)



class Runner(Player):
  def move(self):
    Player.move(self)
    if game.red_light and time() - self.last_move_time < 0.01:
      self.position = self.initial_position
      self.prev_pos = self.position

    if self.position in north_pole:
      self.score += 1
      self.score_timestamp = time()
      self.position = self.initial_position
      self.prev_pos = self.position



game = RLGL(additional_config)
game.generate_players(Runner, positions=[75,85,62,8,338,91])
