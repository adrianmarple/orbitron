#!/usr/bin/env python

import fileinput
import os
import sys
import json

from audio import soundActions, prewarm_audio, musicActions

last_music_action = 0
last_sound_action = 0

def run_core_loop():
  prewarm_audio()
  while True:
    consume_input()

def consume_input():
  for line in fileinput.input():
    try:
      global last_music_action, last_sound_action
      game_state = json.loads(line)
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
