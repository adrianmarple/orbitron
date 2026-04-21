#!/usr/bin/env bash
# Build Arduino firmware locally and upload to relay server.
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

arduino-cli compile \
  --fqbn esp32:esp32:esp32c3:PartitionScheme=min_spiffs \
  --build-property "build.extra_flags=-DFIRMWARE_VERSION_NUM=$VERSION -DESP32" \
  --output-dir "$BUILD_DIR" \
  arduino/esp32

CURL_ERR_FILE=$(mktemp)
trap "rm -rf $BUILD_DIR $CURL_ERR_FILE" EXIT

echo "Uploading to https://$SERVER/firmware/upload..."
RESPONSE=$(curl -sS -w "\n%{http_code}" -X POST \
  "https://$SERVER/firmware/upload?version=$VERSION&key=$(printf '%s%s' "$VERSION" "$MASTERKEY" | openssl dgst -sha256 -hex | awk '{print $2}')" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @"$BUILD_DIR/esp32.ino.bin" 2>"$CURL_ERR_FILE") || { echo "Upload failed: $(cat $CURL_ERR_FILE)" >&2; exit 1; }

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
  echo "Firmware version $VERSION uploaded successfully."
  echo "Arduino orbs will OTA within ~2 minutes."
else
  echo "Upload failed (HTTP $HTTP_CODE): $BODY" >&2
  exit 1
fi
