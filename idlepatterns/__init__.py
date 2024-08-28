#!/usr/bin/env python

import importlib
import numpy as np
import os
import sys

from datetime import datetime, timedelta
from math import exp, ceil, floor, pi, cos, sin, sqrt, tan
from random import randrange, random
from time import sleep, time

import engine
from engine import config, Game, Player, SIZE, RAW_SIZE, FRAMERATE, neighbors, dupe_to_uniques
import prefs
from prefs import get_pref

name_to_idle_game = {}

if config.get("BEAT_MODE"):
  BEAT_PIN = 15 # board pin 10/GPIO pin 15
  import RPi.GPIO as GPIO
  GPIO.setwarnings(False)
  GPIO.setup(BEAT_PIN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

def set_idle():
  name = engine.get_pref("idlePattern")
  idle = None
  if name in name_to_idle_game:
    idle = name_to_idle_game[name]
  else:
    # path = "%s/idlepatterns/%s.py" % (os.path.dirname(__file__), name)
    path = "%s/%s.py" % (os.path.dirname(__file__), name)
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    idle = module.idle
    name_to_idle_game[name] = idle

  if engine.idle != idle:
    idle.clear()
    engine.idle = idle
    engine.start(idle)

class Idle(Game):
  name = "idle"
  waiting_music = "idle"
  render_values = None
  previous_values = None
  target_values = np.zeros((RAW_SIZE, 1))

  previous_render_time = 0
  previous_beat_time = 0

  def __init__(self):
    Game.__init__(self)
    self.generate_players(Player)
    self.birthday = config.get("BIRTHDAY")
    if self.birthday is not None:
      try:
        self.birthday = datetime.strptime(self.birthday, '%b %d')
      except:
        try:
          self.birthday = datetime.strptime(self.birthday, '%B %d')
        except:
          try:
            self.birthday = datetime.strptime(self.birthday, '%m-%d')
          except:
            self.birthday = None

  def clear(self):
    self.target_values *= 0

  def update(self):
    pass

  def beat_factor(self):
    if not config.get("BEAT_MODE"):
      return 1
    time_since_last_beat = time() - self.previous_beat_time
    return 2 * exp(-10*time_since_last_beat) + 0.3

  def render(self):
    if (config.get("BEAT_MODE") and
        time() - self.previous_beat_time > 0.11 and
        GPIO.input(BEAT_PIN) == GPIO.HIGH):
      self.previous_beat_time = time()

    self.wait_for_frame_end()
    self.init_values()
    if get_pref("applyIdleMinBefore"):
      self.apply_min()
    self.render_values *= prefs.fade()
    self.target_values = self.render_values.copy()
    self.blend_pixels()
    self.apply_color()
    self.apply_brightness()
    if not get_pref("applyIdleMinBefore"):
      self.apply_min()

    self.render_birthday()

    engine.raw_pixels = self.render_values * 255
  
  def render_birthday(self):
    if self.birthday is None:
      return
    now = datetime.now()
    todays_your_birthday = now.month == self.birthday.month and \
        now.day == self.birthday.day

    if todays_your_birthday and self.render_values.sum() > 1:
      engine.display_text("HAPPY BIRTHDAY", 3)
    else:
      engine.display_text("", 3)

  
  previous_fluid_time = 0
  def wait_for_frame_end(self):
    time_to_wait = self.previous_fluid_time + self.get_frame_time() - time()
    if time_to_wait > 0:
      sleep(time_to_wait)
    self.previous_fluid_time = time()

  def get_frame_time(self):
    frame_time = 1.0/get_pref("idleFrameRate")
    if config.get("BEAT_MODE"):
      return frame_time / (self.beat_factor() + 0.3)
    else:
      return frame_time


  fluid_heads = [0]
  fluid_values = np.array([1.0] + [0.0] * (RAW_SIZE - 1))
  def init_values(self):
    target_head_count = SIZE * get_pref("idleDensity") / 1600
    head_ratio = len(self.fluid_heads) / target_head_count
    dampening_factor = (1 + head_ratio*head_ratio*5)

    new_heads = []
    for head in self.fluid_heads:
      if random() < 0.1:
        new_heads.append(head)
        continue

      for n in neighbors[head]:
        x = self.fluid_values[dupe_to_uniques[n][0]] + 0.01
        x *= dampening_factor
        if x < random():
          new_heads.append(n)

    spontaneous_combustion_chance = 0.01 / (head_ratio * head_ratio)
    if spontaneous_combustion_chance > random():
      new_heads.append(randrange(SIZE))

    for head in new_heads:
      for unique in dupe_to_uniques[head]:
        self.fluid_values[unique] = 1
    if len(new_heads) != 0:
      self.fluid_heads = new_heads

    self.fluid_values *= 0.86
    self.render_values = np.multiply(self.fluid_values, self.fluid_values)

  def color(self):
    color_string = get_pref("idleColor")
    if color_string == "rainbow":
      return rainbow_phase_color()
    elif color_string == "timeofday":
      return time_of_day_color()
    else:
      return get_pref("fixedColor")/255

  def apply_color(self):
    if get_pref("idleColor") == "rainbow" and get_pref("rainbowFade") > 0:
      color_phase = (time()/get_pref("rainbowDuration")) % 1
      R = self.rainbow_helper(color_phase + 0.33333)
      G = self.rainbow_helper(color_phase)
      B = self.rainbow_helper(color_phase + 0.66666)
      self.render_values = np.stack([R,G,B], axis=-1)
    elif get_pref("idleColor") == "gradient":
      rectified_target_values = self.target_values * 100.0 / get_pref("gradientThreshold")
      rectified_target_values = np.minimum(1, rectified_target_values)
      start = get_pref("gradientStartColor")/255
      start_colors = np.outer(rectified_target_values, start)
      end = get_pref("gradientEndColor")/255
      end_colors = np.outer(1 - rectified_target_values, end)
      colors = start_colors + end_colors
      self.render_values = np.outer(self.render_values, np.ones(3))
      self.render_values = np.multiply(self.render_values, colors)
    else:
      self.render_values = np.outer(self.render_values, self.color())

  def rainbow_helper(self, offset):
    X = np.sqrt(self.target_values)
    X *= get_pref("rainbowFade")/150
    X += offset
    X = np.mod(X, 1)
    X = 1 - np.absolute(X*3 - 1)
    X = np.maximum(X, 0)
    return np.multiply(X, self.render_values)

  def apply_fade(self):
    now = datetime.now()
    if now > self.end:
      self.update_prefs()
    start_fade = (now - self.start).total_seconds() / get_pref("startFade") / 60
    end_fade = (self.end - now).total_seconds() / get_pref("endFade") / 60
    fade = min(start_fade, end_fade)
    fade = min(fade, 1)
    fade = max(fade, 0)
    self.render_values *= fade

  def apply_min(self):
    self.render_values = np.maximum(self.render_values, get_pref("idleMin")/255)

  def apply_brightness(self):
    self.render_values *= get_pref("brightness") / 100 * self.beat_factor()

  def blend_pixels(self):
    frame_delta = (time() - self.previous_render_time)
    frame_delta *= get_pref("idleFrameRate") / 15
    frame_delta *= exp(2.7 - get_pref("idleBlend")/25)
    if time() - self.previous_beat_time < 0.01:
      frame_delta = 2
    if frame_delta < 1:
      alpha = exp(-10 * frame_delta)
      self.render_values = self.target_values * (1-alpha) + self.previous_values * alpha
      pixel_delta = self.render_values - self.previous_values
      pixel_delta = np.minimum(pixel_delta, frame_delta * 2)
      self.render_values = self.previous_values + pixel_delta
    else:
      self.render_values = self.target_values.copy()

    self.previous_render_time = time()
    self.previous_values = self.render_values.copy()



def rainbow_phase_color():
  color_phase = (time()/get_pref("rainbowDuration")) % 1
  if color_phase < 0.333:
    r = 1 - 3 * color_phase
    g = 3 * color_phase
    b = 0
  elif color_phase < 0.666:
    r = 0
    g = 2 - 3 * color_phase
    b = 3 * color_phase - 1
  else:
    r = 3 * color_phase - 2
    g = 0
    b = 3 - 3 * color_phase
  return np.array((r,g,b))


tod_colors = [
  [0, np.array((0.6, 0.1, 0))],
  [0.1, np.array((0.5, 0.05, 0))],
  [0.2, np.array((0.5, 0.05, 0))],
  [0.2, np.array((0.8, 0.8, 0.8))],
  [0.2, np.array((0.8, 0.8, 0.8))],
  [0.15, np.array((0.7, 0.4, 0.1))],
  [0.15, np.array((0.6, 0.1, 0))],
]
def time_of_day_color():
  color_phase = (time()/10) % 1
  now = datetime.now()
  seconds_since_midnight = (now - now.replace(hour=0, minute=0, second=0, microsecond=0)).total_seconds()
  color_phase = seconds_since_midnight / 86400.0
  return engine.multi_lerp(color_phase, tod_colors)


engine.idle = Idle()
name_to_idle_game["default"] = engine.idle
