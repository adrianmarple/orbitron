
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
- Enusre Bonjour is running `sudo apt-get install avahi-daemon`
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

### Node

- `curl -sL https://deb.nodesource.com/setup_10.x | sudo bash -`
- `sudo apt install nodejs`
- `sudo npm install -g ws`

### Set up access point

- Follow these instructions: https://www.raspberrypi.org/documentation/configuration/wireless/access-point-routed.md
- Be sure to make hotspot open by setting `wpa=0` in `hostapd.conf`



# Running the game

- `ssh pi@raspberrypi.local`
- `sudo /usr/bin/node ~/Rhomberman/server.js`


## Run only python

- `sudo python3 main.py`


# Other useful resources


## WIFI QR code generator
- https://www.qr-code-generator.com/solutions/wifi-qr-code/
