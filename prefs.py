#!/usr/bin/env python

import json
import numpy as np
import os
import shutil
import sys

from datetime import datetime, timedelta
from math import isnan
from time import sleep, time


def _now(): # Solely for use in testing
  return datetime.now()
  # return datetime.now() + timedelta(days=1, hours=0, minutes=0)
  td = datetime.now() - datetime(year=2025, month=3, day=5)
  time = datetime.now()
  for _ in range(3000):
    time += td
  return time

# To be overwritten by idlepatterns
def set_idle():
  pass

config = json.loads(os.getenv("CONFIG"))

pref_path = os.path.dirname(__file__) + config.get("PREFS_FILE", "/prefs.json")
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
  "patternBias": "0,1,0",
  "useBias": True,
  "rippleWidth": 9,
  "sinDirection": "1,0,0",
  "sinMin": 25,
  "sinRadial": False,
  "sinRadialReverse": False,
  "disableBeatMode": False,

  "hourglassStart": "00:00",
  "hourglassEnd": "23:59",

  # COLOR
  "idleColor": "gradient",
  "brightness": 100,
  "fixedColor": "#ffffff",
  "gradientStartColor": "#25ff59",
  "gradientEndColor": "#00607c",
  "gradientThreshold": 66,
  "fadeToBlack": True,
  "rainbowDuration": 10.0,
  "rainbowFade": 0.0,

  "idleMin": 0,
  "applyIdleMinBefore": False,
}
timing_prefs = {
  "useTimer": False,
  "weeklyTimer": False,
  "schedule": [
    {
      "prefName": "OFF",
      "time": "00:00",
      "fadeIn": 10,
      "fadeOut": 30,
    },
  ],
  "weeklySchedule": [],
  "dimmer": 1.0,
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

def update(update, client_timestamp=None):
  if client_timestamp is None:
    client_timestamp = time()
  if abs(client_timestamp/1000 - time()) > 0.2: # Ignore clients with clocks/latency more that 200 millis off
    client_timestamp = 0

  no_change = True
  for key, value in update.items():
    if current_prefs[key] != value:
      no_change = False
      break
  if no_change:
    return

  if update.get("weeklyTimer", False) and len(current_prefs["weeklySchedule"]) == 0:
    update["weeklySchedule"] = []
    for i in range(7):
      for event in current_prefs["schedule"]:
        new_event = json.loads(json.dumps(event))
        new_event["weekday"] = i
        update["weeklySchedule"].append(new_event)

  if "dimmer" not in update:
    # Turn dimmer back on if not using timer and it's off
    if (current is not None and
        current["prefName"] == "OFF" and
        "useTimer" in update and
        not update["useTimer"] and
        get_pref("useTimer")):
      update["dimmer"] = 1
    # Turn dimmer back on any change to non-timer prefs is being made
    if current_prefs["dimmer"] == 0:
      for key in default_prefs.keys():
        if key in update:
          update["dimmer"] = 1

  for key, value in update.items():
    converted_prefs[key] = None
    pref_to_client_timestamp[key] = client_timestamp
    if key in timing_prefs:
      timing_prefs[key] = value
    else:
      prefs[key] = value

  current_prefs.update(update)
  set_idle()

  if not config.get("TEMP_ORB"):
    debounce_save_prefs()

  should_update_schedule = False
  for key in timing_prefs.keys():
    if key == "dimmer":
      continue
    if key in update:
      should_update_schedule = True
      break
  if get_pref("useTimer") and should_update_schedule:
    update_schedule()
  identify_name()

save_prefs_loop_lock = False
last_modified_time = time() + 10 # Don't save at all for the first bit of time
def debounce_save_prefs(): # Trying to avoid race conditions
  global last_modified_time, save_prefs_loop_lock
  last_modified_time = max(last_modified_time, time())
  if save_prefs_loop_lock:
    return
  save_prefs_loop_lock = True
  while save_prefs_loop_lock:
    if last_modified_time + 0.1 < time():
      f = open(pref_path, "w")
      f.write(json.dumps(prefs, indent=2))
      f.close()
      f = open(timing_pref_path, "w")
      f.write(json.dumps(timing_prefs, indent=2))
      f.close()
      save_prefs_loop_lock = False
      break
    sleep(0.01)


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

def clear(should_set_idle=True):
  global current_pref_name, save_prefs_loop_lock, ignore_updates_until
  current_pref_name = None
  save_prefs_loop_lock = False
  prefs.clear()
  pref_to_client_timestamp.clear()
  converted_prefs.clear()
  current_prefs.clear()
  current_prefs.update(default_prefs)
  current_prefs.update(timing_prefs)
  if should_set_idle:
    set_idle()
  try:
    os.remove(pref_path)
  except OSError:
    pass

def save(name):
  if config.get("TEMP_ORB"):
    return

  global current_pref_name
  current_pref_name = name
  new_path = pref_path_from_name(name)
  saved_prefs[name] = json.loads(json.dumps(prefs)) # deep copy
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
    clear(should_set_idle=False)
    prefs.update(loaded_prefs) # Effectively a copy
    current_prefs.update(loaded_prefs)
    current_prefs.update(timing_prefs)
    for key in default_prefs.keys():
      converted_prefs[key] = None
    current_pref_name = name
    set_idle()
    shutil.copy(old_path, pref_path)

def delete(name):
  path = pref_path_from_name(name)
  if os.path.exists(path):
    os.remove(path)
    pref_names.remove(name)
  else:
    print("Tried to delete non-existant pref: %s" % name, file=sys.stderr)

def rename(original_name, new_name):
  global current_pref_name
  pref_names.remove(original_name)
  if new_name not in pref_names:
    pref_names.append(new_name)
  sort_pref_names()

  saved_prefs[new_name] = saved_prefs[original_name]
  del saved_prefs[original_name]

  if current_pref_name == original_name:
    current_pref_name = new_name

  for event in timing_prefs["schedule"]:
    if event["prefName"] == original_name:
      event["prefName"] = new_name
  
  os.rename(pref_path_from_name(original_name), pref_path_from_name(new_name))
  f = open(timing_pref_path, "w")
  f.write(json.dumps(timing_prefs, indent=2))
  f.close()


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
  elif pref_name == "schedule" or pref_name == "weeklySchedule":
    pref = json.loads(json.dumps(pref)) # deep copy
    for event in pref:
        event["repeated_time"] = RepeatedTime(event)

  converted_prefs[pref_name] = pref
  return pref


start = datetime(1970,1,1,0,0,0,0)
end = start
previous = None
current = None
next = None

def fade():
  if not get_pref("useTimer") or current is None:
    return get_pref("dimmer")
  now = _now()
  if now > end:
    update_schedule()
  if current["prefName"] == "OFF":
    return get_pref("dimmer")

  start_fade_duration = previous.get("fadeIn", 10) if previous["prefName"] == "OFF" else 0.2
  try:
    start_fade_duration = float(start_fade_duration)
  except:
    start_fade_duration = 0.01
    print("fadeIn set to bad value %s" % start_fade_duration, file=sys.stderr)
  if start_fade_duration <= 0:
    start_fade_duration = 0.01
  start_fade = (now - start).total_seconds() / start_fade_duration / 60

  end_fade_duration = next.get("fadeOut", 30) if next["prefName"] == "OFF" else 0.2
  try:
    end_fade_duration = float(end_fade_duration)
  except:
    end_fade_duration = 0.01
    print("fadeOutn set to bad value %s" % end_fade_duration, file=sys.stderr)
  if end_fade_duration <= 0:
    end_fade_duration = 0.01
  end_fade = (end - now).total_seconds() / end_fade_duration / 60
  
  fade = min(start_fade, end_fade)
  fade = min(fade, 1)
  fade = max(fade, 0)
  return min(fade, get_pref("dimmer"))

def advance_manual_fade(): # Consider adding a delay before being callable again
  steps = config.get("MANUAL_FADE_STEPS", [1, 0])
  defacto_fade = fade()
  
  closest_index = 0
  closest_distance = 1
  for i, step in enumerate(steps):
    distance = abs(defacto_fade - step)
    if distance < closest_distance:
      closest_distance = distance
      closest_index = i

  index = (closest_index + 1) % len(steps)
  update({"dimmer": steps[index]})


def update_schedule():
  schedule = get_pref("weeklySchedule") if get_pref("weeklyTimer") else get_pref("schedule")
  if len(schedule) == 0:
    return

  global start, end, previous, current, next

  now = _now()
  now_repeated = RepeatedTime(now)
  if len(schedule) > 1:
    previous = schedule[-2]
  else:
    previous = schedule[-1]
  current = schedule[-1]
  next = schedule[0]
  for event in schedule:
    if cyclic_interval_check(current["repeated_time"], event["repeated_time"], now_repeated):
      next = event
      break
    previous = current
    current = event

  print("Pattern changed to '%s' at %s" % (current["prefName"], now.strftime("%Y-%m-%d %H:%M %A")), file=sys.stderr)

  if previous["prefName"] == "OFF":
    update({"dimmer": 1})
  if current["prefName"] == "OFF":
    update({"dimmer": 0})


  if current["prefName"] != "OFF":
    load(current["prefName"])
  start = current["repeated_time"].combine(now)
  end = next["repeated_time"].combine(now)
  if end < now:
    end += next["repeated_time"].cycle_delta()
  if start > end:
    start -= current["repeated_time"].cycle_delta()
  if end - start > current["repeated_time"].cycle_delta():
    start += current["repeated_time"].cycle_delta()

def cyclic_interval_check(start, end, x):
  return ((start <= end) != (start < x)) != (x < end)

class RepeatedTime():
  def __init__(self, time_thing):
    if isinstance(time_thing, datetime):
      self.time = time_thing.time()
      self.weekday = time_thing.weekday()
    else:
      try:
        self.time = datetime.strptime(time_thing["time"], '%H:%M').time()
      except:
        self.time = datetime.strptime("00:00", '%H:%M').time()
        print("time set to bad value %s" % time_thing["time"], file=sys.stderr)
      self.weekday = time_thing.get("weekday", None)

  def combine(self, datetime):
    combination = datetime.combine(datetime.date(), self.time)
    if self.weekday is not None:
      days_offset = self.weekday - combination.weekday()
      combination += timedelta(days=days_offset)
    return combination

  def __eq__(self, other):
    if self.weekday is None or other.weekday is None:
      return self.time == other.time
    else:
      return self.time == other.time and self.weekday == other.weekday
  def __ge__(self, other):
    if self.weekday is None or other.weekday is None:
      return self.time >= other.time
    else:
      return self.weekday > other.weekday or (self.weekday == other.weekday and self.time >= other.time)
  def __le__(self, other):
    return other >= self
  def __gt__(self, other):
    return not (other >= self)
  def __lt__(self, other):
    return not (self >= other)

  def cycle_delta(self):
    if self.weekday is None:
      return timedelta(days=1)
    else:
      return timedelta(days=7)

# Initial load

def init():
  # Preload all saved prefs
  for file in os.listdir(save_prefs_path):
    name = os.path.basename(file)[:-11]
    load(name, clobber_prefs=False)

  if os.path.exists(pref_path):
    f = open(pref_path, "r")
    try:
      prefs = json.loads(f.read())
    except:
      prefs = {}
      print("Failed to load prefs.json", file=sys.stderr)
    f.close()
    current_prefs.update(prefs)
    identify_name()
  else:
    print("No prefs.json file", file=sys.stderr)

  if os.path.exists(timing_pref_path):
    f = open(timing_pref_path, "r")
    try:
      timing_prefs.update(json.loads(f.read()))
    except:
      print("Failed to load timingprefs.json", file=sys.stderr)
    f.close()
  else:
    print("No timingprefs.json file", file=sys.stderr)
  current_prefs.update(timing_prefs)

  if get_pref("useTimer"):
    update_schedule()

if config.get("PREFS_FILE") or not config.get("TEMP_ORB"):
  init()