#!/usr/bin/env python

import os
import sys

from math import floor, pi, cos, sin, sqrt
from time import time

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import sounds
from engine import *


class ColorWar(Game):
  name = __name__
  leader = None

  def countdown_ontimeout(self):
    Game.countdown_ontimeout(self)

  def play_update(self):
    for player in playing_players():
      player.move()

    counts = {}
    for i in range(SIZE):
      inkling = statuses[i]
      if inkling != "blank":
        counts[inkling] = counts.get(inkling, 0) + 1

    for (inkling, score) in counts.items():
      inkling.score = score
      if self.leader is None or self.leader.score < score:
        self.leader = inkling

  def render_game(self):
    for i in range(SIZE):
      if statuses[i] != "blank":
        color = statuses[i].color / 10
        if statuses[i] == self.leader and self.state != "start":
          color *= 0.7 + 0.5 * sin(time() * 10)
        color_pixel(i, color)



class Inkling(Player):
  def move(self):
    Player.move(self)
    statuses[self.position] = self


game = ColorWar(Inkling)
