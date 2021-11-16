

import engine
import bomberman
import pacman
# import snektron

import fileinput
import json
import numpy as np
from time import time
from threading import Thread

current_game = "none"

def consume_input():
  global current_game

  for line in fileinput.input():
    try:
      message = json.loads(line)

      if "self" in message:
        player = engine.players[message["self"]]

      if message["type"] == "quit":
        current_game = "none"
        engine.quit()
      elif message["type"] == "start":
        current_game = message["game"]
        print("Starting %s" % current_game)
        # TODO transfer claimed players
        if current_game == "bomberman":
          bomberman.bomberman_start()
          engine.start(bomberman.start_state)
        elif current_game == "pacman":
          pacman.pacman_start()
          engine.start(pacman.start_state)
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
      else:
        print("Unknown message type:")
        print(message)
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line)


thread = Thread(target=consume_input)
thread.start()

engine.run_core_loop()
