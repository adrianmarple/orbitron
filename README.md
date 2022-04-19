# Getting Set Up

- Download SD card image from (TO UPDATE)
- Update `/dev/disk2` or `/dev/sda` below with the correct drive as determined from `diskutil list` or `lsblk` on Linux
- `diskutil unmountDisk /dev/disk2` or `sudo umount /dev/sda1 && sudo umount /dev/sda2` on Linux
- go to Download directory or wherever the SD image download is
- `sudo dd if=Orbotron.img of=/dev/disk2 status=progress`


## SSHFS

- Download sshfs from https://osxfuse.github.io/ and install
- `mkdir ~/Rhomberban`

# Editing

## SSH

- `ssh pi@orbitron.local` or: `ssh pi@192.168.1.101`
- `sshfs pi@orbitron.local:/home/pi/Rhomberman ~/Rhomberman`

## Running locally

- ssh into the pi
- `sudo killall python3 node`
- `cd Rhomberman`
- `node server.js`
- Visit `http://orbitron.local:1337` or `http://192.168.1.101:1337`

## Saving
- Just use normal git commands with within directory `~/Rhomberman`
- If you edit outside the version controlled directory create a new SD card image
- Update `/dev/disk2` below with the correct drive as determined from `diskutil list` or `lsblk`
- `sudo dd if=/dev/disk2 of=Orbotron.img bs=1M count=8000 status=progress`

# Other useful things

## Vonets Hardware Setup

- Plug the USB and LAN cables into your computer
- Hold down reset button for some time to reset the device
- Navigate to `http://vonets.cfg` or `192.168.254.254`
- Log in with `admin` as username and password
- Use the Wizard and follow instructions to set it up
- NOTE: When going through the wizard, set it up to be a wifi repeater with SSID "Super Orbitron" and to have the DHCP server running. Then go to the Wifi Repeater settings tab and disable Wifi Security. You'll have to power cycle the Vonets device for this to work properly.
- Manual available [here](http://www.vonets.com/download/VAP11G-300/VAP11G-300%E2%80%94%E2%80%94Quick%20Setting%20Guide.pdf)

## Unmount sshfs so you can remount

- `sudo diskutil umount force ~/Rhomberman`
- `sshfs pi@orbitron.local:/home/pi/Rhomberman ~/Rhomberman`

# OG/Fresh Setup

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
- `ssh pi@orbitron.local`

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

### Setup to run on startup

- Edit cron `sudo crontab -e`
- Add the line `@reboot /usr/bin/node /home/pi/Rhomberman/server.js`

### Static IP

- Follow this guide: https://linuxhint.com/raspberry_pi_static_ip_address/
- Basically, edit `/etc/dhcpcd.conf` and uncomment and edit the lines about a static IP on eth0 to use `192.168.1.101`
