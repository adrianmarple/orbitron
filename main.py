

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

def start_game(game, settings=None):
  global game_module
  engine.current_game = game
  if settings:
    engine.config.update(settings)

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


vote_to_message = {}
def check_vote():
  global game_module

  votes = {}
  for player in engine.claimed_players():
    if player.vote:
      votes[player.vote] = votes.get(player.vote, 0) + 1

  majority_count = len(engine.claimed_players()) / 2.0
  final_vote = None
  for (vote, count) in votes.items():
    if count >= majority_count:
      final_vote = vote
      break

  if not final_vote:
    return

  if final_vote == "quit":
    game_module = None
    engine.quit()
  elif final_vote == "skip":
    engine.game_state.ontimeout()
  else:
    message = vote_to_message[final_vote]
    settings = None
    if "settings" in message:
      settings = message["settings"]
    start_game(message["game"], settings)


def consume_input():

  for line in fileinput.input():
    try:
      message = json.loads(line)

      if "self" not in message:
        return
      
      player = engine.players[message["self"]]

      if message["type"] == "claim":
        player.is_claimed = True
        # Always start with snektron when first player joins
        if len(engine.claimed_players()) == 1:
          start_game("snektron")
        engine.broadcast_state()
      elif message["type"] == "release":
        player.is_claimed = False
        check_vote()
        engine.broadcast_state()
      elif message["type"] == "vote":
        vote = message["vote"]
        vote_to_message[vote] = message
        if player.vote == vote:
          player.vote = ""
        else:
          player.vote = vote
        check_vote()
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
