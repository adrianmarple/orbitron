#!/usr/bin/env python
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
    self.target_values = np.matmul(get_pref("idleDirection"), unique_coord_matrix)
    self.target_values = (1 + self.target_values) / 2
    self.target_values = np.maximum(0, self.target_values)
    self.target_values = np.minimum(1, self.target_values)

idle = Static()
