#!/bin/bash
# Install arduino-cli, required libraries, and git hooks for ESP32 firmware builds.
set -e

cd "$(dirname "$0")/.."

# Install arduino-cli
if command -v arduino-cli &>/dev/null; then
  echo "arduino-cli already installed: $(arduino-cli version)"
else
  echo "Installing arduino-cli..."
  curl -fsSL https://raw.githubusercontent.com/arduino/arduino-cli/master/install.sh | sh
  # install.sh puts the binary in ./bin — move it to /usr/local/bin
  if [ -f bin/arduino-cli ]; then
    sudo mv bin/arduino-cli /usr/local/bin/arduino-cli
    rmdir bin 2>/dev/null || true
  fi
  echo "arduino-cli installed: $(arduino-cli version)"
fi

# Add ESP32 board index
echo "Updating board index..."
arduino-cli config init --overwrite
arduino-cli config add board_manager.additional_urls \
  https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
arduino-cli core update-index

# Install ESP32 core
echo "Installing esp32 core..."
arduino-cli core install esp32:esp32

# Install required libraries
echo "Installing libraries..."
arduino-cli lib install "Adafruit NeoPixel"
arduino-cli lib install "WebSockets"
arduino-cli lib install "ArduinoJson"

# Install git hooks
echo "Installing git hooks..."
cp scripts/hooks/pre-push .git/hooks/pre-push
chmod +x .git/hooks/pre-push
cp scripts/hooks/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit

echo "Done. arduino-cli and git hooks installed."
