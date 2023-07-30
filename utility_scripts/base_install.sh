#!/bin/bash

sudo sh -c 'echo orbitron > /etc/hostname'
sudo apt-get update
sudo apt-get install python3-pip python3-numpy libsdl2-2.0 libsdl2-mixer-2.0-0 nodejs npm
sudo pip3 install adafruit-circuitpython-neopixel websockets pygame
git clone https://github.com/adrianmarple/orbitron
cd orbitron
npm install
cp config.js.template config.js
echo "BASE INSTALL DONE!"