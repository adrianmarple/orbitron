#!/bin/bash

sudo sh -c 'echo orbitron > /etc/hostname'
sudo apt-get update
sudo apt-get install python3-pip python3-numpy python3-scipy libsdl2-2.0 libsdl2-mixer-2.0-0 nodejs npm python3-websockets python3-pygame python3-venv python3-pil i2c-tools libgpiod-dev vim libmicrohttpd-dev build-essential iptables

# Set up communications
sudo raspi-config nonint do_i2c 0
sudo raspi-config nonint do_spi 0
sudo raspi-config nonint do_serial 2
sudo raspi-config nonint do_ssh 0
sudo raspi-config nonint disable_raspi_config_at_boot 0

# Set up dnsmasq redirects for hotspot
sudo cp /home/pi/orbitron/utility_scripts/00-dnsmasq.conf /etc/NetworkManager/conf.d/
sudo cp /home/pi/orbitron/utility_scripts/00-orb.conf /etc/NetworkManager/dnsmasq-shared.d/

# Set up python
sudo python -m venv --system-site-packages ~/.env
source ~/.env/bin/activate
pip3 install adafruit-circuitpython-neopixel adafruit-circuitpython-ht16k33 adafruit-python-shell setuptools RPi.GPIO adafruit-blinka rpi_ws281x
deactivate

# Install npm stuff
cd ~/orbitron
npm install

cp config.js.template config.js

echo "BASE INSTALL DONE!"