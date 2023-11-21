#!/usr/bin/env python
import numpy as np
from time import time

import engine

class Idle(engine.Idle):
  def render(self):
    self.wait_for_frame_end()
    self.init_values()
    if engine.prefs.get("applyIdleMinBefore", False):
      self.apply_min()
    if engine.prefs.get("hasStartAndEnd", False):
      self.apply_fade()
    self.apply_brightness()
    self.apply_color()
    if not engine.prefs.get("applyIdleMinBefore", False):
      self.apply_min()

    engine.raw_pixels = self.render_values * 255

idle = Idle()
idle.generate_players(engine.Player)

