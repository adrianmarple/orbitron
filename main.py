

import engine
import bomberman
import pacman
import snektron

import fileinput
import json
import numpy as np
from time import time
from threading import Thread

current_game = "none"
game_module = None

def consume_input():
  global current_game, game_module

  for line in fileinput.input():
    try:
      message = json.loads(line)

      if "self" in message:
        player = engine.players[message["self"]]
      else:
        player = None

      if message["type"] == "quit":
        current_game = "none"
        game_module = None
        engine.quit()
      elif message["type"] == "start":
        current_game = message["game"]
        print("Starting %s" % current_game)
        if current_game == "bomberman":
          game_module = bomberman
        elif current_game == "pacman":
          game_module = pacman
        elif current_game == "snektron":
          game_module = snektron

        game_module.setup()
        engine.start(game_module.start_state)

      elif message["type"] == "move":
        player.move_direction = np.array(message["move"])
      elif message["type"] == "ready":
        player.set_ready()
      elif message["type"] == "unready":
        player.set_unready()
      elif message["type"] == "pulse":
        player.pulse()
      elif message["type"] == "claim":
        player.is_claimed = True
        engine.broadcast_state()
      elif message["type"] == "release":
        player.is_claimed = False
        engine.broadcast_state()
      elif message["type"] == "tap":
        player.tap = time()
      elif message["type"] == "settings":
        engine.config.update(message["update"])
        engine.broadcast_state()
      elif game_module:
        game_module.handle_event(message, player)
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line)


thread = Thread(target=consume_input)
thread.start()

engine.run_core_loop()
