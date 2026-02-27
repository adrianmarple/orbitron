#!/usr/bin/env python
from math import pi
import numpy as np
import sys

import engine
from engine import get_pref, SIZE, RAW_SIZE, neighbors, dupe_to_uniques
from idlepatterns import Idle


class LineSine(Idle):
  time_factor = 0

  def __init__(self):
    Idle.__init__(self)
    self.positions = None
    if any(len(neighbors[i]) > 2 for i in range(SIZE)):
      print("LineSine: topology is not a line or ring (pixel with >2 neighbors found)", file=sys.stderr)
      return
    endpoints = [i for i in range(SIZE) if len(neighbors[i]) == 1]
    is_ring = len(endpoints) == 0
    if not is_ring and len(endpoints) != 2:
      print(f"LineSine: topology is not a line or ring (found {len(endpoints)} endpoints)", file=sys.stderr)
      return

    start = 0 if is_ring else endpoints[0]
    order = [start]
    while len(order) < SIZE:
      cur = order[-1]
      prev = order[-2] if len(order) > 1 else None
      nexts = [n for n in neighbors[cur] if n != prev]
      if not nexts:
        break
      order.append(nexts[0])

    if len(order) != SIZE:
      print(f"LineSine: traversal reached {len(order)} pixels, expected {SIZE}", file=sys.stderr)
      return

    positions = np.zeros(RAW_SIZE)
    for order_idx, dupe in enumerate(order):
      t = order_idx / SIZE
      for raw_idx in dupe_to_uniques[dupe]:
        positions[raw_idx] = t
    self.positions = positions

  def init_values(self):
    if self.positions is None:
      self.render_values = np.zeros(RAW_SIZE)
      return
    phase = self.positions * self.cycles() * 2 * pi
    self.time_factor += self.time_delta() * 2 * pi * self.speed()
    self.render_values = np.sin(phase + self.time_factor)
    self.render_values = np.maximum(self.render_values, 0)

  def cycles(self):
    return get_pref("sinWaveCycles")

  def speed(self):
    return get_pref("idleFrameRate") * self.cycles() / 200

  def wait_for_frame_end(self):
    pass


idle = LineSine()
