#!/usr/bin/env python
import numpy as np
from time import time

import engine
from idlepatterns import Idle

class Lamp(Idle):

  def init_values(self):
    Idle.init_values(self)
    spotlight = np.matmul(-engine.coords[0], engine.unique_coord_matrix)
    spotlight = np.maximum(spotlight, 0)
    spotlight = np.multiply(spotlight, spotlight)
    self.render_values += spotlight


idle = Lamp()
