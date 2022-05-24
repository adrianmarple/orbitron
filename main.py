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
  game_modules[module_name] = module
  game_selection_weights[module_name] = 1

def start_game(selection):
  for name in game_selection_weights.keys():
    game_selection_weights[name] += 1.0 / len(game_selection_weights)
  game_selection_weights[selection] = 0
  engine.start(game_modules[selection].game)

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
  for player in engine.claimed_players():
    for (election, vote) in player.votes.items():
      if election not in all_votes:
        all_votes[election] = {}
      all_votes[election][vote] = all_votes[election].get(vote, 0) + 1

  majority_count = len(engine.claimed_players()) / 2.0
  consensus_count = len(engine.claimed_players())

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

    if election == "quit":
      engine.quit()
    elif election == "skip":
      engine.clear_votes()
      if engine.current_game:
        engine.current_game.ontimeout()
    elif election == "start":
      engine.start(game_modules[message["vote"]].game)
    elif election == "ready":
      engine.current_game.ontimeout()
      continue # Don't clear this particular election

    for player in engine.players:
      if election in player.votes:
        del player.votes[election]


def consume_input():
  for line in fileinput.input():
    try:
      message = json.loads(line)

      if "self" not in message:
        continue
      
      player = engine.players[message["self"]]

      if message["type"] == "claim":
        player.is_claimed = True
        # Always start with snektron when first player joins
        if len(engine.claimed_players()) == 1:
          # start_game("colorwar")
          start_game("snektron")
      elif message["type"] == "release":
        player.is_claimed = False
        check_vote()
      elif message["type"] == "vote":
        vote = message["vote"]
        vote_to_message[vote] = message
        election = message["election"]
        if player.votes.get(election, None) == vote:
          player.votes[election] = ""
          if election == "ready":
            player.set_unready()
        else:
          player.votes[election] = vote
          if election == "ready":
            player.set_ready()
        check_vote()
      elif message["type"] == "move":
        player.move_direction = np.array(message["move"])
        player.last_move_input_time = time()
      elif message["type"] == "pulse":
        player.pulse()
      elif message["type"] == "tap":
        player.tap = time()
      elif message["type"] == "settings":
        engine.config.update(message["update"])
      elif message["type"] == "advance":
        if engine.current_game:
          if not message.get("from", None) or message["from"] == engine.current_game.state:
            engine.current_game.ontimeout()
            engine.clear_votes()
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line, file=sys.stderr)


thread = Thread(target=consume_input)
thread.start()

engine.add_quit_listener(start_random_game)
engine.run_core_loop()
