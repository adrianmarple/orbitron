#!/usr/bin/env python

import json
import numpy as np
import os
import shutil
import sys

from time import sleep, time

config = json.loads(os.getenv("CONFIG"))

pref_path = os.path.dirname(__file__) + "/prefs.json"
timing_pref_path = os.path.dirname(__file__) + "/timingprefs.json"
save_prefs_path = os.path.dirname(__file__) + "/savedprefs/"
def pref_path_from_name(name):
  return save_prefs_path + name + ".prefs.json"

default_prefs = {
  # PATTERN
  "idlePattern": "default",
  "idleFrameRate": 15.0,
  "idleBlend": 60.0,
  "idleDensity": 70.0,
  "staticRotation": False,
  "staticRotationTime": 8.0, 
  "staticDirection": "1,1,0",
  "patternBias": "0,0,0",
  "rippleWidth": 9,
  "sinDirection": "1,0,0",
  "sinMin": 25,

  # COLOR
  "idleColor": "gradient",
  "brightness": 100,
  "fixedColor": "#ffffff",
  "gradientStartColor": "#ffa214",
  "gradientEndColor": "#ff6000",
  "gradientThreshold": 66,
  "fadeToBlack": True,
  "rainbowDuration": 10.0,
  "rainbowFade": 0.0,
}
default_timing_prefs = {
  "startTime": "00:00",
  "endTime": "23:59",
  "idleMin": 0,
  "applyIdleMinBefore": False,
  "hasStartAndEnd": False,
  "fadeDuration": 30,
  "startFade": 10,
  "endFade": 30,
}
default_prefs["idlePattern"] = config.get("IDLE", default_prefs["idlePattern"])

pref_type = {}
for (key, value) in list(default_prefs.items()) + list(default_timing_prefs.items()):
  pref_type[key] = type(value)
  if pref_type[key] == str and value[0] == "#":
    pref_type[key] = "color"
  if pref_type[key] == str and "," in value:
    pref_type[key] = "vector"

prefs = {}
timing_prefs = {}

converted_prefs = {}
pref_to_client_timestamp = {}
current_prefs = {}
current_prefs.update(default_prefs)
current_prefs.update(default_timing_prefs)


if not os.path.exists(save_prefs_path):
  os.makedirs(save_prefs_path)

def sort_pref_names():
  pref_names.sort(key=lambda v: v.upper())

pref_names = next(os.walk(save_prefs_path), (None, None, []))[2]  # [] if no file
pref_names = [filename.split(".")[0] for filename in pref_names]
sort_pref_names()

def update_prefs(update, client_timestamp=0):
  if abs(client_timestamp/1000 - time()) > 0.2: # Ignore clients with clocks/latency more that 200 millis off
      client_timestamp = 0
  for key, value in update.items():
    converted_prefs[key] = None
    pref_to_client_timestamp[key] = client_timestamp
    if key in default_timing_prefs:
      timing_prefs[key] = value
    else:
      prefs[key] = value
  current_prefs.update(update)
  f = open(pref_path, "w")
  f.write(json.dumps(prefs, indent=2))
  f.close()
  f = open(timing_pref_path, "w")
  f.write(json.dumps(timing_prefs, indent=2))
  f.close()

def clear_prefs():
  global prefs, current_prefs, converted_prefs
  prefs.clear()
  pref_to_client_timestamp.clear()
  converted_prefs.clear()
  current_prefs.clear()
  current_prefs.update(default_prefs)
  current_prefs.update(default_timing_prefs)
  if os.path.exists(pref_path):
    os.remove(pref_path)

def save_prefs(name):
  new_path = pref_path_from_name(name)
  shutil.copy(pref_path, new_path)
  if name not in pref_names:
    pref_names.append(name)
    sort_pref_names()

def load_prefs(name=None):
  global current_prefs, prefs, timing_prefs
  if name is not None:
    clear_prefs()
    old_path = pref_path_from_name(name)
    if os.path.exists(old_path):
      shutil.copy(old_path, pref_path)
    else:
      print("Tried to load non-existant pref: %s" % name, file=sys.stderr)

  timing_prefs = {}
  if os.path.exists(pref_path):
    f = open(pref_path, "r")
    prefs = json.loads(f.read())
    f.close()
    current_prefs.update(prefs)
    for key in prefs.keys():
      converted_prefs[key] = None
    for key in default_timing_prefs.keys():
      if key in prefs:
        timing_prefs[key] = prefs[key]
        del prefs[key]
  else:
    prefs = {}

  if os.path.exists(timing_pref_path):
    f = open(timing_pref_path, "r")
    timing_prefs.update(json.loads(f.read()))
    f.close()
    current_prefs.update(timing_prefs)
    for key in timing_prefs.keys():
      converted_prefs[key] = None
  else:
    timing_prefs = {}

def delete_prefs(name):
  path = pref_path_from_name(name)
  if os.path.exists(path):
    os.remove(path)
    pref_names.remove(name)
  else:
    print("Tried to delete non-existant pref: %s" % name, file=sys.stderr)

def get_pref(pref_name):
  converted_pref = converted_prefs.get(pref_name, None)
  if converted_pref is not None:
    return converted_pref

  pref = current_prefs[pref_name]
  if pref_type[pref_name] == int:
    pref = int(pref)
  elif pref_type[pref_name] == float:
    pref = float(pref)
  elif pref_type[pref_name] == "color":
    pref = pref.lstrip('#')
    pref = tuple(int(pref[i:i+2], 16) for i in (0, 2, 4))
    pref = np.array(pref)
  elif pref_type[pref_name] == "vector":
    pref = pref.split(",")
    pref = [float(x) for x in pref]
    pref = np.array(pref)

  converted_prefs[pref_name] = pref
  return pref

load_prefs()
