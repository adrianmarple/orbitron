#!/usr/bin/env python
import numpy as np
from random import randrange, random
from time import time

import engine
from engine import get_pref, SIZE, neighbors, dupe_to_uniques

from idlepatterns import Idle

class Fireflies(Idle):
  def init_values(self):
    target_head_count = int(SIZE * get_pref("idleDensity") / 2000)

    new_heads = []
    for head in self.fluid_heads:
      for n in neighbors[head]:
        x = self.fluid_values[dupe_to_uniques[n][0]] + 0.02
        x *= 1.5
        if x < random():
          new_heads.append(n)
          for unique in dupe_to_uniques[n]:
            self.fluid_values[unique] = 1
          break

    while len(new_heads) < target_head_count:
      new_heads.append(randrange(SIZE))

    for head in new_heads:
      for unique in dupe_to_uniques[head]:
        self.fluid_values[unique] = 1

    self.fluid_heads = new_heads
    self.fluid_values *= 0.84
    self.render_values = np.multiply(self.fluid_values, self.fluid_values)

idle = Fireflies()
