#!/usr/bin/env python
import numpy as np
from time import time

import engine
from idlepatterns import Idle

class Lamp(Idle):
  def render(self):
    if not self.wait_for_frame_end():
      self.blend_pixels()
      self.apply_color()
      engine.raw_pixels = self.render_values * 255
      return
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

    self.render_values *= 255
    self.render_values = np.maximum(self.render_values, 1)
    engine.raw_pixels = self.render_values

idle = Lamp()
