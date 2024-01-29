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

- Download SD card image from dropbox ([64bit](https://www.dropbox.com/scl/fi/ce7uv4ptdwy640emwvc8e/Orbitron.img.zip?rlkey=cfcn58lnl0pesi8mir0tjp9s4&dl=0)) ([32bit](https://www.dropbox.com/scl/fi/ne9wkzyzw1fwcz2slw6lc/orbitron-32bit.zip?rlkey=ficqr8w6p3yw4oba0fclzr9kx&dl=0))
- Burn to SD card using `dd` or Balena Etcher (https://etcher.balena.io/)
- Using `dd`
  - Update `/dev/disk2` or `/dev/sda` below with the correct drive as determined from `diskutil list` or `lsblk` on Linux
  - `diskutil unmountDisk /dev/disk2` or `sudo umount /dev/sda1 && sudo umount /dev/sda2` on Linux
  - go to Download directory or wherever the SD image download is
  - `sudo dd if=Orbitron.img of=/dev/disk2 status=progress`
  - On MacOS use `gdd` instead
    - Install with `brew install coreutils`
    - `sudo gdd if=Orbitron.img of=/dev/disk2 status=progress`

# Making a new Game

See [the games folder README](games)

# Editing on the Pi

## Running on PI hardware

- `ssh pi@orbitron.local` or get IP address from `avahi-browse -ar` or `sudo nmap -sn 192.168.1.0/24` and go to `ssh pi@<IP address>`
- `cd orbitron`
- `sudo pm2 restart all`
- Visit `http://orbitron.local:1337` or get IP address from `avahi-browse -ar` and go to `http://<IP address>:1337`
- `sudo pm2 log` to tail logs. Log files are stored in `/root/.pm2/logs`

## Saving
- Just use normal git commands within directory `~/orbitron`
- If you edit outside the version controlled directory create a new SD card image
- Update `/dev/disk2` below with the correct drive as determined from `diskutil list` or `lsblk`
- `sudo dd if=/dev/disk2 of=Orbitron.img bs=8M count=820 status=progress`
- On MacOS use `gdd` instead
  - Install with `brew install coreutils`
  - `sudo gdd if=/dev/disk2 of=Orbitron.img bs=8M count=820 status=progress`

## Adding WiFi network to Pi for auto connect
- Connect to unsecure Wifi with SSID "Super Orbitron"
- Visit url `10.42.0.1`
- Enter SSID and password of desired wifi and submit

# Fresh Setup on Pi Hardware

### Image an SSD

- Download Raspberry Pi Imager: https://www.raspberrypi.org/software/
- Select the latest 64-bit Raspberry PI OS
- Click the gear icon to change the settings of the install
- Set hostname to `orbitron`
- Enable SSH with password authentication
- enter pi as the username and enter a password
- Configure wireless LAN to connect to your local wifi
- Set timezone and select us Keyboard layout
- Save and click `WRITE` to burn the image
- Plug SD Card into PI

### Getting connected

- Connect PI to monitor/TV via HDMI cable
- Connect USB keyboard to PI as well
- Power on the PI
- Wait for some time, it may need to reboot 2 or more times
- You should see `orbitron login:` when it is ready
- Login with the username and password you set

### Connect to WiFi

- Run `sudo raspi-config`
- Select `System Options` and `Wireless LAN`
- Select the appropriate country from the list
- Enter SSID and password of wifi network

### Install git

- `sudo apt install git`

### Clone Repo and run installer

- `git clone https://github.com/adrianmarple/orbitron`
- `~/orbitron/utility_scripts/base_install.sh`


# Other useful things

## Circuit Python on Feather RP2040 SCORPIO

- Follow instructions here: https://learn.adafruit.com/introducing-feather-rp2040-scorpio/overview

## 14 segment display wiring diagram

- https://learn.adafruit.com/adafruit-led-backpack/0-54-alphanumeric-python-wiring-and-setup#wiring-original-version-3128023

## SSHFS

- Download sshfs from https://osxfuse.github.io/ and install
- `mkdir ~/orbitron`
- `sshfs pi@orbitron.local:/home/pi/orbitron ~/orbitron`

- `~/orbitron/utility_scripts/pm2_setup.sh`
