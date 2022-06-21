#!/usr/bin/env python

import fileinput
import os
import sys
import time
from threading import Thread


import digitalio
import board
from orbpixel import neopixel_write
pin = digitalio.DigitalInOut(board.D18)
pin.direction = digitalio.Direction.OUTPUT
pixels = None
dirty = False

def consume_input():
  global pixels, dirty
  for line in fileinput.input():
    try:
      pixels = bytes.fromhex(line.strip())
      dirty = True
      #print("input raw:\n%s" % len(line.strip()), file=sys.stderr)
      #print("input:\n%s" % len(pixels), file=sys.stderr)
    except Exception as e:
      print("input error:\n%s" % e, file=sys.stderr)

def run_core_loop():
  global dirty
  while True:
    if dirty:
      neopixel_write(pin, pixels)
      dirty = False
    time.sleep(0.01)

thread = Thread(target=consume_input)
thread.start()

run_core_loop()
