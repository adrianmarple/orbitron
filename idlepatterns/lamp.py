#!/usr/bin/env python
import numpy as np
from time import time

import engine

class Lamp(engine.Idle):
  def render(self):
    self.init_values()
    self.render_values *= 0.5
    spotlight = np.matmul(-engine.coords[0], engine.unique_coord_matrix)
    spotlight = np.maximum(spotlight, 0)
    spotlight = np.multiply(spotlight, spotlight)
    self.render_values += spotlight
    self.render_values = np.minimum(self.render_values, 1)

    self.apply_min()
    self.apply_color()
    self.apply_brightness()

    engine.raw_pixels = self.render_values * 255

idle = Lamp()
idle.generate_players(engine.Player)

