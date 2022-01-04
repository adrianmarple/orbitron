
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

- `ssh pi@orbitron.local` or if connected to Pi AP: `ssh pi@192.168.4.1`
- `sshfs pi@orbitron.local:/home/pi/Rhomberman ~/Rhomberman`

## Running locally

- ssh into the pi
- `sudo killall python3 node`
- `export SWITCHBOARD="http://localhost:9000"`
- `cd Rhomberman`
- `node server.js`
- `node switchboard.js`
- Visit `http://orbitron.local:9000`

## Saving
- Just use normal git commands with within directory `~/Rhomberman`
- If you edit outside the version controlled directory create a new SD card image
- Update `/dev/disk2` below with the correct drive as determined from `diskutil list`
- `sudo dd if=/dev/disk2 of=Orbotron.dmg`

# Other useful things


## Access Point Setup

- Follow these instructions: https://www.raspberrypi.com/documentation/computers/configuration.html#setting-up-a-routed-wireless-access-point 
- Contents of hostapd.conf:
```
country_code=US
interface=wlan0
ssid=Super Orbitron
hw_mode=g
channel=7
macaddr_acl=0
auth_algs=1
ignore_broadcast_ssid=0
wpa=0
```
- Contents of dnsmasq.conf:
```
interface=wlan0
server=8.8.8.8
dhcp-range=192.168.4.2,192.168.4.250,255.255.255.0,12h
domain=wlan
address=/orbitron/192.168.4.1
```

## Vonets Hardware Setup

- Plug the USB and LAN cables into your computer
- Navigate to `http://vonets.cfg` or `192.168.254.254`
- Log in with `admin` as username and password
- Use the Wizard and follow instructions to set it up
- NOTE: When going through the wizard, set it up to not be a wifi repeater and to not have the DHCP server running. Might need to do this post-wizard in the Vonets settings.
- Manual available [here](http://www.vonets.com/download/VAP11G-300/VAP11G-300%E2%80%94%E2%80%94Quick%20Setting%20Guide.pdf)
- NOTE: after initial setup, more access points can be added to the hardware for it to connect to using the setup page

## Captive Portal Setup

- Clone NoDogSplash into home directory and make then install it: https://github.com/nodogsplash/nodogsplash
- `git clone https://github.com/nodogsplash/nodogsplash.git`
- `cd ~/nodogsplash`
- `make`
- `sudo make install`
- Edit the config file
- `sudo nano /etc/nodogsplash/nodogsplash.conf`
- Find and uncomment and edit the following lines to match
- `GatewayInterface wlan0` and `GatewayAddress 192.168.4.1`
- Then run it and confirm it works by connecting to the AP `sudo nodogsplash`
- Once confirmed working, add to chron
- Edit cron `sudo crontab -e`
- Add the line `@reboot /usr/bin/nodogsplash`
- Edit the splash by following the docs: https://nodogsplashdocs.readthedocs.io/en/stable/customize.html

## Unmount sshfs so you can remount

- `sudo diskutil umount force ~/Rhomberman`
- `sshfs pi@orbitron.local:/home/pi/Rhomberman ~/Rhomberman`

## WIFI QR code generator

- https://goqr.me/

## Add wifi password (Obsolete)

- Setup wifi hotspot "Dragonair" password "dragonrage"
- Visit `http://orbitron.local:9090`
- Fill out the form then turn hotspot off and restart the Orbitron

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
