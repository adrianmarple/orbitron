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

- Download SD card image from [https://www.dropbox.com/scl/fi/ce7uv4ptdwy640emwvc8e/Orbitron.img.zip?rlkey=cfcn58lnl0pesi8mir0tjp9s4&dl=0](https://www.dropbox.com/scl/fi/ozr9dnu158dimkmprlhe0/orbitron.zip?rlkey=098ywe4ws95k9ho0lqi6p5suq&dl=0)
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

- `ssh pi@orbitron.local` or get IP address from `avahi-browse -ar` or `sudo nmap -sn 192.168.1.0/24` and go to `ssh pi@<IP address>`
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
  - `sudo gdd if=/dev/disk2 of=Orbitron.img bs=1M status=progress bs=8M`

## Adding WiFi network to Pi for auto connect
- Connect to unsecure Wifi with SSID "Super Orbitron"
- Go to `http://192.168.4.1:9090`
- Enter SSID and password of desired wifi and submit

### Manual edit
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

## Circuit Python on Feather RP2040 SCORPIO

- Follow instructions here: `https://learn.adafruit.com/introducing-feather-rp2040-scorpio/overview`

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


# OG/Fresh Setup on Pi Hardware

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
- You should see `orbitron login:` when it is readyz
- Login with the username and password you set

### Connect to WiFi

- Run `sudo raspi-config`
- Select `System Options` and `Wireless LAN`
- Select the appropriate country from the list
- Enter SSID and password of wifi network

### Configure SSH

- Run `sudo raspi-config`
- Select `Interface Options` and `SSH`
- Select `Yes` to turn on SSH service

### Configure SPI

- Run `sudo raspi-config`
- Select `Interface Options` and `SPI`
- Select `Yes` to turn on SPI service

### Configure I2C

- Run `sudo raspi-config`
- Select `Interface Options` and `I2C`
- Select `Yes` to turn on I2C service

### Configure Serial

- Run `sudo raspi-config`
- Select `Interface Options` and `Serial Port`
- Select `No` to disable serial login shell
- Select `Yes` to turn on serial port communication


### Configure Bonjour

- Ensure Bonjour is running `sudo apt install avahi-daemon`
- You should be able to ssh in to the pi with `ssh pi@orbitron.local`

### Install git

- `sudo apt install git`

### Clone Repo and run installer

- `git clone https://github.com/adrianmarple/orbitron`
- `~/orbitron/utility_scripts/base_install.sh`
- `~/orbitron/utility_scripts/pm2_setup.sh`
