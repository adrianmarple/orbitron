#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

# Generate a random master key
MASTERKEY_FILE="$ROOT_DIR/masterkey.txt"
if [ -f "$MASTERKEY_FILE" ]; then
  echo "WARNING: $MASTERKEY_FILE already exists. Skipping."
else
  openssl rand -hex 48 > "$MASTERKEY_FILE"
  echo "Created $MASTERKEY_FILE"
fi

# Get domain name - extract from existing cert if certbot has already run
EXISTING_DOMAIN=$(ls /etc/letsencrypt/live/ 2>/dev/null | grep -v README | head -n1)
if [ -n "$EXISTING_DOMAIN" ]; then
  DOMAIN="$EXISTING_DOMAIN"
  echo "Using existing cert domain: $DOMAIN"
else
  read -p "Enter your domain name (e.g. my.lumatron.art): " DOMAIN
fi

# Write config.js
CONFIG_FILE="$ROOT_DIR/config.js"
if [ -f "$CONFIG_FILE" ]; then
  echo "WARNING: $CONFIG_FILE already exists. Skipping."
else
  cat > "$CONFIG_FILE" << EOF
module.exports={
  ORB_ID:"demo",
  KEY_LOCATION: '/etc/letsencrypt/live/${DOMAIN}/privkey.pem',
  CERT_LOCATION: '/etc/letsencrypt/live/${DOMAIN}/fullchain.pem',
  HAS_EMULATION: true,
  CLEAR_PREFS_ON_DISCONNECT: true,
  PIXELS: "sixfold/ravenstear",
  RELAY_HOST: "${DOMAIN}",
  HTTP_SERVER_PORT: 443,
  IS_RELAY: true,
  EXCLUDE: {
    save: true,
    timing: true,
  },
  ALIASES: {},
}
EOF
  echo "Created $CONFIG_FILE"
fi

# Install Node.js if not present
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install Node dependencies
echo "Installing Node dependencies..."
npm --prefix "$ROOT_DIR" install

# Set up Python virtual environment
VENV_DIR="$ROOT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
  sudo apt-get install -y python3-venv
  python3 -m venv "$VENV_DIR"
  echo "Created Python venv at $VENV_DIR"
fi
echo "Installing Python dependencies..."
"$VENV_DIR/bin/pip" install -r "$ROOT_DIR/requirements.txt"

# Install certbot and get cert
echo "Installing certbot..."
sudo apt-get install -y certbot
if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
  echo "SSL certificate for $DOMAIN already exists. Skipping."
else
  echo "Obtaining SSL certificate for ${DOMAIN}..."
  sudo certbot certonly --standalone -d "$DOMAIN"
fi

# Set up pm2
echo "Setting up pm2..."
sudo env "PATH=$PATH" npm install -g pm2
sudo env "PATH=$PATH" pm2 install pm2-logrotate
if pm2 describe startscript &>/dev/null; then
  pm2 restart all
else
  pm2 start "$ROOT_DIR/startscript.sh"
fi
sudo env "PATH=$PATH" pm2 startup
pm2 save

# Install Arduino CLI and dependencies for OTA firmware builds
ARDUINO_CLI_URL="https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh"
if ! command -v arduino-cli &> /dev/null; then
  echo "Installing Arduino CLI..."
  curl -fsSL "$ARDUINO_CLI_URL" | BINDIR=/usr/local/bin sh
fi
echo "Configuring Arduino CLI..."
arduino-cli config init --overwrite
arduino-cli config add board_manager.additional_urls \
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32
echo "Installing Arduino libraries..."
arduino-cli lib install "Adafruit NeoPixel"
arduino-cli lib install "WiFiManager"
arduino-cli lib install "WebSockets_Generic"
arduino-cli lib install "ArduinoJson"

echo "Server install complete."
