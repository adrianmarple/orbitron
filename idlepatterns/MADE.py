#!/usr/bin/env python
import numpy as np
from time import time, sleep

import engine

class MADE(engine.Idle):
  def render(self):
    time_to_wait = self.previous_fluid_time + 1.0/engine.get_pref("idleFrameRate") - time()
    if (time_to_wait > 0):
      sleep(time_to_wait)
    self.previous_fluid_time = time()

    self.init_values()
    self.render_values = np.maximum(self.render_values, 0.02)
    self.render_values = np.outer(self.render_values, np.array((1,1,1)))
    green = np.multiply(np.sign(engine.unique_coord_matrix[0]),
                        np.sign(engine.unique_coord_matrix[1]))
    green = (green + 1)/2
    green = np.squeeze(np.asarray(green))
    red = 1 - green
    blue = 1 - 2*np.multiply(red, green)
    self.render_values = np.multiply(self.render_values, np.matrix([red, green, blue]).transpose())

    engine.raw_pixels = self.render_values * 200


idle = MADE()
idle.generate_players(engine.Player)
