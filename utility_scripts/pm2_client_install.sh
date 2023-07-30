#!/bin/bash

sudo npm install -g pm2
sudo pm2 install pm2-logrotate
cd ~/orbitron
sudo pm2 start orbclient/orbclient.js
sudo pm2 start wifisetup.js
sudo pm2 startup
sudo pm2 save