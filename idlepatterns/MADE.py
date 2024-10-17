#!/usr/bin/env python
import numpy as np
from math import sin, pi
from time import time, sleep

from engine import RAW_SIZE, unique_coord_matrix
from idlepatterns import Idle
from prefs import get_pref

class MADE(Idle):
  def __init__(self):
    Idle.__init__(self)
    self.letters = np.zeros(RAW_SIZE)
    for i in range(RAW_SIZE):
      coord = unique_coord_matrix[:,i]
      x = abs(coord[0])
      y = coord[1]
      if 4*y - 3*x > -0.8:
        self.letters[i] = 1

    self.letters3 = np.outer(self.letters, np.ones(3))
    

  def init_values(self):
    Idle.init_values(self)
    self.render_values += self.letters * 0.02

  def apply_color(self):
    alpha = sin(time() * pi / 30) * 5 + 0.5
    alpha = min(1, max(0, alpha))
    alpha1 = alpha**2
    alpha2 = 1 - (1-alpha)**2

    rectified_target_values = self.target_values * 100.0 / get_pref("gradientThreshold")
    rectified_target_values = np.minimum(1, rectified_target_values)
    start = get_pref("gradientStartColor")/255
    start_colors = np.outer(rectified_target_values, start)
    end = get_pref("gradientEndColor")/255
    end_colors = np.outer(1 - rectified_target_values, end)
    colors = start_colors + end_colors
    mix1 = self.letters3 * alpha1 + (1 - self.letters3) * (1 - alpha1)
    colors1 = np.multiply(1 - mix1, colors)
    mix2 = self.letters3 * alpha2 + (1 - self.letters3) * (1 - alpha2)
    colors2 = np.multiply(mix2, colors)
    colors2[:,[0,1]] = colors2[:,[1,0]]
    colors[:,:2] = (colors1 + colors2)[:,:2]
    self.render_values = np.outer(self.render_values, np.ones(3))
    self.render_values = np.multiply(self.render_values, colors)

idle = MADE()
