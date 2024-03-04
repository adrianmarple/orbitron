#!/usr/bin/env python
import json
from math import pi, sqrt, sin, cos
import numpy as np
import os
from random import randrange, random
import sys
from time import time
import urllib.request

import engine
from engine import get_pref, RAW_SIZE, unique_coord_matrix
from idlepatterns import Idle


class LightField(Idle):
  pixel_times = np.zeros(RAW_SIZE)
  pixel_factors = (np.random.rand(RAW_SIZE) * 10) + 0.5
  pixel_max_brightness = np.power(np.random.rand(RAW_SIZE) * 0.9 + 0.1,2)
  previous_time = 0

  def clear(self):
    Idle.clear(self)
    self.pixel_times *= 0

  def init_values(self):
    delta = np.full(RAW_SIZE, (time() - self.previous_time) * 2*pi * self.speed())
    self.previous_time = time()
    self.pixel_times += delta * self.pixel_factors
    self.render_values = np.multiply(np.maximum(np.sin(self.pixel_times), 0), self.pixel_max_brightness)

  def speed(self):
    return get_pref("idleFrameRate") / 300

  def wait_for_frame_end(self):
    pass

idle = LightField()
