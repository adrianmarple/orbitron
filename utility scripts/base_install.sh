#!/bin/bash

sudo sh -c 'echo orbitron > /etc/hostname'
sudo apt-get update
sudo apt-get install python3-pip
sudo apt-get install python3-numpy
sudo pip3 install adafruit-circuitpython-neopixel websockets
sudo apt-get install libsdl2-2.0
sudo apt-get install libsdl2-mixer-2.0-0
sudo pip3 install pygame
sudo apt-get install nodejs
sudo apt-get install npm
sudo npm install -g pm2
sudo pm2 install pm2-logrotate
git clone https://github.com/adrianmarple/orbitron
cd orbitron
npm install
cp config.js.template config.js
sudo pm2 start orbclient/orbclient.js
sudo pm2 start wifisetup.js
sudo pm2 startup
sudo pm2 save
echo "BASE INSTALL DONE!"