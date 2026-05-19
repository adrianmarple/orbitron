#!/usr/bin/env bash
# Compile and upload Arduino firmware to a locally-connected ESP32.
# Usage: bash scripts/arduino_upload.sh [chip] [port]
#   chip  defaults to prompt (esp32c3/esp32c6/esp32s3)
#   port  defaults to auto-detected USB serial port

set -e
cd "$(dirname "$0")/.."

CHIP=${1:-}
PORT=${2:-}

# Auto-detect port if not specified
if [ -z "$PORT" ]; then
  PORT=$(arduino-cli board list 2>/dev/null | awk '/\/dev\// {print $1}' | grep -E 'usbmodem|usbserial|SLAB|CH340|CP210' | head -1)
  if [ -z "$PORT" ]; then
    echo "Error: no device found. Plug in the ESP32 or specify port as second argument." >&2
    exit 1
  fi
  echo "Detected port: $PORT"
fi

# Prompt for chip if not specified (board list doesn't distinguish ESP32 variants)
if [ -z "$CHIP" ]; then
  echo "Chip type? [1] esp32c3  [2] esp32c6  [3] esp32s3  (default: 1)"
  read -r chip_choice
  case "$chip_choice" in
    2) CHIP="esp32c6" ;;
    3) CHIP="esp32s3" ;;
    *) CHIP="esp32c3" ;;
  esac
  echo "Using chip: $CHIP"
fi

case "$CHIP" in
  esp32c3) FQBN="esp32:esp32:esp32c3:PartitionScheme=custom,CDCOnBoot=cdc" ;;
  esp32c6) FQBN="esp32:esp32:esp32c6:PartitionScheme=custom,CDCOnBoot=cdc" ;;
  esp32s3) FQBN="esp32:esp32:esp32s3:PartitionScheme=custom,CDCOnBoot=cdc,PSRAM=opi" ;;
  *) echo "Error: unknown chip '$CHIP'. Use esp32c3, esp32c6, or esp32s3." >&2; exit 1 ;;
esac

echo "Regenerating portal HTML header..."
python3 scripts/gen_portal_header.py

VERSION=$(git rev-list --count HEAD -- arduino/esp32/)
echo "Compiling version $VERSION for $CHIP on $PORT..."

arduino-cli compile \
  --fqbn "$FQBN" \
  --build-property "compiler.cpp.extra_flags=-DFIRMWARE_VERSION_NUM=$VERSION" \
  --build-property "build.partitions=partitions" \
  --build-property "upload.maximum_size=1769472" \
  --upload \
  --port "$PORT" \
  arduino/esp32

# Re-detect port after upload — on macOS the port name sometimes changes on re-enumeration
sleep 0.5
NEW_PORT=$(arduino-cli board list 2>/dev/null | awk '/\/dev\// {print $1}' | grep -E 'usbmodem|usbserial|SLAB|CH340|CP210' | head -1)
if [ -n "$NEW_PORT" ]; then PORT="$NEW_PORT"; fi

echo "Done. Monitoring $PORT (Ctrl+C to exit)..."
if python3 -c "import serial" 2>/dev/null; then
  python3 -m serial.tools.miniterm --raw "$PORT" 115200
else
  cat "$PORT"
fi
