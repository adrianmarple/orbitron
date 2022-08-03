#!/usr/bin/env python

import engine

import fileinput
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

def start_random_game():
  total_weight = 0
  for weight in game_selection_weights.values():
    total_weight += weight

  x = random() * total_weight
  selection = ""
  for (name, weight) in game_selection_weights.items():
    if x < weight:
      selection = name
      break

    x -= weight

  for name in game_selection_weights.keys():
    game_selection_weights[name] += 1
  game_selection_weights[selection] = 0
  engine.start(game_modules[selection].game)


vote_to_message = {}
def check_vote():
  all_votes = {}
  for player in engine.game.claimed_players():
    for (election, vote) in player.votes.items():
      if election not in all_votes:
        all_votes[election] = {}
      all_votes[election][vote] = all_votes[election].get(vote, 0) + 1

  majority_count = len(engine.game.claimed_players()) / 2.0
  consensus_count = len(engine.game.claimed_players())

  for (election, votes) in all_votes.items():
    if election == "ready" and consensus_count == 1:
      continue

    final_vote = None
    for (vote, count) in votes.items():
      # if count > majority_count:
      if count == consensus_count:
        final_vote = vote
        break

    if final_vote is None:
      continue

    message = vote_to_message.get(final_vote, {})
    if "settings" in message:
      engine.config.update(message["settings"])

    if election == "skip":
      if engine.game:
        engine.game.ontimeout()
    elif election == "playagain":
      engine.start(engine.game)
      for player in engine.game.claimed_players():
        player.set_ready()
      if are_all_ready():
        engine.game.ontimeout()
    elif election == "quit":
      engine.start_random_game()

    for player in engine.game.players:
      if election in player.votes:
        del player.votes[election]

def are_all_ready():
  if len(engine.game.claimed_players()) <= 1:
    return False
  for player in engine.game.claimed_players():
    if not player.is_ready:
      return False
  return True

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

      if message["type"] == "claim":
        player.is_claimed = True
      elif message["type"] == "release":
        player.is_claimed = False
        check_vote()
      elif message["type"] == "ready":
        player.set_ready()
        if engine.game.state == "start" and are_all_ready():
          engine.game.ontimeout()
      elif message["type"] == "unready":
        player.set_unready()
      elif message["type"] == "vote":
        vote = message["vote"]
        vote_to_message[vote] = message
        election = message["election"]
        if player.votes.get(election, None) == vote:
          player.votes[election] = ""
        else:
          player.votes[election] = vote
        check_vote()
      elif message["type"] == "move":
        player.move_direction = np.array(message["move"])
        player.last_move_input_time = time()
      elif message["type"] == "pulse":
        player.pulse()
      elif message["type"] == "tap":
        player.tap = time()
      elif message["type"] == "settings":
        engine.game.update_config(message["update"])
      elif message["type"] == "advance":
        if engine.game:
          if not message.get("from", None) or message["from"] == engine.game.state:
            engine.game.ontimeout()
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line, file=sys.stderr)


thread = Thread(target=consume_input)
thread.start()

engine.run_core_loop()
