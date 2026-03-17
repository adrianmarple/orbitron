#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"

# Write config.js
CONFIG_FILE="$ROOT_DIR/config.js"
if [ -f "$CONFIG_FILE" ]; then
  echo "WARNING: $CONFIG_FILE already exists. Skipping."
else
  cat > "$CONFIG_FILE" << 'EOF'
module.exports={
  ORB_ID:"demo",
  ORB_KEY: "302695c58cda528101d1bbb4fcc437dde33b168dc0ff9104029ea93639a0c09f",
  DEV_MODE: false,
  HAS_EMULATION: true,
  CLEAR_PREFS_ON_DISCONNECT: true,
  PIXELS: "sixfold/ravenstear",
  HTTP_SERVER_PORT: 443,
  WEBHOOK_SECRET: "rhomberman",
  IS_RELAY: true,
  KEY_LOCATION: '/etc/letsencrypt/live/orbitron.games/privkey.pem',
  CERT_LOCATION: '/etc/letsencrypt/live/orbitron.games/fullchain.pem',
  EXCLUDE: {
    save: true,
    timing: true,
  },
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

# Set up pm2
echo "Setting up pm2..."
sudo npm install -g pm2
sudo pm2 install pm2-logrotate
sudo pm2 start "$ROOT_DIR/startscript.sh"
sudo pm2 startup
sudo pm2 save

echo "Server install complete."
