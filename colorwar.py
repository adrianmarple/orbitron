#!/usr/bin/env python

import numpy as np
import sys

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random, choice
from time import time, sleep
import collections

from audio import sounds, music
import engine
from engine import *

name = "colorwar"

config["REQUIRED_LEAD_TIME"] = 10
config["LEAD_THRESHOLD"] = 20
config["FIXED_TIME_ROUNDS"] = False
config["ROUND_TIME"] = 94.6
# config["COLOR_MOVE_FREQ"] = 0.25


def setup():
  Inkling(position=105,
    color=(0, 200, 0),
    color_string="#4caf50") #green
  Inkling(position=198,
    color=(1, 12, 200),
    color_string="#1e88e5") #blue
  Inkling(position=24,
    color=(200, 2, 20),
    color_string="#e91e63") #pink
  Inkling(position=252,
    color=(100, 0, 250),
    color_string="#9575cd") #deep purple
  Inkling(position=168,
    color=(180, 200, 5),
    color_string="#c0ca33") #lime
  Inkling(position=311,
    color=(200, 50, 0),
    color_string="#ff9800") #orange

def handle_event(message, player):
  pass


def start_update():
  for player in claimed_players():
    player.move()

def countdown_ontimeout():
  data["current_leader"] = -1
  if config["FIXED_TIME_ROUNDS"]:
    engine.state_end_time = time() + config["ROUND_TIME"]
  else:
    engine.state_end_time = 0
  engine.game_state = play_state
  music["snekBattle"].play()


def play_update():
  for player in playing_players():
    player.move()

  counts = {}
  for i in range(SIZE):
    inkling = statuses[i]
    if inkling != "blank":
      counts[inkling] = counts.get(inkling, 0) + 1

  leader = None
  runner_up = None
  for (inkling, score) in counts.items():
    inkling.score = score
    if leader is None or leader.score < score:
      runner_up = leader
      leader = inkling
    elif runner_up is None or runner_up.score < score:
      runner_up = inkling

  print(leader.score, file=sys.stderr)
  print(runner_up.score, file=sys.stderr)

  if not config["FIXED_TIME_ROUNDS"]:
    if data["current_leader"] >= 0: #someone is in the lead
      if leader.id != data["current_leader"]:
        engine.state_end_time = 0
        data["current_leader"] = -1
    elif leader.score - runner_up.score > config["LEAD_THRESHOLD"]:
      engine.state_end_time = time() + config["REQUIRED_LEAD_TIME"]
      data["current_leader"] = leader.id



def play_ontimeout():
  music["snekBattle"].fadeout(1000)
  engine.game_state = previctory_state
  top_score = 0
  top_score_time = 0
  for player in playing_players():
    if player.score > top_score or (player.score == top_score and player.score_timestamp < top_score_time):
      top_score = player.score
      top_score_time = player.score_timestamp
      engine.victor = player
  engine.state_end_time = time() + 1

def previctory_ontimeout():
  engine.game_state = victory_state
  engine.state_end_time = time() + config["VICTORY_TIMEOUT"]
  music["victory"].play()

def render_game():
  countdown_length = 7 if engine.game_state == play_state else 5
  if engine.game_state == play_state and engine.state_end_time > 0 and engine.state_end_time - time() < 7:
    countdown = ceil(engine.state_end_time - time())
    countup = 7 - countdown
    render_pulse(
      direction=(0,0,COORD_MAGNITUDE),
      color=np.array((60,60,60)) * countup,
      start_time=engine.state_end_time - countdown,
      duration=READY_PULSE_DURATION)

  for i in range(SIZE):
    if statuses[i] != "blank":
      color_pixel(i, statuses[i].color / 8)



  if engine.game_state == countdown_state:
    for player in playing_players():
      player.render_ready()
  else:
    for player in current_players():
      player.render()



start_state = State("start", start_update, start_ontimeout, render_game)
countdown_state = State("countdown", None, countdown_ontimeout, render_countdown)
play_state = State("play", play_update, play_ontimeout, render_game)
previctory_state = State("previctory", None, previctory_ontimeout, render_game)
victory_state = State("victory", None, victory_ontimeout, render_victory)


# ================================ PLAYER =========================================

class Inkling(Player):
  def move(self):
    Player.move(self)
    statuses[self.position] = self

