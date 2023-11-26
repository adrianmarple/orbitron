#!/bin/bash

sudo sh -c 'echo orbitron > /etc/hostname'
sudo apt-get update
sudo apt-get install python3-pip python3-numpy python3-scipy libsdl2-2.0 libsdl2-mixer-2.0-0 nodejs npm python3-websockets python3-pygame python3-venv python3-pil i2c-tools libgpiod-dev

sudo raspi-config nonint do_i2c 0
sudo raspi-config nonint do_spi 0
sudo raspi-config nonint do_serial 0
sudo raspi-config nonint do_ssh 0
sudo raspi-config nonint disable_raspi_config_at_boot 0

sudo python -m venv --system-site-packages ~/.env
source ~/.env/bin/activate
pip3 install adafruit-circuitpython-neopixel adafruit-circuitpython-ht16k33 adafruit-python-shell setuptools RPi.GPIO adafruit-blinka
cd ~/orbitron
npm install
cp config.js.template config.js
deactivate
echo "BASE INSTALL DONE!"