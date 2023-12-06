#!/usr/bin/env python

import base64
import collections
import gzip
import json
import numpy as np
import os
import sys
import traceback

from datetime import datetime, timedelta
from math import exp, ceil, floor, pi, cos, sin, sqrt, tan
from pygame import mixer  # https://www.pygame.org/docs/ref/mixer.html
from random import randrange, random
from time import sleep, time

from audio import music, prewarm_audio, remoteMusicActions, remoteSoundActions

if os.getenv("DEV_MODE"):
  def display_pixels(pixels):
    output = np.array(pixels,dtype="<u1").tobytes()
    print("raw_pixels=%s;" % output.hex())
else:
  from orbclient.orbpixel import display_pixels, start_pixel_output_process, start_external_pixel_board
  # start_pixel_output_process()
  start_external_pixel_board()

prewarm_audio()

GOOD_COLOR = np.array((255, 0, 255))
GOOD_COLOR_STRING = "#ff00ff"
BAD_COLOR = np.array((255, 0, 0))
BAD_COLOR_STRING = "#ff0000"
FRAMERATE = 30

base_config = {
  "SELECTION_WEIGHTS": [0, 1, 1, 1, 1, 1],
  "INVULNERABILITY_TIME": 3,
  "MOVE_FREQ": 0.18,
  "MOVE_BIAS": 0.5,
  "VICTORY_TIMEOUT": 18,
  "ROUND_TIME": 94.6,
  "CONTINUOUS_MOVEMENT": False,
  "INTERSECTION_PAUSE_FACTOR": 0.2,
}


READY_PULSE_DURATION = 0.75
ZERO_2D = np.array((0, 0))

file_name = os.getenv("PIXELS", "rhombicosidodecahedron")
if file_name.endswith(".json"):
  file_name = file_name[:-5]
if file_name.startswith("/pixels/"):
  file_name = file_name[8:]
if "/" not in file_name:
  file_name = file_name + "/" + file_name

file_name = "/pixels/" + file_name + ".json"
f = open(os.path.dirname(__file__) + file_name, "r")
pixel_info = json.loads(f.read())
f.close()

IS_WALL = pixel_info.get("isWall", False)
SIZE = pixel_info["SIZE"]
neighbors = pixel_info["neighbors"]
next_pixel = pixel_info["nextPixel"]
unique_to_dupe = pixel_info["uniqueToDupe"]
RAW_SIZE = len(unique_to_dupe)
coords = [np.array(coord) for coord in pixel_info["coords"]]

DEFAULT_PULSE_DIRECTION = np.array(
  pixel_info.get("defaultPulseDirection", (0,0,1)),
  dtype=float)
UP = 1 if IS_WALL else 2 # TODO use default pulse direction (or make defaultPulseDirection use UP)

# minPulseDot = 1000
# maxPulseDot = -1000
# for coord in coords:
#   d = np.dot(coord, DEFAULT_PULSE_DIRECTION)
#   minPulseDot = min(minPulseDot, d)
#   maxPulseDot = max(maxPulseDot, d)
# pulseRange = maxPulseDot - minPulseDot

minPulseDot = -1
pulseRange = 2


dupe_to_uniques = []
for dupe in range(SIZE):
  dupe_to_uniques.append([])
unique_coord_matrix = np.zeros((RAW_SIZE, 3))
for (i, dupe) in enumerate(unique_to_dupe):
  dupe_to_uniques[dupe].append(i)
  unique_coord_matrix[i] = coords[dupe]
unique_coord_matrix = unique_coord_matrix.transpose()

INITIAL_POSITIONS = pixel_info.get("initialPositions", [None]*6)
SOUTHERLY_INITIAL_POSITIONS = pixel_info.get("southerlyInitialPositions", [None]*6)
antipodes = pixel_info.get("antipodes", None)

north_pole = pixel_info.get("northPole", None)
if north_pole is None:
  pole_threshold = 1
  while True:
    pole_threshold -= 0.01
    ups = np.matmul(DEFAULT_PULSE_DIRECTION, unique_coord_matrix)
    ups -= pole_threshold
    ups = np.maximum(ups, 0)
    ups = np.sign(ups)
    pole_size = np.sum(ups)
    if pole_size > RAW_SIZE / 20:
      break
  north_pole = []
  for (i, coord) in enumerate(coords):
    if coord[UP] > pole_threshold:
      north_pole.append(i)

south_pole = pixel_info.get("southPole", None)
if south_pole is None:
  pole_threshold = -1
  while True:
    pole_threshold += 0.01
    ups = np.matmul(-DEFAULT_PULSE_DIRECTION, unique_coord_matrix)
    ups += pole_threshold
    ups = np.maximum(ups, 0)
    ups = np.sign(ups)
    pole_size = np.sum(ups)
    if pole_size > RAW_SIZE / 20:
      break
  south_pole = []
  for (i, coord) in enumerate(coords):
    if coord[UP] < pole_threshold:
      south_pole.append(i)

raw_pixels = np.zeros((RAW_SIZE, 3),dtype="<u1")
print("Running %s pixels" % RAW_SIZE, file=sys.stderr)

game = None
next_game = None
games = {}
game_selection_weights = {}

# ================================ USER PREFS =========================================

default_prefs = {
  # TIMING
  "startTime": "00:00",
  "endTime": "23:59",
  "idleColor": "rainbow",
  "idleMin": 0,
  "applyIdleMinBefore": False,
  "hasStartAndEnd": False,

  # PATTERN
  "idlePattern": "default",
  "idleFrameRate": 15.0,
  "idleBlend": 30.0,
  "idleDensity": 50.0,
  "idlePAttern": "fire",

  # COLOR
  "brightness": 100,
  "fadeDuration": 30,
  "fixed.blue": 255,
  "fixed.green": 255,
  "fixed.red": 255,
  "rainbowDuration": 10.0,
  "rainbowFade": 0.0,
}
pref_type = {}
for (key, value) in default_prefs.items():
  pref_type[key] = type(value)

current_prefs = {}
current_prefs.update(default_prefs)

pref_path = os.path.dirname(__file__) + "/prefs.json"
if os.path.exists(pref_path):
  f = open(pref_path, "r")
  prefs = json.loads(f.read())
  current_prefs.update(prefs)
  f.close()
else:
  prefs = {}

def update_prefs(update):
  prefs.update(update)
  current_prefs.update(update)
  idle.update_prefs()
  for game in games.values():
    game.update_prefs()
  f = open(pref_path, "w")
  f.write(json.dumps(prefs, indent=2))
  f.close()

def get_pref(pref_name):
  pref = current_prefs[pref_name]
  if (pref_type[pref_name] == int):
    return int(pref)
  if (pref_type[pref_name] == float):
    return float(pref)
  else:
    return pref


# ================================ START =========================================

def select_random_game():
  player_count = 1
  if game:
    player_count = len(game.claimed_players())

  weights = {}
  for (name, weight) in game_selection_weights.items():
    weights[name] = weight * games[name].SELECTION_WEIGHTS[player_count-1]

  for (name, g) in games.items():
    if not hasattr(g, "REQUIREMENTS"):
      continue
    for req in g.REQUIREMENTS:
      if getattr(sys.modules[__name__], req) is None:
        weights[name] = 0

  selection = weighted_random(weights)
  if selection is None:
    selection = "snektron"

  for name in game_selection_weights.keys():
    game_selection_weights[name] += 1
  game_selection_weights[selection] = 0
  return games[selection]

def start_random_game():
  start(select_random_game())

def start(new_game):
  if not new_game:
    return

  global game
  claimed = []
  if game:
    for player in game.players:
      claimed.append(player.is_claimed)

  game = new_game
  game.restart()
  music["any"].fadeout(duration=2000)
  music[game.waiting_music].fadein(duration=4500)
  for (i, player) in enumerate(game.players):
    if i < len(claimed):
      player.is_claimed = claimed[i]


# ================================ Text display =========================================

previous_text = ""
current_text = ""
priory_texts = []
display = None
text_index = 0
display_type = os.getenv("TEXT_DISPLAY", "")
if display_type == "Seg14x4":
  try:
    import board
    i2c = board.I2C()
    from adafruit_ht16k33.segments import Seg14x4
    display = Seg14x4(i2c)
  except Exception:
    print("Error initializing TEXT_DISPLAY %s" % display_type, file=sys.stderr)

def display_text(text, priority=2):
  global current_text
  if len(priory_texts) < priority+1:
    for i in range(len(priory_texts), priority+1):
      priory_texts.append("")

  priory_texts[priority] = text

  for txt in priory_texts:
    if txt != "":
      current_text = txt
      return
  current_text = "    "

# ================================ UPDATE =========================================

def update():
  global raw_pixels
  try:
    if game is None:
      start(idle)
    elif len(game.claimed_players()) == 0 and game != idle:
      start(idle)
    elif os.getenv("AUTO_GAME") == "true" and len(game.claimed_players()) > 0 and game == idle:
      start_random_game()

    game.update()
    if game.end_time <= time() and game.end_time > 0:
      game.ontimeout()
    game.render()

    raw_pixels = np.minimum(raw_pixels, 255)
    raw_pixels = np.maximum(raw_pixels, 0)
    display_pixels(raw_pixels)
    broadcast_state()

    raw_pixels *= 0

    # Text display update tick
    if display is None:
      return

    global text_index
    global previous_text
    global previous_scroll_time

    if current_text != previous_text:
      display.print(current_text[:4])
      text_index = 4
      previous_text = current_text
      previous_scroll_time = time()

    if len(current_text) <= 4: # Don't scroll if entire text can fit on display
      return
    if time() - previous_scroll_time < 0.25:
      return

    display.scroll(1)
    if text_index < len(current_text):
      display[3] = current_text[text_index]
    else:
      display[3] = " "
    display.show()
    text_index = (text_index + 1) % (len(current_text) + 3)
    previous_scroll_time = time()

  except Exception:
    print(traceback.format_exc(), file=sys.stderr)


# ================================ PLAYER =========================================



GHOST_BUFFER_LEN = 20

class Player:
  def __init__(self,
      position=None,
      color=(150,150,150),
      color_string="white",
      color_name="White"):

    self.initial_position = position
    self.color = np.array(color)
    self.color_string = color_string
    self.color_name = color_name

    self.last_move_time = 0
    self.ready_time = 0
    self.is_claimed = False
    self.is_playing = False
    self.last_move_input_time = 0
    self.move_direction = np.array((0, 0))
    self.buffered_move = self.move_direction
    self.tap = 0

    self.ghost_positions = collections.deque(maxlen=GHOST_BUFFER_LEN)
    self.ghost_timestamps = collections.deque(maxlen=GHOST_BUFFER_LEN)
    for i in range(GHOST_BUFFER_LEN):
      self.ghost_positions.append(0)
      self.ghost_timestamps.append(0)

    self.reset()


  def reset(self):
    self.votes = {}
    self.is_ready = False
    self.is_alive = True
    self.is_playing = False
    self.position = self.initial_position or self.random_teleport_pos()
    self.prev_pos = self.position
    self.hit_time = 0
    self.score = 0
    self.score_timestamp = time()

  def set_ready(self):
    self.is_ready = True
    self.ready_time = time()

  def setup_for_game(self):
    self.is_playing = True
    self.score_timestamp = time()
    self.set_ready()

  def set_unready(self):
    self.is_ready = False
    self.tap = 0

  def pulse(self):
    self.ready_time = time()

  def current_color(self):
    return self.color

  def move_delay(self):
    speed = game.MOVE_FREQ
    if game.CONTINUOUS_MOVEMENT:
      if len(neighbors[self.position]) == 4:
        speed *= 1 + game.INTERSECTION_PAUSE_FACTOR
      if len(neighbors[self.prev_pos]) == 4:
        speed *= 1 / (1 + game.INTERSECTION_PAUSE_FACTOR/2)

    return speed

  def cant_move(self):
    return (not self.is_alive or
      time() - self.last_move_time < self.move_delay() or # just moved
      not game.CONTINUOUS_MOVEMENT and (self.move_direction == ZERO_2D).all()
    )

  def occupies(self, pos):
    return pos == self.position

  def get_next_position(self):
    pos = self.position

    direction_string = str((self.prev_pos, pos))
    if direction_string in next_pixel:
      continuation_pos = next_pixel[direction_string]
    else:
      continuation_pos = pos

    if (game.CONTINUOUS_MOVEMENT and
        continuation_pos != pos and
        len(neighbors) <= 2):
      return continuation_pos

    up = coords[pos]
    up_magnitude = np.linalg.norm(up)
    if up_magnitude == 0:
      up = np.array((0.0, 1.0, 0.0))
    else:
      up = up / up_magnitude
    north = np.array((0.0, 0.0, 1.0))
    north = ortho_proj(north, up)
    north /= np.linalg.norm(north) # normalize
    east = np.cross(up, north)

    basis = np.array((east, north, up))

    max_dot = 0
    new_pos = pos
    for n in neighbors[pos]:
      delta = coords[pos] - coords[n]
      delta += game.MOVE_BIAS * (coords[self.prev_pos] - coords[pos]) # Bias towards turning or moving backwards
      delta /= np.linalg.norm(delta)  # normalize
      if IS_WALL:
        delta[1] = -delta[1] # y-axis is inverted in wall version for some reason
      else:
        delta = -np.matmul(basis, delta)

      dot = np.dot(delta[0:2], self.buffered_move)
      if game.CONTINUOUS_MOVEMENT:
        if n == continuation_pos:
          dot *= 1 - game.MOVE_BIAS
        if n == self.prev_pos:
          dot *= 0.1

      if dot > max_dot:
        max_dot = dot
        new_pos = n

    if (game.CONTINUOUS_MOVEMENT and
        (new_pos == self.position or new_pos == self.prev_pos)):
      return continuation_pos
    else:
      return new_pos

  def is_occupied(self, position):
    if not self.is_alive:
      return False

    if game.CONTINUOUS_MOVEMENT:
      return False

    if game.statuses[position] == "wall":
      return True

    for player in game.claimed_players():
      if player.is_alive and player.position == position:
        return True

    return False


  def move(self):
    if self.cant_move():
      return False

    if not (self.move_direction == ZERO_2D).all():
      self.buffered_move = self.move_direction
      self.last_move_input_time = time()
    elif time() - self.last_move_input_time > game.MOVE_FREQ:
      self.buffered_move = ZERO_2D

    new_pos = self.get_next_position()

    if not self.is_occupied(new_pos):
      self.ghost_positions.append(self.position)
      self.ghost_timestamps.append(time())
      self.prev_pos = self.position
      self.position = new_pos
      self.last_move_time = time()
      return True
    else:
      return False


  def random_teleport_pos(self):
    if game is None:
      self.position = 0
      return 0

    for i in range(20):
      pos = randrange(SIZE)
      if game.statuses[pos] != "blank":
        continue
      occupied = False
      for player in game.claimed_players():
        if player.occupies(pos):
          occupied = True
        for n in neighbors[pos]:
          if player.occupies(n):
            occupied = True
      if not occupied:
        return pos

    return 0

  def render_ghost_trail(self):
    for i in range(GHOST_BUFFER_LEN):
      delta_t = time() - self.ghost_timestamps[i]
      color = self.current_color() / 16 * exp(-16 * delta_t * delta_t)
      color_pixel(self.ghost_positions[i], color)

  def render(self):
    if not self.is_alive:
      return
    color = self.current_color()

    if time() - self.hit_time < game.INVULNERABILITY_TIME:
      factor = (time() * 1.8) % 1
      color = color * (0.05 + 0.95 * factor * factor)
      # color = color * sin(time() * 30)

    color_pixel(self.position, color)


  def render_ready(self):
    color = self.current_color()
    color_pixel(self.position, color)
    for n in neighbors[self.position]:
      color_pixel(n, color / 32 * (1 + sin(time()*2)))

    render_pulse(
      direction=coords[self.position],
      color=self.current_color(),
      start_time=self.ready_time,
      duration=READY_PULSE_DURATION)


  def to_json(self):
    return {
      "isClaimed": self.is_claimed,
      "isReady": self.is_ready,
      # "isPlaying": self.is_playing,
      "isAlive": self.is_alive,
      "color": self.color_string,
      "colorName": self.color_name,
      "position": self.position,
      "votes": self.votes,
      "score": self.score,
      "scoreTimestamp": self.score_timestamp,
    }

  def victor_json(self):
    return {
      "color": self.color_string,
    }


# Used in co-op games to assign to `victors` when the players lose
ENEMY_TEAM = [Player(
    position = 0,
    color=BAD_COLOR,
    color_string=BAD_COLOR_STRING)]

# ================================ Game =========================================


class Game:
  players = []
  waiting_music = "waiting"
  battle_music = "battle1"

  victors = []
  data = {}
  statuses = ["blank"] * SIZE

  def __init__(self, additional_config=None):

    self.config = {}
    for (key, value) in base_config.items():
      self.config[key] = value
      setattr(self, key, value)
    if additional_config:
      for (key, value) in additional_config.items():
        self.config[key] = value
        setattr(self, key, value)

    self.update_prefs()

  def update_prefs(self):
    pass

  # Doing this so players can have global reference to "game" in various game modules
  def generate_players(self, player_class, positions=INITIAL_POSITIONS):
    self.players = [
      player_class(
        position=positions[0],
        color=(0, 255, 0),
        color_string="#00ff00",
        color_name="Green"
      ),
      player_class(
        position=positions[1],
        color=(0, 0, 255),
        color_string="#4040ff",
        color_name="Blue"
      ),
      player_class(
        position=positions[2],
        color=(255, 80, 0),
        color_string="#ff7f00",
        color_name="Orange"
      ),
      player_class(
        position=positions[3],
        color=(255, 255, 0),
        color_string="#ffff00",
        color_name="Yellow"
      ),
      player_class(
        position=positions[4],
        color=(0, 255, 255),
        color_string="#00ffff",
        color_name="Cyan"
      ),
      player_class(
        position=positions[5],
        color=(70, 0, 255),
        color_string="#6f00ff",
        color_name="Violet"
      ),
    ]
    self.restart()


  def restart(self):
    for player in self.players:
      player.reset()
    self.state = "start"
    self.end_time = 0
    self.id = floor(time()*1000)
    self.clear()


  def update(self):
    if self.state == "play":
      self.play_update()

  def play_update(self):
    for player in self.claimed_players():
      player.move()

  def ontimeout(self):
    if self.state == "start":
      self.start_ontimeout()
    elif self.state == "countdown":
      self.countdown_ontimeout()
    elif self.state == "play":
      self.play_ontimeout()
    elif self.state == "previctory":
      self.previctory_ontimeout()
    elif self.state == "victory":
      self.victory_ontimeout()


  def start_ontimeout(self):
    for player in self.claimed_players():
      player.setup_for_game()
    self.clear()
    self.state = "countdown"
    self.end_time = time() + 4
    music[self.waiting_music].fadeout(duration=3500)

  def countdown_ontimeout(self):
    self.end_time = time() + self.ROUND_TIME
    self.state = "play"
    music[self.battle_music].play()
    for player in self.claimed_players():
      player.tap = 0 # Prevent bombs from being placed due to taps during countdown


  def play_ontimeout(self):
    music[self.battle_music].fadeout(duration=1000)
    self.state = "previctory"
    self.end_time = time() + 1
    top_score = 0
    top_score_time = 0
    for player in self.claimed_players():
      if player.score > top_score or (player.score == top_score and player.score_timestamp < top_score_time):
        top_score = player.score
        top_score_time = player.score_timestamp
        self.victors = [player]
    touchall()

  def previctory_ontimeout(self):
    self.state = "victory"
    self.end_time = time() + self.VICTORY_TIMEOUT
    if self.victors == ENEMY_TEAM:
      music["lose"].play()
    else:
      music["victory"].play()

    global next_game
    next_game = select_random_game()

  def victory_ontimeout(self):
    start(next_game)


  def render(self):
    if self.state == "start":
      for player in self.claimed_players():
        player.render_ready()

    elif self.state == "countdown":
      countdown = ceil(self.end_time - time())
      countup = 5 - countdown
      render_pulse(
        color=np.array((60,60,60)) * countup,
        start_time=self.end_time - countdown,
        duration=READY_PULSE_DURATION)

      for player in self.claimed_players():
        player.render_ready()

    elif self.state == "play":
      self.render_game()
      if self.end_time > 0 and self.end_time - time() < 7:
        countdown = ceil(self.end_time - time())
        countup = 7 - countdown
        render_pulse(
          color=np.array((60,60,60)) * countup,
          start_time=self.end_time - countdown,
          duration=READY_PULSE_DURATION)

      for player in self.claimed_players():
          player.render()

    elif self.state == "previctory":
      self.render_game()
      for player in self.claimed_players():
          player.render()

    elif self.state == "victory":
      start_time = self.end_time - self.VICTORY_TIMEOUT
      timer = (time() - start_time)

      if len(self.victors) == 0:
        color = np.array((60,60,60))
      else:
        victor = self.victors[floor(timer/2 % len(self.victors))]
        color = victor.color

      if self.victors == ENEMY_TEAM:
        width = 4 + (20 - min(20,timer*4))
        for (i, coord) in enumerate(coords):
          color_pixel(i, color * sin(width*(coord[2] - timer + 0.3)))

      else:
        width = 2
        if timer < 0.4:
          render_ring((sin(timer*6),cos(timer*6),0.5),color,width)
        elif timer < 0.9:
          render_ring((cos(timer*6),sin(timer*6),0.5),color,width)
        elif timer < 1.35:
          render_ring((sin(timer*8),1,cos(timer*8)),color,width)
          render_ring((cos(timer*8),0,sin(timer*8)),color,width)
        elif timer < 1.9:
          render_ring((0,sin(timer*6),cos(timer*6)),color,width)
        elif timer < 2.25:
          render_ring((sin(timer*6),cos(timer*6),abs(sin(timer*6))),color,width)
        elif timer < 2.75:
          render_ring((sin(timer*6),cos(timer*6),0),color,width)
          render_ring((sin(timer*6),cos(timer*5),sin(timer)),color,width)
        elif timer < 4.65:
          t = min((timer - 3)*2,pi/2)+pi/2
          #width = width + t - pi/2 + sin(timer*2)
          width = 1 + 3.1*abs(cos(timer*1.9))
          render_ring((0,sin(t),cos(t)),color*0.028,width)
          render_ring((sin(t),0,cos(t)),color*0.028,width)
          render_ring((0,cos(t*3-pi/2),sin(t*3-pi/2)),color*0.28,width)
          render_ring((cos(t*3-pi/2),0,sin(t*3-pi/2)),color*0.28,width)
        else:
          for (i, coord) in enumerate(coords):
            d = np.dot(coord, DEFAULT_PULSE_DIRECTION)
            color_pixel(i, color * sin(4*(d - timer + 0.3)))


  def render_game(self):
    pass


  # Game utils

  def clear(self):
    for i in range(len(self.statuses)):
      self.statuses[i] = "blank"

  def update_config(self, update):
    for (key, value) in update.items():
      self.config[key] = value
      setattr(self, key, value)

  def claimed_players(self):
    return [player for player in self.players if player.is_claimed]

  def all_neighbors(self, point_set):
    neighbor_set = point_set.copy()
    for point in point_set:
      for n in neighbors[point]:
        neighbor_set.add(n)
    return neighbor_set

  def spawn(self, status):
    for i in range(10):
      pos = randrange(SIZE)
      if self.statuses[pos] != "blank":
        continue
      occupied = False
      for player in self.claimed_players():
        if player.occupies(pos):
          occupied = True
          break
      if not occupied:
        self.statuses[pos] = status
        return


# ================================ MISC =========================================

def color_pixel(index, color):
  for unique in dupe_to_uniques[index]:
    raw_pixels[unique] = color

def add_color_to_pixel(index, color):
  for unique in dupe_to_uniques[index]:
    raw_pixels[unique] += np.array(color,dtype="<u1")

def latlong_delta(ll0, ll1):
  delta = [ll0[0] - ll1[0], ll0[1] - ll1[1]]
  if delta[0] > pi:
    delta[0] -= 2*pi
  if delta[1] > pi:
    delta[1] -= 2*pi
  if delta[0] < -pi:
    delta[0] += 2*pi
  if delta[1] < -pi:
    delta[1] += 2*pi
  return delta

def weighted_random(value_to_weights=None, weights=None, values=None):
  if weights is None:
    weights = list(value_to_weights.values())
  if values is None:
    values = value_to_weights.keys()

  total_weight = 0
  for weight in weights:
    total_weight += weight

  if total_weight == 0:
    return None

  x = random() * total_weight
  for (i, value) in enumerate(values):
    weight = weights[i]
    if x < weight:
      return value
    x -= weight

  print("Weighted random failed: %s %s" % (weights, values), file=sys.stderr)

def random_unit_vector():
  v = np.array((random(), random(), random()))
  return v / np.linalg.norm(v)

def rotate(v, axis, angle):
  return np.ravel(np.matmul(v, rotation_matrix(axis, angle)))

def rotation_matrix(axis, angle):
  c = cos(angle)
  s = sin(angle)
  x = axis[0]
  y = axis[1]
  z = axis[2]
  # Based on https://en.wikipedia.org/wiki/Rotation_matrix
  return np.matrix([
    [c + x*x*(1-c), x*y*(1-c) - z*s, x*z*(1-c) + y*s],
    [y*z*(1-c) + z*s, c + y*y*(1-c), y*z*(1-c) - x*s],
    [z*x*(1-c) - y*s, z*y*(1-c) + x*s, c + z*z*(1-c)]
  ])

def projection(u, v): # assume v is normalized
  return v * np.dot(u,v)

def ortho_proj(u, v):
  return u - projection(u,v)


def render_pulse(direction=None, color=None,
    start_time=0, duration=READY_PULSE_DURATION, reverse=False):
  t = (time() - start_time) / duration
  if (t >= 1):
    return np.zeros(RAW_SIZE)
  if reverse:
    t = 1 - t

  if IS_WALL and direction is not None:
    deltas = np.dot(np.asmatrix(direction).T, np.ones((1, RAW_SIZE))) - unique_coord_matrix
    ds = np.sum(np.multiply(deltas, deltas), axis=0).T
    ds = np.sqrt(ds)
    ds = 1 - ds/4
  else:
    if direction is None:
      direction = DEFAULT_PULSE_DIRECTION
    ds = np.matmul(direction, unique_coord_matrix) / 2 + 0.5
    ds -= minPulseDot
    ds /= pulseRange
      
  ds = 12*ds - 7*t - 5
  ds = np.maximum(0, np.multiply(ds, (1 - ds)) / 3)
  if color is not None:
    global raw_pixels
    raw_pixels += np.array(np.outer(ds, color), dtype="<u1")
  return np.array(ds).ravel()

# Assume direction is normalized
def render_ring(direction, color, width):
  global raw_pixels
  ds = np.matmul(direction, unique_coord_matrix)
  ds = ds * 6 + width/2
  ds = np.clip(np.multiply(ds, (width - ds))/4,0,1)
  raw_pixels += np.array(np.outer(ds, color), dtype="<u1")

def multi_lerp(x, control_points):
  if x < 0:
    return control_points[0][1]

  index = 1
  prev_v = control_points[0][1]
  while index < len(control_points):
    max_x = control_points[index][0]
    next_v = control_points[index][1]
    if x > max_x:
      x -= max_x
      prev_v = next_v
      index += 1
      continue

    alpha = x / max_x
    return alpha * next_v + (1-alpha) * prev_v

  return control_points[index - 1][1]


# ================================ Communication with node.js =========================================

def touchall():
  print("touchall")

def broadcast_event(event):
  print(json.dumps(event))

# import traceback
def broadcast_state():
  # for line in traceback.format_stack():
  #   print(line.strip(), file=sys.stderr)
  time_remaining = round(game.end_time - time()) if game and game.end_time else 0
  message = {
    "game": game.name,
    "gameId": game.id,
    "nextGame": next_game.name if next_game else "",
    "players": [player.to_json() for player in game.players],
    "gameState": game.state,
    "timeRemaining": time_remaining,
    "victors": [victor.victor_json() for victor in game.victors],
    "config": game.config,
    "data": game.data,
    "musicActions": remoteMusicActions,
    "soundActions": remoteSoundActions,
    "prefs": current_prefs,
    "currentText": current_text,
  }
  print(json.dumps(message))

# ================================ Core loop =========================================

if os.getenv("SWITCH_MODE"):
  TOGGLE_PIN = 15 # board pin 10/GPIO pin 15
  import RPi.GPIO as GPIO
  GPIO.setwarnings(False)
  GPIO.setup(TOGGLE_PIN, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

def run_core_loop():
  display_text("0000", 0)
  display_text(os.getenv("DEFAULT_TEXT_DISPLAY", ""), 3)

  last_frame_time = time()
  framerate_data = {
    'start_time': datetime.fromtimestamp(int(last_frame_time)).strftime("%m/%d/%Y, %H:%M:%S"),
    'slow_frame_count': 0,
    'very_slow_frame_count': 0,
    'slowest_frame': 0,
  }
  is_toggling = False
  is_off = False
  while True:
    time_to_wait = last_frame_time + 1.0/FRAMERATE - time()
    if time_to_wait > 0:
      sleep(time_to_wait)

    frame_time = time() - last_frame_time
    framerate_data['slowest_frame'] = max(frame_time, framerate_data['slowest_frame'])
    if frame_time > 0.1:
      framerate_data['slow_frame_count'] += 1
    if frame_time > 1:
      framerate_data['very_slow_frame_count'] += 1
      print("Framerate Data: " + str(framerate_data), file=sys.stderr)

    if os.getenv("SHOW_FRAME_INFO") == "true":
      print("Frame rate %f\nFrame  time %dms" % (1/frame_time, int(frame_time * 1000)),file=sys.stderr)
    last_frame_time = time()

    if is_off:
      global raw_pixels
      raw_pixels *= 0
      display_pixels(raw_pixels)
    else:
      update()

    if os.getenv("SWITCH_MODE") == "toggle":
      is_off = GPIO.input(TOGGLE_PIN) == GPIO.HIGH
    if os.getenv("SWITCH_MODE") == "push":
      if not is_toggling and GPIO.input(TOGGLE_PIN) == GPIO.HIGH:
        is_off = not is_off
        is_toggling = True
      if GPIO.input(TOGGLE_PIN) == GPIO.LOW:
        is_toggling = False

