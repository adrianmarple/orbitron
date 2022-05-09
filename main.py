#!/usr/bin/env python

import engine

import fileinput
import json
import pkgutil
import os
import sys
import numpy as np
from time import time
from threading import Thread

game_module = None


game_dir = os.path.join(os.path.dirname(__file__), 'games')
for loader, module_name, _ in pkgutil.walk_packages([game_dir]):
  module = loader.find_module(module_name).load_module(module_name)
  globals()[module_name] = module


def start_game(game):
  global game_module
  engine.current_game = game
  game_module = globals()[game]

  claimed = []
  for player in engine.players:
    claimed.append(player.is_claimed)
  engine.players.clear()
  game_module.setup()
  for (i, player) in enumerate(engine.players):
    if i < len(claimed):
      player.is_claimed = claimed[i]

  engine.start(game_module)


vote_to_message = {}
def check_vote():
  global game_module

  all_votes = {}
  for player in engine.claimed_players():
    for (election, vote) in player.votes.items():
      if election not in all_votes:
        all_votes[election] = {}
      all_votes[election][vote] = all_votes[election].get(vote, 0) + 1

  majority_count = len(engine.claimed_players()) / 2.0

  for (election, votes) in all_votes.items():
    final_vote = None
    for (vote, count) in votes.items():
      if count > majority_count:
        final_vote = vote
        break

    if final_vote is None:
      continue

    message = vote_to_message.get(final_vote, {})
    if "settings" in message:
      engine.config.update(message["settings"])

    if election == "quit":
      game_module = None
      engine.quit()
    elif election == "skip":
      engine.clear_votes()
      if engine.game_state:
        engine.game_state.ontimeout()
    elif election == "start":
      start_game(message["vote"])
    elif election == "ready":
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
          start_game("snektron")
        engine.broadcast_state()
      elif message["type"] == "release":
        player.is_claimed = False
        check_vote()
        engine.broadcast_state()
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
        engine.broadcast_state()
      elif message["type"] == "move":
        player.move_direction = np.array(message["move"])
        player.last_move_input_time = time()
      elif message["type"] == "pulse":
        player.pulse()
      elif message["type"] == "tap":
        player.tap = time()
      elif message["type"] == "settings":
        engine.config.update(message["update"])
        engine.broadcast_state()
      elif message["type"] == "advance":
        if engine.game_state:
          if not message.get("from", None) or message["from"] == engine.game_state.name:
            engine.game_state.ontimeout()
            engine.clear_votes()
      elif game_module:
        game_module.handle_event(message, player)
    except json.decoder.JSONDecodeError:
      print("Bad input:\n%s" % line, file=sys.stderr)


thread = Thread(target=consume_input)
thread.start()

engine.run_core_loop()
