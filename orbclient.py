#!/usr/bin/env python

import fileinput
import os
import sys


import digitalio
import board
from orbpixel import neopixel_write
pin = digitalio.DigitalInOut(board.D18)
pin.direction = digitalio.Direction.OUTPUT

def run_core_loop():
  while True:
    consume_input()

def consume_input():
  for line in fileinput.input():
    try:
      pixels = bytes.fromhex(line.strip())
      #print("input:\n%s" % pixels, file=sys.stderr)
      neopixel_write(pin, pixels)
    except Exception as e:
      print("input error:\n%s" % e, file=sys.stderr)

run_core_loop()
