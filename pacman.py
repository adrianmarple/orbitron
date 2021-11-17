#!/usr/bin/env python

import numpy as np

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random, choice
from time import time, sleep

from audio import sounds, prewarm_audio
import engine
from engine import *


config["PACMEN_LIVES"] = 3
config["NUM_PACMEN"] = 2
config["NUM_GHOSTS"] = 5
config["STARTING_POWER_PELLET_COUNT"] = 4
config["POWER_PELLET_DURATION"] = 10
config["PACMAN_MOVE_FREQ"] = 0.18
config["PACMAN_POWER_MOVE_FREQ"] = 0.12
config["GHOST_MOVE_FREQ"] = 0.22
config["GHOST_SCARED_MOVE_FREQ"] = 0.3
config["GHOST_RANDOMNESS"] = 0.1
config["PELLET_SCORE"] = 10
config["POWER_PELLET_SCORE"] = 50
config["GHOST_KILL_SCORE"] = 200
config["VICTORY_SCORE"] = 3000
config["MULTI_PACMAN_VICTORY_SCORE"] = 5000
config["PELLET_REGEN_FREQ"] = 3
config["POWER_PELLET_REGEN_FREQ"] = 20


battle_channel = None
vamp = None

power_pellet_start_time = 0
are_ghosts_scared = False
data["score"] = 0

prewarm_audio(sound_file_names=[
    "battle1.ogg", "battle1Loop.ogg", "dm1.ogg", "dm1Loop.ogg","waiting.ogg","victory.mp3", 
    "kick.wav", "placeBomb.wav", "hurt.wav", "death.wav", "explosion.wav"
  ],
  #stubs=["battle1.ogg", "battle1Loop.ogg", "dm1.ogg", "dm1Loop.ogg","waiting.ogg","victory.mp3"]
  #, start_loop="waiting"
  )

scaredy_ghost_color = np.array((0,0,255))

ghost_colors = [
  np.array((255, 0, 0)),
  np.array((200, 5, 30)),
  np.array((0, 200, 0)),
  np.array((200, 50, 0)),
  np.array((50, 0, 150)),
  np.array((180, 200, 5)),
]
ghost_color_strings = [
  "#ff0000",
  "#e91e63",
  "#4caf50",
  "#ff9800",
  "#9575cd",
  "#c0ca33",
]

def setup():
  Pacman(position=105)
  Ghost(position=198)
  Ghost(position=24)
  Ghost(position=252)
  Ghost(position=168)
  Ghost(position=311)
  Ghost(position=76)

def handle_event(message, player):
  if message["type"] == "roleChange":
    if message["role"] == "ghost":
      new_player = Ghost(template_player=player)
    else:
      new_player = Pacman(template_player=player)
    broadcast_state()


def start_update():
  for player in claimed_players():
    if not player.is_ready:
      player.move()

  if engine.state_end_time == 0 and is_everyone_ready(minimum=1):
    for pacman in pacmen():
      if pacman.is_claimed:
        pacman.is_playing = True

    ghost_count = 0
    for ghost in ghosts():
      if ghost.is_claimed:
        ghost.is_playing = True
        ghost_count += 1

    # Suppliment with AI ghosts
    for ghost in ghosts():
      if ghost_count >= config["NUM_GHOSTS"]:
        break
      if not ghost.is_claimed:
        ghost.is_playing = True
        ghost.set_color()
        ghost_count += 1

    for i in range(len(statuses)):
      statuses[i] = "pellet"

    for i in range(config["STARTING_POWER_PELLET_COUNT"]):
      statuses[randrange(len(statuses))] = "power"

    engine.state_end_time = time() + 4
    broadcast_state()
    sounds["waiting"].fadeout(4000)


def play_update():
  if battle_channel.get_queue() is None:
    battle_channel.queue(vamp)

  for player in playing_players():
    player.move()

  global are_ghosts_scared
  if are_ghosts_scared and time() - power_pellet_start_time > config["POWER_PELLET_DURATION"]:
    are_ghosts_scared = False

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

  victory_score = config["VICTORY_SCORE"] if len(pacmen()) == 1 else config["MULTI_PACMAN_VICTORY_SCORE"]
  if data["score"] >= victory_score:
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
  data["score"] = 0
  sounds["victory"].fadeout(1000)
  sounds["waiting"].play(loops=-1, fade_ms=2000)
  global are_ghosts_scared
  are_ghosts_scared = False


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

  power_color = np.array((255,255,255))*(0.55 + 0.45*sin(time() * 4))
  for i in range(SIZE):
    if statuses[i] == "blank":
      # already handled
      pass
    elif statuses[i] == "pellet":
      color_pixel(i, (10, 10, 10))
    elif statuses[i] == "power":
      color_pixel(i, power_color)

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

def ghosts():
  return [player for player in players if not player.is_pacman]
def pacmen():
  return [player for player in players if player.is_pacman]


start_state = State("start", start_update, start_ontimeout, render_sandbox)
play_state = State("play", play_update, None, render_game)
previctory_state = State("previctory", None, previctory_ontimeout, render_game)
victory_state = State("victory", start_update, victory_ontimeout, render_victory)


# ================================ PLAYER =========================================

class Pacman(Player):
  def __init__(self, *args, **kwargs):
    kwargs["color"] = (190, 195, 5)
    kwargs["color_string"] = "#e7e023"
    Player.__init__(self, *args, **kwargs)
    self.is_pacman = True

  def reset(self):
    Player.reset(self)
    self.lives_left = config["PACMEN_LIVES"]


  def cant_move(self):
    is_fast = are_ghosts_scared or time() - self.hit_time < config["INVULNERABILITY_TIME"]
    move_freq = config["PACMAN_POWER_MOVE_FREQ"] if is_fast else config["PACMAN_MOVE_FREQ"]
    return (not self.is_alive or
      self.stunned or
      (engine.game_state == start_state and self.is_ready) or # Don't move when marked ready
      time() - self.last_move_time < move_freq or # just moved
      (self.move_direction == ZERO_2D).all()
    )

  def is_occupied(self, position):
    considered_players = claimed_players() if engine.game_state == start_state else playing_players()
    for player in considered_players:
      if player.is_alive and player.is_pacman == self.is_pacman and player.position == position:
        return True
    return False

  def move(self):
    global power_pellet_start_time, are_ghosts_scared

    if self.is_alive and engine.game_state != start_state:
      for ghost in ghosts():
        if ghost.is_playing and ghost.position == self.position:
          if are_ghosts_scared:
            ghost.stunned = True
            ghost.position = unique_antipodes[ghost.position]
            ghost.hit_time = time()
            data["score"] += config["GHOST_KILL_SCORE"]
            broadcast_state()
            break
          elif time() - self.hit_time > config["INVULNERABILITY_TIME"]:
            self.hit_time = time()
            self.lives_left -= 1
            if self.lives_left < 0:
              self.is_alive = False
            broadcast_state()
            break

    if not self.is_alive:
      return

    Player.move(self)

    # Pacman consumes pellets as they move
    if statuses[self.position] == "power":
      power_pellet_start_time = time()
      are_ghosts_scared = True
      data["score"] += config["POWER_PELLET_SCORE"]
      statuses[self.position] = "blank"
    elif statuses[self.position] == "pellet":
      data["score"] += config["PELLET_SCORE"]
      statuses[self.position] = "blank"

  def to_json(self):
    dictionary = Player.to_json(self)
    dictionary["isPacman"] = True
    dictionary["livesLeft"] = self.lives_left
    return dictionary


class Ghost(Player):
  def __init__(self, *args, **kwargs):
    Player.__init__(self, *args, **kwargs)
    self.is_pacman = False
    self.set_color()

  def set_color(self):
    for (color_index, color_string) in enumerate(ghost_color_strings):
      color_is_available = True
      for ghost in ghosts():
        if (ghost.is_claimed or not self.is_claimed) and ghost.color_string == color_string:
          color_is_available = False
          break

      if color_is_available:
        self.color = ghost_colors[color_index]
        self.team_color = self.color
        self.color_string = color_string
        return


  def current_color(self):
    if are_ghosts_scared:
      time_left = config["POWER_PELLET_DURATION"] - (time() - power_pellet_start_time)
      if time_left < 3 and time_left % 0.5 > 0.25:
        return np.array((0, 0, 0))
      else:
        return scaredy_ghost_color
    else:
      return self.color

  def cant_move(self):
    move_freq = config["GHOST_SCARED_MOVE_FREQ"] if are_ghosts_scared else config["GHOST_MOVE_FREQ"]
    return (self.stunned or
      (engine.game_state == start_state and self.is_ready) or # Don't move when marked ready
      time() - self.last_move_time < move_freq or # just moved
      (self.is_claimed and (self.move_direction == ZERO_2D).all())
    )

  def get_next_position(self):
    if self.is_claimed:
      return Player.get_next_position(self)
    else:
      pos = self.position
      my_coord = unique_coords[self.position]

      if random() < config["GHOST_RANDOMNESS"]:
        return choice(neighbors[pos])

      best_dist_sq = 1000
      closest_pacman_coord = my_coord
      for pacman in pacmen():
        pacman_coord = unique_coords[pacman.position]
        delta = pacman_coord - my_coord
        dist_sq = np.dot(delta, delta)
        if dist_sq < best_dist_sq:
          closest_pacman_coord = pacman_coord
          best_dist_sq = dist_sq

      new_pos = 0
      best_dist_sq = 0 if are_ghosts_scared else 1000
      for neighbor in neighbors[pos]:
        delta = unique_coords[neighbor] - closest_pacman_coord
        dist_sq = np.dot(delta, delta)

        if are_ghosts_scared:
          is_better_dist = dist_sq > best_dist_sq
        else:
          is_better_dist = dist_sq < best_dist_sq

        if is_better_dist:
          new_pos = neighbor
          best_dist_sq = dist_sq

      return new_pos


  def is_occupied(self, position):
    considered_players = claimed_players() if engine.game_state == start_state else playing_players()
    for player in considered_players:
      if player.is_alive and player.is_pacman == self.is_pacman and player.position == position:
        return True
    return False

  def render(self):
    if self.stunned:
      render_pulse(
        direction=unique_coords[self.position],
        color=self.current_color(),
        start_time=self.hit_time,
        duration=READY_PULSE_DURATION)

    Player.render(self)

