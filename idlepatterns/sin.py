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


class Sin(Idle):
  time_factor = 0
  previous_time = 0

  def __init__(self):
    Idle.__init__(self)
    ds = np.sum(np.multiply(unique_coord_matrix, unique_coord_matrix), axis=0).T
    self.distancesFromCenter = np.sqrt(ds)

  def init_values(self):
    if get_pref("sinRadial"):
      if get_pref("sinRadialReverse"):
        self.render_values = self.distancesFromCenter * self.period()
      else:
        self.render_values = self.distancesFromCenter * -self.period()
    else:
      self.render_values = np.matmul(-self.direction() * self.period(), unique_coord_matrix)
    self.time_factor += (time() - self.previous_time) * 2*pi * self.speed()
    self.previous_time = time()
    self.render_values += self.time_factor
    self.render_values = (np.sin(self.render_values) + 1 + self.min_value())/(2 + self.min_value())
    self.render_values = np.maximum(self.render_values, 0)

  def min_value(self):
    return get_pref("sinMin") / 255.0

  def direction(self):
    return get_pref("sinDirection")

  def period(self):
    return get_pref("idleDensity") * get_pref("idleDensity") / 150

  def speed(self):
    return get_pref("idleFrameRate") * self.period() / 200

  def wait_for_frame_end(self):
    pass

idle = Sin()
