

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

def clear_votes():
  for player in engine.players:
    player.vote = ""

def consume_input():
  global current_game, game_module

  for line in fileinput.input():
    try:
      message = json.loads(line)

      if "self" not in message:
        return
      
      player = engine.players[message["self"]]

      if message["type"] == "vote":
        vote = message["vote"]

        if player.vote == vote:
          player.vote = ""
        else:
          player.vote = vote

        majority_count = len(engine.claimed_players()) / 2.0
        vote_count = 0
        for player in engine.claimed_players():
          if player.vote == vote:
            vote_count += 1

        if vote_count >= majority_count:
          # vote passed clear existing votes
          for player in engine.players:
            player.vote = ""

          if vote == "quit":
            game_module = None
            engine.quit()
          else:
            engine.current_game = message["game"]
            if "settings" in message:
              engine.config.update(message["settings"])

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

        engine.broadcast_state()

      elif message["type"] == "move":
        player.move_direction = np.array(message["move"])
        player.last_move_input_time = time()
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
