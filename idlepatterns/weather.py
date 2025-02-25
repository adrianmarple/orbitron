#!/usr/bin/env python
import json
from math import pi, sqrt, sin, cos
import numpy as np
import os
from random import randrange, random
import sys
from time import time
import urllib.request

import engine
from engine import RAW_SIZE, unique_coord_matrix
from idlepatterns.sin import Sin

config = json.loads(os.getenv("CONFIG"))

class Weather(Sin):
  previous_update_time = 0
  time_factor = 0
  previous_time = 0
  weather_data = None

  def update_weather_data(self):
    # Reference: https://openweathermap.org/api/one-call-3
    url = "https://api.openweathermap.org/data/3.0/onecall?lat=%s&lon=%s&exclude=%s&appid=%s" % (
      config["LAT"],
      config["LON"],
      "current,minutely,daily,alerts",
      config["WEATHER_API_KEY"]
    )
    try:
      contents = urllib.request.urlopen(url).read()
      self.weather_data = json.loads(contents)["hourly"]
    except:
      print("Failed to access weather data.", file=sys.stderr)
    self.previous_update_time = time()

  def init_values(self):
    if time() - self.previous_update_time > 60*60:
      self.update_weather_data()

    if self.weather_data is not None:
      index = len(self.weather_data)
      for i in range(len(self.weather_data)):
        if self.weather_data[i]["dt"] > time():
          index = i
          break

      if index == 0:
        index = 1
        a = 0
      elif index == len(self.weather_data):
        index -= 1
        a = 1
      else:
        delta_t = self.weather_data[index]["dt"] - self.weather_data[index - 1]["dt"]
        a = (time() - self.weather_data[index - 1]["dt"]) / delta_t
      
      snapshot0 = self.weather_data[index - 1]
      snapshot1 = self.weather_data[index]
    else:
      a = 0
      snapshot0 = {
        "wind_speed": 5,
        "wind_deg": 0,
        "uvi": 2,
        "temp": 300,
      }
      snapshot1 = snapshot0


    self.wind_speed = a * snapshot0["wind_speed"] + (1-a) * snapshot1["wind_speed"] 
    self.wind_direction = a * wind_vector(snapshot0) + (1-a) * wind_vector(snapshot1) # m/s
    if np.sum(self.wind_direction) != 0:
      self.wind_direction /= np.linalg.norm(self.wind_direction)
    self.uvi = a * snapshot0["uvi"] + (1-a) * snapshot1["uvi"]
    self.temp = a * snapshot0["temp"] + (1-a) * snapshot1["temp"] # Kelvin
    rain0 = 0
    if "rain" in snapshot0:
      rain0 = snapshot0["rain"]["1h"]
    rain1 = 0
    if "rain" in snapshot1:
      rain1 = snapshot1["rain"]["1h"]
    self.rain = a * rain0 + (1-a) * rain1 # mm/h

    Sin.init_values(self)


  def min_value(self):
    return 0.1

  def direction(self):
    return -self.wind_direction

  def period(self):
    return sqrt(self.wind_speed * 3)

  def speed(self):
    return self.wind_speed / 30


  def apply_color(self):
    end = np.array((0, 0, 0.9))
    end[1] += (self.temp - 275) / 50
    start = np.array((0.1, 0.9, 0.1))
    start[2] += sqrt(self.rain)/2

    rectified_target_values = self.target_values.copy()
    rectified_target_values = np.minimum(1, rectified_target_values)
    start_colors = np.outer(rectified_target_values, start)
    end_colors = np.outer(1 - rectified_target_values, end)
    colors = start_colors + end_colors

    uvf = 1 / (1 + self.uvi)
    uv_color = np.array((1 - 0.4*uvf, 1 - 0.8*uvf, 1 - 0.9*uvf))
    self.render_values = np.outer(self.render_values, uv_color)
    self.render_values = np.multiply(self.render_values, colors)

  def color(self):
    r = 1 / (1 + self.uvi)
    b = sqrt(self.rain)
    b = min(b, 1)
    return np.array((r,g,b))

def wind_vector(snapshot):
  theta = snapshot["wind_deg"] * pi / 180 # clockwise from north
  return np.array((sin(theta), cos(theta), 0)) * snapshot["wind_speed"]

idle = Weather()
