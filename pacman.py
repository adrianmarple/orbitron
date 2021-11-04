#!/usr/bin/env python

import numpy as np

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random, choice
from time import time, sleep

from audio import sounds, prewarm_audio
import engine
from engine import *


config["NUM_PACMEN"] = 2
config["NUM_GHOSTS"] = 4
config["PACMAN_MOVE_FREQ"] = 0.18
config["GHOST_MOVE_FREQ"] = 0.22
config["WINNING_PELLET_RATIO"] = 0.2
config["GHOST_RANDOMNESS"] = 0.3


battle_channel = None
vamp = None

prewarm_audio(sound_file_names=[
    "battle1.ogg", "battle1Loop.ogg", "victory.mp3", "waiting.ogg",
    "explosion.wav", "kick.wav", "placeBomb.wav", "hurt.wav", "death.wav",
  ], start_loop="waiting")



def pacman_start():
  Pacman(
    position=105,
    color=(190, 200, 5),
    color_string="#dad023") #yellow
  Ghost(
    position=198,
    color=(255, 0, 0),
    color_string="#ff0000") #red
  Ghost(
    position=24,
    color=(200, 5, 30),
    color_string="#e91e63") #pink
  Ghost(
    position=252,
    color=(2, 60, 200),
    color_string="#1e88e5") #cyan
  Pacman(
    position=54,
    color=(200, 180, 2),
    color_string="#d0da23") #yellow
  Ghost(
    position=168,
    color=(200, 50, 0),
    color_string="#ff9800") #orange


def start_update():
  for player in claimed_players():
    if not player.is_ready:
      player.move()

  if engine.state_end_time == 0 and is_everyone_ready(minimum=1):
    for player in players: # TODO adapt to add as many ghosts as needed
      player.is_playing = True
    for i in range(len(statuses)):
      statuses[i] = "pellet"

    engine.state_end_time = time() + 4
    broadcast_state()
    sounds["waiting"].fadeout(4000)


def play_update():
  if battle_channel.get_queue() is None:
    battle_channel.queue(vamp)

  for player in playing_players():
    player.move()


  ghosts_win = True
  for player in playing_players():
    if player.is_pacman and player.is_alive:
      ghosts_win = False
      break

  if ghosts_win:
    gameover("ghosts")

  pellet_count = 0
  for status in statuses:
    if status == "pellet":
      pellet_count += 1

  if pellet_count / 420.0 <= config["WINNING_PELLET_RATIO"]:
    gameover("pacmen")



def start_ontimeout():
  global battle_channel, vamp
  engine.game_state = play_state
  battle_channel = sounds["battle1"].play()
  vamp = sounds["battle1Loop"]

def previctory_ontimeout():
  engine.game_state = victory_state
  engine.state_end_time = time() + 10
  sounds["victory"].play()

  clear()
  for player in players:
    player.reset()

def victory_ontimeout():
  engine.game_state = start_state
  engine.state_end_time = 0
  sounds["victory"].fadeout(1000)
  sounds["waiting"].play(loops=-1, fade_ms=2000)



def render_sandbox():
  if engine.state_end_time > 0:
    countdown = ceil(engine.state_end_time - time())
    countup = 5 - countdown
    render_pulse(
      direction=(0,0,COORD_MAGNITUDE),
      color=np.array((60,60,60)) * countup,
      start_time=engine.state_end_time - countdown,
      duration=READY_PULSE_DURATION)

  for player in claimed_players():
    if player.is_ready:
      player.render_ready()
    else:
      player.render()

def render_game():
  for player in playing_players():
    player.render_ghost_trail()

  for i in range(SIZE):
    if statuses[i] == "blank":
      # already handled
      pass
    elif statuses[i] == "pellet":
      color_pixel(i, (11, 9, 9))

  for player in playing_players():
    player.render()


def gameover(winner):
  engine.game_state = previctory_state
  engine.state_end_time = time() + 2
  if winner == "pacmen":
    engine.victory_color = players[0].color
    engine.victory_color_string = players[0].color_string
  else:
    engine.victory_color = players[1].color
    engine.victory_color_string = players[1].color_string
  battle_channel.stop()
  broadcast_state()


start_state = State("start", start_update, start_ontimeout, render_sandbox)
play_state = State("play", play_update, None, render_game)
previctory_state = State("previctory", None, previctory_ontimeout, render_game)
victory_state = State("victory", start_update, victory_ontimeout, render_victory)


# ================================ PLAYER =========================================

class Pacman(Player):
  def __init__(self, *args, **kwargs):
    Player.__init__(self, *args, **kwargs)
    self.is_pacman = True


  def cant_move(self):
    return (not self.is_alive or
      self.stunned or
      (game_state == start_state and self.is_ready) or # Don't move when marked ready
      time() - self.last_move_time < config["PACMAN_MOVE_FREQ"] or # just moved
      (self.move_direction == ZERO_2D).all()
    )

  def is_occupied(self, position):
    considered_players = claimed_players() if game_state == start_state else playing_players()
    for player in considered_players:
      if player.is_alive and player.is_pacman == self.is_pacman and player.position == position:
        return True
    return False

  def move(self):
    if self.is_alive:
      for player in playing_players():
        if not player.is_pacman and player.position == self.position:
          self.is_alive = False
          broadcast_state()
          return

    Player.move(self)

    # Pacman consumes pellets as they move
    statuses[self.position] = "blank"


class Ghost(Player):
  def __init__(self, *args, **kwargs):
    Player.__init__(self, *args, **kwargs)
    self.is_pacman = False


  def cant_move(self):
    return (self.stunned or
      (game_state == start_state and self.is_ready) or # Don't move when marked ready
      time() - self.last_move_time < config["GHOST_MOVE_FREQ"] or # just moved
      (self.is_claimed and (self.move_direction == ZERO_2D).all())
    )

  def get_next_position(self):
    if self.is_claimed:
      return Player.get_next_position(self)
    else:
      pos = self.position

      if random() < config["GHOST_RANDOMNESS"]:
        new_pos = choice(neighbors[pos])
      else:
        min_dist_sq = 1000
        for player in playing_players():
          if player.is_pacman:
            for neighbor in neighbors[pos]:
              delta = unique_coords[neighbor] - unique_coords[player.position]
              dist_sq = np.dot(delta, delta)
              if dist_sq < min_dist_sq:
                new_pos = neighbor
                min_dist_sq = dist_sq

      return new_pos
      # else: # Just continue in same direction in halls
      #   direction_string = str((self.prev_pos, pos))
      #   if direction_string in next_pixel:
      #     new_pos = next_pixel[direction_string]
      #   else:
      #     return pos


  def is_occupied(self, position):
    considered_players = claimed_players() if game_state == start_state else playing_players()
    for player in considered_players:
      if player.is_alive and player.is_pacman == self.is_pacman and player.position == position:
        return True
    return False


# ================================ Actual Start =========================================

start(pacman_start, start_state)
