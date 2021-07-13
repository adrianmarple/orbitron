
## Edit through ssh by running
# sshfs pi@raspberrypi.local:/home/pi/Bomberman ~/Bomberman


# Joycon MAC addresses
# Black (L) B8:8A:EC:4E:F0:24
# Black (R) B8:8A:EC:4E:B1:E0

# import sys
# sys.path.append("/home/pi/.local/lib/python3.7/site-packages")


#  TODO invert y-axis of left joycons


import board
import neopixel

import math
import time

pixels = neopixel.NeoPixel(board.D18, 480, auto_write=True)

# while True:
# 	pixels.fill((int(math.sin(time.time()) * 50 + 50),10,1))

# pixels.fill((200,12,0))

pixels.fill((0,0,0))
