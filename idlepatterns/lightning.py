#!/usr/bin/env python
import numpy as np
from math import exp
from random import randrange, random, sample
from time import time

import engine
from engine import get_pref, SIZE, RAW_SIZE, neighbors, dupe_to_uniques

from idlepatterns import Idle

class Lightning(Idle):
  def __init__(self):
    Idle.__init__(self)
    self.time_pressure = 0
    self.fluid_values = np.zeros(RAW_SIZE)

  def init_values(self):
    self.fluid_values *= exp(-get_pref("idleFrameRate") / 60)
    self.time_pressure += random() * get_pref("idleFrameRate") / 200
    if self.time_pressure < 1:
      self.render_values = self.fluid_values
      return
    self.time_pressure = 0

    sink = randrange(SIZE)
    for unique in dupe_to_uniques[sink]:
      self.fluid_values[unique] = 1
    to_sink = {}
    nodesToProcess = [sink]
    distance_to_sink = {sink: 0}
    while len(nodesToProcess) > 0:
      node = nodesToProcess.pop(0)
      ns = neighbors[node]
      for n in sample(ns, len(ns)):
        if n not in to_sink:
          distance_to_sink[n] = distance_to_sink[node] + 1
          to_sink[n] = node
          nodesToProcess.append(n)

    source_count = int(SIZE * get_pref("idleDensity") / 1000)
    for i in range(source_count):
      source = randrange(SIZE)
      while source != sink:
        value = 0.5 + exp(-distance_to_sink[source] / SIZE * 100)
        for unique in dupe_to_uniques[source]:
          self.fluid_values[unique] = value
        source = to_sink[source]

    self.render_values = self.fluid_values

idle = Lightning()
