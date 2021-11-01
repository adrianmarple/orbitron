
# Getting Set Up

- Download SD card image from https://www.dropbox.com/s/2hdpyheacp6xizh/Orbotron.dmg.zip?dl=0
- Update `/dev/disk2` below with the correct drive as determined from `diskutil list`
- `diskutil unmountDisk /dev/disk2`
- go to Download directory or wherever the SD image download is
- `sudo dd if=Orbotron.dmg of=/dev/disk2`

## SSH

- Download sshfs from https://osxfuse.github.io/ and install
- `mkdir ~/Rhomberban`

# Editing

## SSH

- `ssh pi@raspberrypi.local`
- `sshfs pi@raspberrypi.local:/home/pi/Rhomberman ~/Rhomberman`

## Running the game

- ssh into the pi
- `sudo killall python3 node`
- `sudo /usr/bin/node ~/Rhomberman/server.js`
- Visit `http://192.168.4.1:1337`
- Of if using mDNS, visit `http://raspberrypi.local:1337`

## Saving
- Just use normal git commands with within directory `~/Rhomberman`
- If you edit outside the version controlled directory create a new SD card image
- Update `/dev/disk2` below with the correct drive as determined from `diskutil list`
- `sudo dd if=/dev/disk2 of=Orbotron.dmg`

# Other useful things

## Unmount sshfs so you can remount

- `sudo diskutil umount force ~/Rhomberman`
- `sshfs pi@raspberrypi.local:/home/pi/Rhomberman ~/Rhomberman`

## WIFI QR code generator

- https://www.qr-code-generator.com/solutions/wifi-qr-code/
- https://goqr.me/


# OG Setup (out of date)

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
- Ensure Bonjour is running `sudo apt-get install avahi-daemon`
- `ssh pi@raspberrypi.local`

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

### Setup to run on startup

- Edit cron `sudo crontab -e`
- Add the line `@reboot /usr/bin/node /home/pi/Rhomberman/server.js`
