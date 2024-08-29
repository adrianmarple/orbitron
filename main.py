#!/usr/bin/env python

import prefs
import engine
import idlepatterns # Required to set initial idle pattern

import fileinput
import json
import pkgutil
import os
import sys
import numpy as np
from time import time
from threading import Thread

config = json.loads(os.getenv("CONFIG"))

game_selection_weights = {}
game_modules = {}

game_dir = os.path.join(os.path.dirname(__file__), 'games')
for loader, module_name, _ in pkgutil.walk_packages([game_dir]):
  module = loader.find_module(module_name).load_module(module_name)
  engine.games[module_name] = module.game
  engine.game_selection_weights[module_name] = 1


def check_all_ready():
  if engine.game.state != "start":
    return
  if len(engine.game.claimed_players()) <= 1:
    return
  for player in engine.game.claimed_players():
    if not player.is_ready:
      return
  engine.game.ontimeout()

def consume_input():
  for line in fileinput.input():
    try:
      message = json.loads(line)

      # Commands from orb.js
      if message["type"] == "start":
        engine.start(engine.games[message["game"]])
        continue
      elif message["type"] == "text":
        engine.display_text(message["text"], priority=message.get("priority", 0))
        continue

      # Global commands
        # Game stuff
      if message["type"] == "advance":
        if not message.get("from", None) or message["from"] == engine.game.state:
          engine.game.ontimeout()
      elif message["type"] == "skip":
        engine.start_random_game()
      elif message["type"] == "playagain":
        engine.start(engine.game)
      elif message["type"] == "settings":
        engine.game.update_settings(message["update"])
      elif message["type"] == "leave":
        engine.game = None
        # Prefs stuff
      if message["type"] == "prefs":
        prefs.update(message["update"], client_timestamp=message["timestamp"])
      elif message["type"] == "clearPrefs":
        prefs.clear()
      elif message["type"] == "savePrefs":
        prefs.save(message["name"])
      elif message["type"] == "loadPrefs":
        prefs.load(message["name"])
      elif message["type"] == "deletePrefs":
        prefs.delete(message["name"])

      if "self" not in message or message["self"] is None:
        continue
      if not engine.game:
        continue

      player = engine.game.players[message["self"]]

      # Player commands
      if message["type"] == "claim":
        player.is_claimed = True
      elif message["type"] == "release":
        player.is_claimed = False
        check_all_ready()
        if config.get("CLEAR_PREFS_ON_DISCONNECT") and len(engine.game.claimed_players()) == 0:
          prefs.clear()
      elif message["type"] == "ready":
        player.set_ready()
        check_all_ready()
      elif message["type"] == "unready":
        player.set_unready()
      elif message["type"] == "move":
        player.move_direction = np.array(message["move"])
        player.last_move_input_time = time()
      elif message["type"] == "tap":
        player.tap = time()
      elif message["type"] == "pulse":
        player.pulse()
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line, file=sys.stderr)


thread = Thread(target=consume_input)
thread.start()

engine.run_core_loop()
