# Making a new Game

See [the games folder README](games)

# Using the Emulator

- Clone the repo somewhere for you to work from
- Copy `config.js.template` to `config.js` and edit to have `DEV_MODE: true` and `ORB_ID: <your unique ID>`
- Run `npm install`
- Install python libraries
  - `pip3 install adafruit-circuitpython-neopixel websockets numpy pygame`
- Run `sudo node server.js`
- Open `http://localhost:1337/dev` for the emulator
- Open `http://<localhost or your IP address>:1337` to open one or more controllers on either your desktop or your phone
- Edit, commit, create pull requests as you would for any Git project

# Getting Pi Hardware Set Up

- Download SD card image from https://www.dropbox.com/s/gg0u2rp2sr6uatj/Orbitron.img.zip?dl=0
- Update `/dev/disk2` or `/dev/sda` below with the correct drive as determined from `diskutil list` or `lsblk` on Linux
- `diskutil unmountDisk /dev/disk2` or `sudo umount /dev/sda1 && sudo umount /dev/sda2` on Linux
- go to Download directory or wherever the SD image download is
- `sudo dd if=Orbitron.img of=/dev/disk2 status=progress`
- On MacOS use `gdd` instead
  - Install with `brew install coreutils`
  - `sudo gdd if=Orbitron.img of=/dev/disk2 status=progress`

## SSHFS

- Download sshfs from https://osxfuse.github.io/ and install
- `mkdir ~/orbitron`

# Editing on the Pi

## SSH

- `ssh pi@orbitron.local` or get IP address from `avahi-browse -ar` and go to `ssh pi@<IP address>`
- `sshfs pi@orbitron.local:/home/pi/orbitron ~/orbitron`

## Running on PI hardware

- ssh into the pi
- `cd orbitron`
- `sudo pm2 restart <server or orbclient>`
- Visit `http://orbitron.local:1337` or get IP address from `avahi-browse -ar` and go to `http://<IP address>:1337`
- `sudo pm2 log` to tail logs. Log files are stored in `/root/.pm2/logs`

## Saving
- Just use normal git commands with within directory `~/orbitron`
- If you edit outside the version controlled directory create a new SD card image
- Update `/dev/disk2` below with the correct drive as determined from `diskutil list` or `lsblk`
- `sudo dd if=/dev/disk2 of=Orbitron.img bs=1M status=progress`
- On MacOS use `gdd` instead
  - Install with `brew install coreutils`
  - `sudo gdd if=/dev/disk2 of=Orbitron.img bs=1m status=progress`

## Adding WiFi network to Pi for auto connect
- Edit `/etc/wpa_supplicant/wpa_supplicant.conf` with your editor of choice
- Insert an entry at the bottom of the following format:
```
network={
	ssid="SSID"
	psk="PASSWORD"
	key_mgmt=WPA-PSK
	scan_ssid=1
	id_str="UNIQUE_ID"
	priority=1
}
```
- Save the file and restart, it should auto connect to the network (provided it doesn't find another one in the list)

# Other useful things

## Vonets Hardware Setup

- Plug the USB and LAN cables into your computer
- Hold down reset button for some time to reset the device
- Power Cycle the device (unplug and replug USB)
- Navigate to `192.168.254.254`
- Log in with `admin` as username and password
- Select the `Operative Status` button
- Click the `Scan Hotspots` tab and select your hotspot from the list, then click `Next`
- Enter the hotpsot's password, uncheck `The configuration parameters of WiFi repeater security is synchronized with source hotspot` enter `Super Orbitron` into the `Repeater SSID` field and click `Apply`
- Click `To Connect` when it loads
- Click `Start Connect` and wait for the page to reload and show that it is connected to the hotspot
- Click the `WiFi Repeater` tab and then `WiFi Security`
- Change `Security Mode` to `Disable` and hit `Apply`
- You will need to power cycle the Vonets device after all this is done and then plug it into the Pi to test
- Manual available [here](http://www.vonets.com/download/VAP11G-300/VAP11G-300%E2%80%94%E2%80%94Quick%20Setting%20Guide.pdf)

## Unmount sshfs so you can remount

- `sudo diskutil umount force ~/orbitron`
- `sshfs pi@orbitron.local:/home/pi/orbitron ~/orbitron`

# OG/Fresh Setup on Pi Hardware

## Basics

### Image an SSD

- Download Raspberry Pi Imager: https://www.raspberrypi.org/software/

### Getting connected

- Connect PI to monitor/TV vio HDMI cable
- Connect USB keyboard to PI as well
- Login with username `pi` password `raspberry`
- Change password with `passwd`

### Change hostname

- Edit `/etc/hostname` and change `raspberrypi` to `orbitron`

### Connect to WiFi

- Run `sudo raspi-config`
- Select `System Options` and `Wireless LAN`
- Select the appropriate country from the list
- Enter SSID and password of wifi network

### Configure SSH

- Run `sudo raspi-config`
- SSH is in Interfacing Options
- Ensure Bonjour is running `sudo apt-get install avahi-daemon`
- `ssh pi@orbitron.local`

### Install Python

- `sudo apt-get update`
- `sudo apt-get install python3-pip`
- `sudo apt-get install python3-numpy`
- `sudo pip3 install adafruit-circuitpython-neopixel websockets`
- `sudo apt-get install libsdl2-2.0`
- `sudo apt-get install libsdl2-mixer-2.0-0`
- `sudo pip3 install pygame`

### Install Node

- `sudo apt-get install nodejs`
- `sudo apt-get install npm`
- `sudo npm install -g pm2`
- `sudo pm2 install pm2-logrotate`

### Clone Repo

- `git clone https://github.com/adrianmarple/orbitron`
- `cd orbitron`
- `npm install`
- `cp config.js.template config.js`

### Setup to run on startup on Pi (still within orbitron directory)

- `sudo pm2 start <server.js or orbclient/orbclient.js>`
- `sudo pm2 start wifisetup.js`
- `sudo pm2 startup`
- `sudo pm2 save`

