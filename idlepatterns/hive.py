#!/usr/bin/env python
import numpy as np
from random import randrange, random
from time import time

import engine
from engine import RAW_SIZE, unique_coord_matrix
from idlepatterns import Idle

class Hive(Idle):
  def __init__(self):
    Idle.__init__(self)
    self.highlight = np.zeros(RAW_SIZE)
    self.highlight_rectangle(-25, 1, -10, 7)
    self.highlight_rectangle(-10, -7, 10, -1)

  def highlight_rectangle(self, minX, minY, maxX, maxY):
    for i in range(RAW_SIZE):
      coord = unique_coord_matrix[:,i]
      if coord[0] > minX and coord[0] < maxX and coord[1] > minY and coord[1] < maxY:
        self.highlight[i] = 1

  def init_values(self):
    Idle.init_values(self)
    self.render_values += self.highlight * 0.2


idle = Hive()
