#!/usr/bin/env python
import numpy as np
from random import randrange, random
from time import time

import engine
from engine import get_pref, SIZE, RAW_SIZE, FRAMERATE
from idlepatterns import Idle

class Pulses(Idle):
  pulses = []
  base_duration = 5

  def update_prefs(self):
    Idle.update_prefs(self)
    new_base_duration = 70 / get_pref("idleFrameRate")
    for pulse in self.pulses:
      pulse.update_speed(new_base_duration / self.base_duration)
    self.base_duration = new_base_duration

  def init_values(self):
    self.render_values = np.zeros((RAW_SIZE, 1), dtype='float64')
    for pulse in self.pulses:
      values = pulse.render()
      self.render_values += np.multiply(values, values) * 12

    if len(self.pulses) > 0:
      pulse = self.pulses[0]
      if pulse.start_time + pulse.duration < time():
        self.pulses.pop(0)

    x = get_pref("idleDensity") / get_pref("idleFrameRate") / 2 / FRAMERATE
    if random() < x or len(self.pulses) == 0:
      self.pulses.append(Pulse(self.base_duration*(1 + random()), (2*random()-1, 2*random()-1, 0)))

  def wait_for_frame_end(self):
    return True


class Pulse():
  def __init__(self, duration, location):
    self.start_time = time()
    self.duration = duration
    self.location = location

  def render(self):
    return engine.render_pulse(
      direction=self.location,
      start_time=self.start_time,
      duration=self.duration,
      reverse=True)

  def update_speed(self, ratio):
    self.start_time = self.start_time * ratio + time() * (1-ratio)
    self.duration *= ratio

idle = Pulses()