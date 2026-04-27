#!/usr/bin/env bash
# Build Arduino firmware locally for all supported chips and upload to relay server.
# Usage: bash scripts/arduino_build.sh [server-host]
#   server-host defaults to BRANCH_TO_HOST lookup on current git branch

set -e
cd "$(dirname "$0")/.."

SERVER=${1:-}
if [ -z "$SERVER" ]; then
  BRANCH=$(git rev-parse --abbrev-ref HEAD)
  case "$BRANCH" in
    staging) SERVER="staging.lumatron.art" ;;
    *)       SERVER="my.lumatron.art" ;;
  esac
fi

MASTERKEY=$(cat masterkey.txt 2>/dev/null || echo "")
if [ -z "$MASTERKEY" ]; then
  echo "Error: masterkey.txt not found" >&2
  exit 1
fi

echo "Regenerating portal HTML header..."
python3 scripts/gen_portal_header.py

VERSION=$(git rev-list --count HEAD -- arduino/esp32/)
echo "Building firmware version $VERSION for $SERVER..."

BUILD_DIR=$(mktemp -d)
trap "rm -rf $BUILD_DIR" EXIT

CHIPS=("esp32c3" "esp32c6")
FQBNS=("esp32:esp32:esp32c3:PartitionScheme=min_spiffs" "esp32:esp32:esp32c6:PartitionScheme=min_spiffs")

for i in "${!CHIPS[@]}"; do
  CHIP="${CHIPS[$i]}"
  FQBN="${FQBNS[$i]}"
  CHIP_BUILD_DIR="$BUILD_DIR/$CHIP"
  mkdir -p "$CHIP_BUILD_DIR"

  echo "Compiling for $CHIP ($FQBN)..."
  arduino-cli compile \
    --fqbn "$FQBN" \
    --build-property "build.extra_flags=-DFIRMWARE_VERSION_NUM=$VERSION -DESP32" \
    --output-dir "$CHIP_BUILD_DIR" \
    arduino/esp32

  CURL_ERR_FILE=$(mktemp)
  echo "Uploading $CHIP firmware to https://$SERVER/firmware/upload..."
  RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
    "https://$SERVER/firmware/upload?chip=$CHIP&version=$VERSION&key=$(printf '%s%s' "$VERSION" "$MASTERKEY" | openssl dgst -sha256 -hex | awk '{print $2}')" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$CHIP_BUILD_DIR/esp32.ino.bin" 2>"$CURL_ERR_FILE") || { echo "Upload failed for $CHIP: $(cat $CURL_ERR_FILE)" >&2; rm -f "$CURL_ERR_FILE"; exit 1; }
  rm -f "$CURL_ERR_FILE"

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -1)

  if [ "$HTTP_CODE" = "200" ]; then
    echo "$CHIP firmware version $VERSION uploaded successfully."
  else
    echo "Upload failed for $CHIP (HTTP $HTTP_CODE): $BODY" >&2
    exit 1
  fi
done

echo "All chips uploaded. Arduino orbs will OTA within ~2 minutes."
