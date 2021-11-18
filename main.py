

import engine
import bomberman
import pacman
import snektron

import fileinput
import json
import numpy as np
from time import time
from threading import Thread

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

      if message["type"] == "vote":
        pass # TODO combine quit and start into vote

      if message["type"] == "quit":
        game_module = None
        engine.quit()
      elif message["type"] == "start":
        engine.current_game = message["game"]

        if engine.current_game == "bomberman":
          game_module = bomberman
        elif engine.current_game == "pacman":
          game_module = pacman
        elif engine.current_game == "snektron":
          game_module = snektron

        claimed = []
        for player in engine.players:
          claimed.append(player.is_claimed)
        engine.players.clear()
        game_module.setup()
        for (i, player) in enumerate(engine.players):
          if i < len(claimed):
            player.is_claimed = claimed[i]

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
