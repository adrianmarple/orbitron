#!/usr/bin/env python
import numpy as np
from random import randrange, random
from time import time

import engine
from idlepatterns import Idle

class Template(Idle):
  def render(self):
    if not self.wait_for_frame_end():
      self.blend_pixels()
      self.apply_color()
      engine.raw_pixels = self.render_values * 255
      return
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

idle = Template()
