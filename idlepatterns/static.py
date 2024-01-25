#!/usr/bin/env python
from math import pi, cos, sin
import numpy as np
from random import randrange, random
from time import time

import engine
from engine import get_pref, RAW_SIZE, unique_coord_matrix

from idlepatterns import Idle

class Static(Idle):
  def init_values(self):
    self.render_values = np.ones(RAW_SIZE)

  def blend_pixels(self):
    if get_pref("staticRotation"):
      theta = time() * 2*pi / get_pref("staticRotationTime")
      direction = np.array((sin(theta), cos(theta), 0))
    else:
      direction = get_pref("staticDirection")

    self.target_values = np.matmul(direction, unique_coord_matrix)
    self.target_values = (1 + self.target_values) / 2
    self.target_values = np.maximum(0, self.target_values)
    self.target_values = np.minimum(1, self.target_values)
    self.render_values = np.ones(RAW_SIZE)

  def apply_brightness(self):
    Idle.apply_brightness(self)
    self.render_values *= 0.2

idle = Static()
