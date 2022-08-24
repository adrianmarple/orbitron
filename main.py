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
  selection = engine.weighted_random(game_selection_weights)

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
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line, file=sys.stderr)


thread = Thread(target=consume_input)
thread.start()

engine.run_core_loop()
