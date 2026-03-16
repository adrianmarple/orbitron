# Basics

Lumatron is a LED sculpture system. You are free to play with this code, but as per the license you may not make money from it.

## Connecting an existing piece to the internet

Here's how to connect a piece that does not already have an internet connection (if no piece is already connected to the same wifi you're on these instructions can also be viewed by visiting `https://my.lumatron.art`)
- Plug in the Lumatron box into the power source and the box into the piece (do not plug the piece directly into the usb-c wall plug)
- Wait for a few minutes for the box to boot up (until pink light is flashing)
- Join the wifi named Lumatron
- Once on that wifi, the visit url http://10.42.0.1
- Enter the wifi name (SSID) and password in the page that loads
- Refresh the page once the first pixel turns off

## Controlling a piece

- Visit `https://my.lumatron.art`
- (optional) Turn the site into a progressive web app by following the instructions at the bottom of the page

# Using the Emulator

- Clone (optionally fork first) this repo (`git clone https://github.com/adrianmarple/orbitron`) on your local machine (Windows not supported)
- Run `admin_install.sh` (in the `scripts` folder)
- Start the emulator by running `sudo ./startscript.sh`
- Open `http://localhost:1337/view` for the emulator
- Open `http://<localhost or your IP address>:1337` to open one or more controllers on either your desktop or your phone

## The admin console

- Make sure you've run `admin_install.sh`
- In terminal `cd` to `creation` folder
- Run `node pixelserver.js`
- Visit url `http://localhost:8080/?local`
- More details in [the creation folder README](creation)

## Controlling a piece

- Same as above, replacing `my.lumatron.art` with your server

# Designing a new pattern

See [the idlepatterns folder README](idlepatterns)

# Making a new Game

See [the games folder README](games)


# Setting up your own server

- Create an ubuntu server, for instance the lumatron.art is currently hosted through [Digital Ocean](https://www.digitalocean.com/)
- Open a console into root of your new server
- Fork then clone this repo: `git clone https://github.com/adrianmarple/orbitron`
- Run `server_install.sh` (in the `scripts` folder)

## Connect a piece to your own server

- Request an unlocked SD along with a piece, email adrian@marplebot.com an request it be unlocked remotely, or follow the **Micro SD card setup** instructions below
- Get local IP address `sudo nmap -sn 192.168.1.0/24` (once the admin console is set up, you'll be able to get the ip address directly from there)
- `ssh pi@<IP address>` (password `lumatron`) into the piece and change the password
- Edit `config.js` to add the line `RELAY_HOST: "your-domain-or-ip",`
- Run `sudo pm2 restart all`

## The admin console

- Run `admin_install.sh` (in the `scripts` folder) on your local machine
- Same as with a local admin console, in terminal `cd` to `creation` folder
- Run `node pixelserver.js`
- Visit url `http://localhost:8080/` (note that for the local admin console, we used `?local`, and are not doing that here)
- If in creation mode, click the "LUMATRON CREATION" button at the bottom to switch to admin mode
- I recommend hitting the "Set ORB_KEY" button followed by the "Save config.js" button for all connected orbs (including the server itself - default named "demo")
  - Note: if this button is not visible hit the "config" button first
- Again see [the creation folder README](creation) for more details

# Contributions Welcome

Here's a list of things I would welcome receiving PRs for.

- New idle patterns — See [idlepatterns/README.md](idlepatterns/README.md) for details
- New games — See [games/README.md](games/README.md) for details
- Clarifications or other improvements to any READMEs
- UX improvements or other quality of life features for the controller
- General optimizations or improvements

# Micro SD card setup

- Download [an unlocked SD card image](https://www.dropbox.com/scl/fi/ce7uv4ptdwy640emwvc8e/lumatron.zip) from dropbox
- Burn to SD card using `dd` or [Balena Etcher](https://etcher.balena.io/)
- Using `dd`
  - Update `/dev/disk4` or `/dev/sda` below with the correct drive as determined from `diskutil list` or `lsblk` on Linux
  - `diskutil unmountDisk /dev/disk4` or `sudo umount /dev/sda1 && sudo umount /dev/sda2` on Linux
  - go to Download directory or wherever the SD image download is
  - `sudo dd if=lumatron.img of=/dev/disk4 status=progress`
  - On MacOS use `gdd` instead
    - Install with `brew install coreutils`
    - `sudo gdd if=lumatron.img of=/dev/disk4 status=progress`
- Insert SD card into raspberry pi and power on
- Connect via `ssh pi@<<IP_ADDRESS>>` password `lumatron`
- Change to your own password

## (alternative) Fresh Setup

### Image an SD card

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

### Install git

- `sudo apt install git`

### Clone Repo and run installer

- `git clone https://github.com/adrianmarple/orbitron`
- `~/orbitron/scripts/pi_install.sh`

# Additional useful things of note

## Ripping a new SD card version
- Update `/dev/disk4` below with the correct drive as determined from `diskutil list` or `lsblk`
- `sudo dd if=/dev/disk4 of=lumatron.img bs=8M count=820 status=progress`
- On MacOS use `gdd` instead
  - Install with `brew install coreutils`
  - `sudo gdd if=/dev/disk4 of=lumatron.img bs=8M count=820 status=progress`