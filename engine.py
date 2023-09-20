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
  def neopixel_write(data):
    print("raw_pixels=%s" % data.hex())
else:
  from orbclient.orbpixel import neopixel_write

prewarm_audio()

GOOD_COLOR = np.array((255, 0, 255))
GOOD_COLOR_STRING = "#ff00ff"
BAD_COLOR = np.array((255, 0, 0))
BAD_COLOR_STRING = "#ff0000"

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

prefs = {"startTime": "0:00", "endTime": "23:59"}
pref_path = os.path.dirname(__file__) + "/prefs.json"
if os.path.exists(pref_path):
  f = open(pref_path, "r")
  prefs = json.loads(f.read())
  f.close()

def update_prefs(update):
  prefs.update(update)
  idle.update_prefs()
  for game in games.values():
    game.update_prefs()
  f = open(pref_path, "w")
  f.write(json.dumps(prefs, indent=2))
  f.close()

READY_PULSE_DURATION = 0.75
ZERO_2D = np.array((0, 0))

file_name = os.environ.get("PIXELS", "rhombicosidodecahedron")
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
coords = [np.array(coord) for coord in pixel_info["coords"]]
coord_matrix = np.matrix(coords).transpose()

DEFAULT_PULSE_DIRECTION = np.array(
  pixel_info.get("defaultPulseDirection", (0,0,1)),
  dtype=float)

# minPulseDot = 1000
# maxPulseDot = -1000
# for coord in coords:
#   d = np.dot(coord, DEFAULT_PULSE_DIRECTION)
#   minPulseDot = min(minPulseDot, d)
#   maxPulseDot = max(maxPulseDot, d)
# pulseRange = maxPulseDot - minPulseDot

minPulseDot = 1
pulseRange = 2

INITIAL_POSITIONS = pixel_info.get("initialPositions", [None]*6)
antipodes = pixel_info.get("antipodes", None)
# Expect these pole based concepts to exist together
north_pole = pixel_info.get("northPole", None)
south_pole = pixel_info.get("southPole", None)
SOUTHERLY_INITIAL_POSITIONS = pixel_info.get("southerlyInitialPositions", [None]*6)

dupe_matrix = np.zeros((len(unique_to_dupe), SIZE),dtype="<u1")
for (i, dupe) in enumerate(unique_to_dupe):
  dupe_matrix[i, dupe] = 1

pixels = np.zeros((SIZE, 3),dtype="<u1")
print("Running %s pixels" % len(unique_to_dupe), file=sys.stderr)

game = None
next_game = None
games = {}
game_selection_weights = {}

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

# ================================ UPDATE =========================================

def update():
  global pixels
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

    pixels = np.minimum(pixels, 255)
    pixels = np.maximum(pixels, 0)
    raw_pixels = np.matmul(dupe_matrix,pixels)
    raw_pixels[:, [0, 1]] = raw_pixels[:, [1, 0]]
    output=np.array(raw_pixels,dtype="<u1").tobytes()
    neopixel_write(output)
    broadcast_state()
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
    up = up / np.linalg.norm(up)
    north = np.array((0, 0, 1))
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
    elif time() - self.last_move_input_time > game.MOVE_FREQ * 2:
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
        color=(70, 0, 255),
        color_string="#6f00ff",
        color_name="Violet"
      ),
      player_class(
        position=positions[4],
        color=(255, 255, 0),
        color_string="#ffff00",
        color_name="Yellow"
      ),
      player_class(
        position=positions[5],
        color=(0, 255, 255),
        color_string="#00ffff",
        color_name="Cyan"
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
    global pixels
    pixels *= 0

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

# ================================ Idle Animation "Game" =========================================


target_head_count = SIZE / 32.0
class Idle(Game):
  name = "idle"
  waiting_music = "idle"

  def update_prefs(self):
    now_date = datetime.now().date()
    self.midnight = datetime.combine(now_date + timedelta(days=1),
      datetime.strptime("0:00", '%H:%M').time())

    start_string = prefs.get("startTime", "0:00")
    start_time = datetime.strptime(start_string, '%H:%M').time()
    self.start = datetime.combine(now_date, start_time)

    end_string = prefs.get("endTime", "23:59")
    end_time = datetime.strptime(end_string, '%H:%M').time()
    self.end = datetime.combine(now_date, end_time)
    
    self.fade_duration = 30.0*60 # 30 minutes

  def update(self):
    pass

  def render(self):
    self.render_fluid()

  fluid_heads = [0]
  fluid_values = np.array([1.0] + [0.0] * (SIZE - 1))
  previous_fluid_time = 0
  def render_fluid(self):
    global pixels

    now = datetime.now()
    if now > self.midnight:
      self.update_prefs()

    head_ratio = len(self.fluid_heads) / target_head_count
    dampening_factor = (1 + head_ratio*head_ratio*5)

    time_to_wait = self.previous_fluid_time + 0.066 - time()
    if time_to_wait > 0:
      sleep(time_to_wait)

    self.previous_fluid_time = time()
    new_heads = []
    for head in self.fluid_heads:
      if random() < 0.1:
        new_heads.append(head)
        continue

      for n in neighbors[head]:
        x = self.fluid_values[n] + 0.01
        x *= dampening_factor
        if x < random():
          new_heads.append(n)
          self.fluid_values[n] = 1

    spontaneous_combustion_chance = 0.01 / (head_ratio * head_ratio)
    if spontaneous_combustion_chance > random():
      new_heads.append(randrange(SIZE))

    if len(new_heads) != 0:
      self.fluid_heads = new_heads

    self.fluid_values *= 0.86
    squares = np.multiply(self.fluid_values, self.fluid_values)

    now = datetime.now()
    start_fade = (now - self.start).total_seconds() / self.fade_duration
    start_fade = min(start_fade, 1)
    start_fade = max(start_fade, 0)
    end_fade = (self.end - now).total_seconds() / self.fade_duration
    end_fade = min(end_fade, 1)
    end_fade = max(end_fade, 0)
    if self.start < self.end:
      fade = min(start_fade, end_fade)
    else:
      fade = max(start_fade, end_fade)
    fade *= fade

    pixels = np.outer(squares, phase_color() * 200 * fade)

idle = Idle()
idle.generate_players(Player)


# ================================ MISC =========================================

def color_pixel(index, color):
  pixels[index] = color

def add_color_to_pixel(index, color):
  pixels[index] += np.array(color,dtype="<u1")

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

def phase_color():
  color_phase = (time()/10) % 1
  if color_phase < 0.333:
    r = 1 - 3 * color_phase
    g = 3 * color_phase
    b = 0
  elif color_phase < 0.666:
    r = 0
    g = 2 - 3 * color_phase
    b = 3 * color_phase - 1
  else:
    r = 3 * color_phase - 2
    g = 0
    b = 3 - 3 * color_phase
  return np.array((r,g,b))

def render_pulse(direction=None, color=(200,200,200),
    start_time=0, duration=READY_PULSE_DURATION):
  global pixels
  t = (time() - start_time) / duration
  if (t >= 1):
    return

  if IS_WALL and direction is not None:
    deltas = np.dot(np.asmatrix(direction).T, np.ones((1, SIZE))) - coord_matrix
    ds = np.sum(np.multiply(deltas, deltas), axis=0).T
    ds = np.sqrt(ds)
    # ds = 1 - ds/2
    ds = 1 - ds/4
  else:
    if direction is None:
      direction = DEFAULT_PULSE_DIRECTION
    ds = direction * coord_matrix / 2 + 0.5
    ds -= minPulseDot
    ds /= pulseRange
      
  ds = 12*ds - 7*t - 5
  ds = np.maximum(0, np.multiply(ds, (1 - ds)) / 3)
  pixels += np.array(np.outer(ds, color), dtype="<u1")

# Assume direction is normalized
def render_ring(direction, color, width):
  global pixels
  ds = direction * coord_matrix
  ds = ds * 6 + width/2
  ds = np.clip(np.multiply(ds, (width - ds))/4,0,1)
  pixels += np.array(np.outer(ds, color), dtype="<u1")


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
    "prefs": prefs,
  }
  print(json.dumps(message))



# ================================ Core loop =========================================

def run_core_loop():
  last_frame_time = time()
  while True:
    time_to_wait = last_frame_time + 0.033 - time()
    if time_to_wait > 0:
      sleep(time_to_wait)
    frame_time = time() - last_frame_time
    # print("Frame rate %f\nFrame  time %dms" % (1/frame_time, int(frame_time * 1000)),file=sys.stderr)
    last_frame_time = time()
    update()

