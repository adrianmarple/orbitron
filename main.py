#!/usr/bin/env python

import engine

import fileinput
import importlib
import json
import pkgutil
import os
import sys
import numpy as np
from random import random
from time import time
from threading import Thread

game_selection_weights = {}
game_modules = {}


game_dir = os.path.join(os.path.dirname(__file__), 'games')
for loader, module_name, _ in pkgutil.walk_packages([game_dir]):
  module = loader.find_module(module_name).load_module(module_name)
  engine.games[module_name] = module.game
  engine.game_selection_weights[module_name] = 1

idle_module_name = os.getenv("IDLE")
if idle_module_name:
  path = "%s/idlepatterns/%s.py" % (os.path.dirname(__file__), idle_module_name)
  spec = importlib.util.spec_from_file_location(idle_module_name, path)
  module = importlib.util.module_from_spec(spec)
  spec.loader.exec_module(module)
  engine.idle = module.idle

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

      if message["type"] == "start":
        engine.start(engine.games[message["game"]])

      if "self" not in message:
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
      # Global commands
      elif message["type"] == "advance":
        if not message.get("from", None) or message["from"] == engine.game.state:
          engine.game.ontimeout()
      elif message["type"] == "skip":
        engine.start_random_game()
      elif message["type"] == "playagain":
        engine.start(engine.game)
      elif message["type"] == "settings":
        engine.game.update_config(message["update"])
      elif message["type"] == "prefs":
        engine.update_prefs(message["update"])
      elif message["type"] == "text":
        engine.display_text(message["text"])
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line, file=sys.stderr)


thread = Thread(target=consume_input)
thread.start()

engine.run_core_loop()
