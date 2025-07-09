#!/usr/bin/env python
from math import pi
from datetime import datetime, timedelta, date
import numpy as np
from random import randrange, random
from time import time

import engine
from engine import get_pref, RAW_SIZE, unique_coord_matrix

from idlepatterns import Idle

class Static(Idle):

  def init_values(self):
    now = datetime.now()
    start = datetime.strptime(get_pref("hourglassStart"), '%H:%M').time()
    start = datetime.combine(date.today(), start)
    end = datetime.strptime(get_pref("hourglassEnd"), '%H:%M').time()
    end = datetime.combine(date.today(), end)

    phase = (now - start) / (end - start)
    if phase < 0:
      phase = 0
    if phase > 1:
      phase = 1

    self.render_values = np.matmul(get_pref("staticDirection"), unique_coord_matrix)
    self.render_values = (1 + self.render_values) / 2
    self.render_values -= phase
    self.render_values *= -50
    self.render_values = np.maximum(0, self.render_values)
    self.render_values = np.minimum(1, self.render_values)


  def blend_pixels(self):
    self.target_values = np.matmul(-get_pref("staticDirection"), unique_coord_matrix)
    self.target_values = (1 + self.target_values) / 2
    self.target_values = np.maximum(0, self.target_values)
    self.target_values = np.minimum(1, self.target_values)

  def apply_brightness(self):
    Idle.apply_brightness(self)
    self.render_values *= 0.2

idle = Static()
