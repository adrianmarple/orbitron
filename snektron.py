#!/usr/bin/env python

import numpy as np

from math import exp, ceil, floor, pi, cos, sin, sqrt
from random import randrange, random, choice
from time import time, sleep
import collections

from audio import sounds, prewarm_audio
import engine
from engine import *


config["ROUND_TIME"] = 150
config["START_LENGTH"] = 3


battle_channel = None
vamp = None


prewarm_audio(sound_file_names=[
    "battle1.ogg", "battle1Loop.ogg", "waiting.ogg", "victory.mp3", 
    "hurt.wav",
  ],
  #stubs=["battle1.ogg", "battle1Loop.ogg", "dm1.ogg", "dm1Loop.ogg","waiting.ogg","victory.mp3"]
  #, start_loop="waiting"
  )

def setup():
  Snek(position=105,
    color=(0, 200, 0),
    color_string="#4caf50") #green
  Snek(position=198,
    color=(1, 12, 200),
    color_string="#1e88e5") #blue
  Snek(position=24,
    color=(200, 2, 20),
    color_string="#e91e63") #pink
  Snek(position=252,
    color=(100, 0, 250),
    color_string="#9575cd") #deep purple
  Snek(position=168,
    color=(180, 200, 5),
    color_string="#c0ca33") #lime
  Snek(position=311,
    color=(200, 50, 0),
    team_color=(0, 120, 120),
    color_string="#ff9800") #orange

def handle_event(message, player):
    pass

def start_update():
  for player in claimed_players():
    if not player.is_ready:
      player.move()

  if engine.state_end_time == 0 and is_everyone_ready(minimum=2):
    for player in claimed_players():
      player.is_playing = True

    engine.state_end_time = time() + 4
    broadcast_state()
    sounds["waiting"].fadeout(4000)


def play_update():
  if battle_channel.get_queue() is None:
    battle_channel.queue(vamp)

  for player in playing_players():
    player.move()

def play_ontimeout():
  battle_channel.stop()
  sounds["victory"].play()
  engine.game_state = victory_state
  #TODO determine winner and set color accordingly
  engine.victory_color = players[0].color
  engine.victory_color_string = players[0].color_string
  engine.state_end_time = time() + 10
  broadcast_state()
  clear()
  for player in players:
    player.reset()

def start_ontimeout():
  global battle_channel, vamp
  engine.game_state = play_state
  battle_channel = sounds["battle1"].play()
  vamp = sounds["battle1Loop"]

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
  if engine.state_end_time - time() < 5:
    countdown = ceil(engine.state_end_time - time())
    countup = 5 - countdown
    render_pulse(
      direction=(0,0,COORD_MAGNITUDE),
      color=np.array((60,60,60)) * countup,
      start_time=engine.state_end_time - countdown,
      duration=READY_PULSE_DURATION)

  for i in range(SIZE):
    if statuses[i] == "blank":
      # already handled
      pass
    elif statuses[i] == "apple":
      color_pixel(i, (10, 10, 10))

  for player in playing_players():
    player.render()


start_state = State("start", start_update, start_ontimeout, render_sandbox)
play_state = State("play", play_update, play_ontimeout, render_game)
victory_state = State("victory", start_update, victory_ontimeout, render_victory)


# ================================ PLAYER =========================================

class Snek(Player):
  def __init__(self, *args, **kwargs):
    Player.__init__(self, *args, **kwargs)
    self.tail = collections.deque(maxlen=SIZE)

  def reset(self):
    self.score = 0
    self.tail.clear()
    for i in range(config["START_LENGTH"]):
      self.tail.appendleft(self.initial_position)
    Player.reset(self)

  def cant_move(self):
    return (
      self.stunned or
      (engine.game_state == start_state and self.is_ready) or # Don't move when marked ready
      time() - self.last_move_time < config["MOVE_FREQ"] or # just moved
    )

  def is_occupied(self, position):
    return self.tail[1] != position:

  def occupies(pos):
      #TODO CHECK TAIL
    pass

  def die():
    pass

  def move(self):
    if engine.game_state == play_state:
      for player in playing_players():
        if player == self:
          continue
        if player.occupies(self.position):
          self.die()
          if player.position==self.position:
            player.die()

    Player.move(self)
    self.tail.appendleft(self.position)
    if statuses[self.position] == "apple":
      statuses[self.position] = "blank"
      while True:
        apple_pos = randrange(0,SIZE)
        if statuses[apple_pos] == "apple":
          continue
        occupied = False
        for player in playing_players():
          if player.occupies(apple_pos):
            occupies = True
            break
        if occupied:
          continue
        statuses[apple_pos] = "apple"
    else:
      self.tail.pop()

  def to_json(self):
    dictionary = Player.to_json(self)
    dictionary["length"] = self.length
    dictionary["score"] = self.score
    return dictionary

  def render(self):
    if not self.is_alive:
      return
    for position in tail:
      color_pixel(position, self.current_color())

