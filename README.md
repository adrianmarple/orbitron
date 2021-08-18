
# Getting Started

## Basics

### Image an SSD

- Download Raspberry Pi Imager: https://www.raspberrypi.org/software/

### Getting connected

- Connect PI to monitor/TV vio HDMI cable
- Connect USB keyboard to PI as well
- Login with username `pi` password `raspberry`
- Change password with `passwd`

### Configure SSH

- Run `sudo raspi-config`
- SSH is in Interfacing Options
- ~~Get ip address via arp `-a` (probably one of the last ones)~~
- Ensure Bonjour is running `sudo apt-get install avahi-daemon`
- `ssh pi@raspberrypi.local`

### Editing

- Download sshfs from https://osxfuse.github.io/ and install
- `mkdir ~/Rhomberban`
- `sshfs pi@raspberrypi.local:/home/pi/Rhomberman ~/Rhomberman`
- Make sure to do regular git commits as this is not backed up in Dropbox

## Raspberry PI stuff

### Python

- `sudo apt-get -y install python3-pip`
- `sudo apt install python3-numpy`
- `sudo pip3 install adafruit-circuitpython-neopixel websockets`
- `sudo apt-get update`
- `sudo apt install libsdl2-2.0`
- `sudo apt-get install libsdl2-mixer-2.0-0`
- `sudo pip3 install pygame`

### Node

- `curl -sL https://deb.nodesource.com/setup_10.x | sudo bash -`
- `sudo apt install nodejs`
- `sudo npm install -g ws`

### Set up access point

- Follow these instructions: https://www.raspberrypi.org/documentation/configuration/wireless/access-point-routed.md
- Be sure to make hotspot open by setting `wpa=0` in `hostapd.conf`

### Set up captive portal

- NO FUCKING CLUE???

### Setup to run on startup

- Edit cron `sudo crontab -e`
- Add the line `@reboot /usr/bin/node /home/pi/Rhomberman/server.js`

# Running the game

- `ssh pi@raspberrypi.local`
- `sudo /usr/bin/node ~/Rhomberman/server.js`
- Visit `http://raspberrypi.local:1337`


## Run only python

- `sudo python3 main.py`


# Other useful things

## If LED strip gets "stuck"

- `sudo reboot`
- Wait and then redo `ssh` and `sshfs`

## Unmount sshfs so you can remount

- `umount ~/Rhomberman`
- And if that fails: `sudo diskutil umount force ~/Rhomberman`


## WIFI QR code generator

- https://www.qr-code-generator.com/solutions/wifi-qr-code/
