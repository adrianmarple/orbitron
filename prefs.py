#!/usr/bin/env python

import json
import numpy as np
import os
import shutil
import sys

from datetime import datetime, timedelta
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

  "idleMin": 0,
  "applyIdleMinBefore": False,
}
timing_prefs = {
  "useTimer": False,
  "schedule": [
    {
      "prefName": "OFF",
      "time": "00:00",
      "fadeIn": 10,
      "fadeOut": 30,
    },
  ],
}
default_prefs["idlePattern"] = config.get("IDLE", default_prefs["idlePattern"])

pref_type = {}
for (key, value) in list(default_prefs.items()) + list(timing_prefs.items()):
  pref_type[key] = type(value)
  if pref_type[key] == str and value[0] == "#":
    pref_type[key] = "color"
  if pref_type[key] == str and "," in value:
    pref_type[key] = "vector"

saved_prefs = {}
prefs = {}
current_pref_name = None

converted_prefs = {}
pref_to_client_timestamp = {}
current_prefs = {}
current_prefs.update(default_prefs)
current_prefs.update(timing_prefs)


if not os.path.exists(save_prefs_path):
  os.makedirs(save_prefs_path)

def sort_pref_names():
  pref_names.sort(key=lambda v: v.upper())

pref_names = next(os.walk(save_prefs_path), (None, None, []))[2]  # [] if no file
pref_names = [filename.split(".")[0] for filename in pref_names]
sort_pref_names()

def update(update, client_timestamp=0):
  if abs(client_timestamp/1000 - time()) > 0.2: # Ignore clients with clocks/latency more that 200 millis off
      client_timestamp = 0
  for key, value in update.items():
    converted_prefs[key] = None
    pref_to_client_timestamp[key] = client_timestamp
    if key in timing_prefs:
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

  identify_name()
  if get_pref("useTimer") and ("schedule" in update or "useTimer" in update):
    update_schedule()

def identify_name():
  global current_pref_name
  for (name, saved_pref) in saved_prefs.items():
    if are_prefs_equivalent(prefs, saved_pref):
      current_pref_name = name
      return
  current_pref_name = None

def are_prefs_equivalent(a, b):
  for key in default_prefs.keys():
    if a.get(key, default_prefs[key]) != b.get(key, default_prefs[key]):
      return False
  return True

def clear():
  global prefs, current_prefs, converted_prefs
  prefs.clear()
  pref_to_client_timestamp.clear()
  converted_prefs.clear()
  current_prefs.clear()
  current_prefs.update(default_prefs)
  current_prefs.update(timing_prefs)
  if os.path.exists(pref_path):
    os.remove(pref_path)

def save(name):
  new_path = pref_path_from_name(name)
  saved_prefs[name] = prefs
  shutil.copy(pref_path, new_path)
  if name not in pref_names:
    pref_names.append(name)
    sort_pref_names()


def load(name, clobber_prefs=True):
  global current_pref_name, current_prefs, prefs
  old_path = pref_path_from_name(name)
  if not os.path.exists(old_path):
    print("Tried to load non-existant pref: %s" % name, file=sys.stderr)
    return
  
  if name in saved_prefs:
    loaded_prefs = saved_prefs[name]
  else:
    f = open(old_path, "r")
    loaded_prefs = json.loads(f.read())
    saved_prefs[name] = loaded_prefs
    f.close()

  if clobber_prefs:
    clear()
    shutil.copy(old_path, pref_path)
    prefs.update(loaded_prefs) # Effitively a copy
    current_prefs.update(loaded_prefs)
    current_prefs.update(timing_prefs)
    for key in default_prefs.keys():
      converted_prefs[key] = None
    current_pref_name = name

def delete(name):
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
  elif pref_name == "schedule":
    pref = json.loads(json.dumps(pref)) # deep copy
    for event in pref:
      event["time"] = datetime.strptime(event["time"], '%H:%M').time()

  converted_prefs[pref_name] = pref
  return pref


start = datetime(1970,1,1,0,0,0,0)
end = start
previous = None
current = None
next = None

def fade():
  if not get_pref("useTimer"):
    return 1
  if current["prefName"] == "OFF":
    return 0
  now = datetime.now()
  if now > end:
    update_schedule()

  start_fade_duration = previous.get("fadeIn", 10) if previous["prefName"] == "OFF" else 0.2
  try:
    start_fade_duration = float(start_fade_duration)
  except:
    start_fade_duration = 0.01
  if start_fade_duration <= 0:
    start_fade_duration = 0.01
  start_fade = (now - start).total_seconds() / start_fade_duration / 60

  end_fade_duration = next.get("fadeOut", 30) if next["prefName"] == "OFF" else 0.2
  try:
    end_fade_duration = float(end_fade_duration)
  except:
    end_fade_duration = 0.01
  if end_fade_duration <= 0:
    end_fade_duration = 0.01
  end_fade = (end - now).total_seconds() / end_fade_duration / 60
  
  fade = min(start_fade, end_fade)
  fade = min(fade, 1)
  fade = max(fade, 0)
  return fade

def update_schedule():
  schedule = get_pref("schedule")
  if len(schedule) == 0:
    return

  global start, end, previous, current, next

  now = datetime.now()
  now_date = now.date()
  now_time = now.time()
  previous = schedule[-1]
  current = schedule[-1]
  next = schedule[0]
  for event in schedule:
    if cyclic_interval_check(current["time"], event["time"], now_time):
      next = event
      break
    previous = current
    current = event

  if current["prefName"] != "OFF":
    load(current["prefName"])
  start = datetime.combine(now_date, current["time"])
  end = datetime.combine(now_date, next["time"])
  if end < now:
    end += timedelta(days=1)
  if start > end:
    start -= timedelta(days=1)
  if end - start > timedelta(days=1):
    start += timedelta(days=1)

def cyclic_interval_check(start, end, x):
  return ((start <= end) != (start < x)) != (x < end)


# Initial load

# Preload all saved prefs
for file in os.listdir(save_prefs_path):
  name = os.path.basename(file)[:-11]
  load(name, clobber_prefs=False)

if os.path.exists(pref_path):
  f = open(pref_path, "r")
  prefs = json.loads(f.read())
  f.close()
  current_prefs.update(prefs)
  identify_name()
  
  # Convert old timer info
  if "hasStartAndEnd" in prefs:
    timing_prefs["useTimer"] = prefs["hasStartAndEnd"]
  if current_pref_name is not None:
    timing_prefs["schedule"] = [
      {
        "time": prefs.get("startTime", "00:00"),
        "prefName": current_pref_name,
      },
      {
        "time": prefs.get("endTime", "23:59"),
        "prefName": "OFF",
        "fadeIn": prefs.get("startFade", 10),
        "fadeOut": prefs.get("endFade", 30),
      },
    ]

if os.path.exists(timing_pref_path):
  f = open(timing_pref_path, "r")
  timing_prefs.update(json.loads(f.read()))
  f.close()
current_prefs.update(timing_prefs)

if get_pref("useTimer"):
  update_schedule()
