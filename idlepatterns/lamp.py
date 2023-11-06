#!/usr/bin/env python
import numpy as np
from time import time

import engine

class Lamp(engine.Idle):
  name = __name__

  def render(self):
    self.init_values()
    spotlight = np.matmul(-engine.coords[0], engine.unique_coord_matrix)
    spotlight *= 0.3
    spotlight = np.maximum(spotlight, 0)
    self.render_values += spotlight
    self.render_values = np.minimum(self.render_values, 1)
    self.apply_color()

    engine.raw_pixels = self.render_values * 255

idle = Lamp()
idle.generate_players(engine.Player)

