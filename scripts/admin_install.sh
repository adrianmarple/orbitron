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

# Write config.js
CONFIG_FILE="$ROOT_DIR/config.js"
if [ -f "$CONFIG_FILE" ]; then
  echo "WARNING: $CONFIG_FILE already exists. Skipping."
else
  cat > "$CONFIG_FILE" << 'EOF'
module.exports={
  ORB_ID: "test",
  DEV_MODE: true,
  HAS_EMULATION: true,
  IS_RELAY: true,
}
EOF
  echo "Created $CONFIG_FILE"
fi

# Install Node dependencies
echo "Installing Node dependencies..."
npm --prefix "$ROOT_DIR" install
npm --prefix "$ROOT_DIR/creation" install

# Set up Python virtual environment
VENV_DIR="$ROOT_DIR/.venv"
if [ ! -d "$VENV_DIR" ]; then
  python3 -m venv "$VENV_DIR"
  echo "Created Python venv at $VENV_DIR"
fi
echo "Installing Python dependencies..."
"$VENV_DIR/bin/pip" install -r "$ROOT_DIR/requirements.txt"

echo "Admin install complete."
