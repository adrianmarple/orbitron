
# Getting Started

## Basics

### Image an SSD

- Download Raspberry Pi Imager: https://www.raspberrypi.org/software/

### Change password

- `passwd`

### Configure SSH

- `sudo raspi-config`
- SSH is in Interfacing Options
- Get ip address via arp `-a` (probably one of the last ones)
- `ssh pi@192.168.1.[IP]`

### Editing

- Download sshfs from https://osxfuse.github.io/ and install
- `mkdir ~/Rhomberban`
- `sshfs pi@192.168.1.[IP]:/home/pi/Rhomberman ~/Rhomberman`
- Make sure to do regular git commits as this is not backed up in Dropbox

## RaspberryPi stuff

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

- `ssh pi@192.168.1.[IP]`
- `sudo /usr/bin/node ~/Rhomberman/server.js`


## Run only python

- `sudo python3 main.py`


# Other useful resources


## WIFI QR code generator
- https://www.qr-code-generator.com/solutions/wifi-qr-code/
