#!/usr/bin/env python

import fileinput
import os
import sys
import json
from time import time
import math

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from audio import soundActions, prewarm_audio, musicActions

last_music_action = 0
last_sound_action = 0
min_delta = math.inf
max_delta = -math.inf
num_delta = 0
start_time = time()
over_01 = 0
over_02 = 0
over_03 = 0
over_04 = 0
over_05 = 0
ds_counts = [0] * 6
ms_counts = [0] * 20

def run_core_loop():
  prewarm_audio()
  while True:
    consume_input()

def consume_input():
  for line in fileinput.input():
    try:
      global last_music_action, last_sound_action, min_delta, max_delta, num_delta, over_01, over_02, over_03, over_04, over_05
      game_state = json.loads(line)
      if os.getenv("LOG_LATENCY") and "timestamp" in game_state:
        t = float(game_state["timestamp"])
        ct = time()
        dt = ct - t
        num_delta = num_delta + 1
        if num_delta > 20 and dt > 0.0:
          min_delta = min(dt,min_delta)
          max_delta = max(dt,max_delta)
          print("min = %s; max = %s; num: %s; delta = %s; time = %s" % (min_delta, max_delta, num_delta, dt, time()-start_time), file=sys.stderr)

          if dt < 0.02:
            ms_counts[math.floor(dt * 1000)] += 1
          print([math.floor(1000 * count / num_delta) for count in ms_counts], file=sys.stderr)

          if dt < 0.5:
            ds_counts[math.floor(dt * 10)] += 1
          else:
            ds_counts[5] += 1
          print("over .1:%s--.2:%s--.3:%s--.4:%s--.5:%s" % (ds_counts[1], ds_counts[2], ds_counts[3], ds_counts[4], ds_counts[5]), file=sys.stderr)
      for action in game_state["soundActions"]:
        asplit = action.split(";")
        t = float(asplit[0])
        if t > last_sound_action:
          last_sound_action = t
          a = "%s;%s;%s" % (asplit[1], asplit[2], (asplit[3] if len(asplit) > 3 else ""))
          soundActions.append(a)

      for action in game_state["musicActions"]:
        msplit = action.split(";")
        t = float(msplit[0])
        if t > last_music_action:
          last_music_action = t
          a = "%s;%s;%s" % (msplit[1], msplit[2], (msplit[3] if len(msplit) > 3 else ""))
          musicActions.append(a)
    except Exception as e:
      if type(e) is not KeyError:
        print("audio input error:\n%s" % type(e), file=sys.stderr)

run_core_loop()