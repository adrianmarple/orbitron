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

  def init_values(self):
    self.render_values = np.zeros(RAW_SIZE)
    for pulse in self.pulses:
      values = pulse.render()
      self.render_values += np.multiply(values, values) * 12

    pulse_is_definitely_visible = False

    for pulse in self.pulses[:]:
      time_left = pulse.start_time + pulse.duration - time()
      if time_left / pulse.duration > 0.5:
        pulse_is_definitely_visible = True
      if time_left < 0:
        self.pulses.remove(pulse)

    max_pulses = max(2, get_pref("idleDensity") / 10)
    if len(self.pulses) > max_pulses:
      return

    x = get_pref("idleDensity") / 50 / FRAMERATE
    if random() < x or not pulse_is_definitely_visible:
      self.pulses.append(Pulse(self.base_duration*(1 + random()), (2*random()-1, 2*random()-1, 0)))


    new_base_duration = 70 / get_pref("idleFrameRate")
    ratio = new_base_duration / self.base_duration
    if ratio != 1:
      for pulse in self.pulses:
        pulse.update_speed(ratio)
      self.base_duration = new_base_duration

  def wait_for_frame_end(self):
    pass


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
      width=get_pref("rippleWidth") / 100.0,
      reverse=True)

  def update_speed(self, ratio):
    self.start_time = self.start_time * ratio + time() * (1-ratio)
    self.duration *= ratio

idle = Pulses()
