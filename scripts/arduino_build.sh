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

KEY=$(printf '%s%s' "$VERSION" "$MASTERKEY" | openssl dgst -sha256 -hex | awk '{print $2}')

# upload_bin <file> <chip> <label> [part]
# Posts a binary to the relay. With no <part> this is the app image, which bumps
# the stored version and notifies orbs to OTA; with a <part> it is a support
# image for the web flasher and carries no version.
upload_bin() {
  local file="$1"
  local chip="$2"
  local label="$3"
  local part="${4:-}"
  local url="https://$SERVER/firmware/upload?chip=$chip&version=$VERSION&key=$KEY"
  if [ -n "$part" ]; then
    url="$url&part=$part"
  fi

  if [ ! -f "$file" ]; then
    echo "Missing build artifact: $file" >&2
    exit 1
  fi

  local err_file
  err_file=$(mktemp)
  echo "Uploading $chip $label..."
  local response
  response=$(curl -sS -w "\n%{http_code}" -X POST "$url" \
    -H "Content-Type: application/octet-stream" \
    --data-binary @"$file" 2>"$err_file") || {
      echo "Upload failed for $chip $label: $(cat "$err_file")" >&2
      rm -f "$err_file"
      exit 1
    }
  rm -f "$err_file"

  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | head -1)

  if [ "$http_code" = "200" ]; then
    echo "  $chip $label uploaded."
  else
    echo "Upload failed for $chip $label (HTTP $http_code): $body" >&2
    exit 1
  fi
}

CHIPS=("esp32s3" "esp32c6" "esp32c3")
FQBNS=("esp32:esp32:esp32s3:PartitionScheme=custom,CDCOnBoot=cdc,PSRAM=opi" "esp32:esp32:esp32c6:PartitionScheme=custom,CDCOnBoot=cdc" "esp32:esp32:esp32c3:PartitionScheme=custom,CDCOnBoot=cdc")

for i in "${!CHIPS[@]}"; do
  CHIP="${CHIPS[$i]}"
  FQBN="${FQBNS[$i]}"
  CHIP_BUILD_DIR="$BUILD_DIR/$CHIP"
  mkdir -p "$CHIP_BUILD_DIR"

  echo "Compiling for $CHIP ($FQBN)..."
  arduino-cli compile \
    --fqbn "$FQBN" \
    --build-property "compiler.cpp.extra_flags=-DFIRMWARE_VERSION_NUM=$VERSION" \
    --build-property "build.partitions=partitions" \
    --build-property "upload.maximum_size=1769472" \
    --output-dir "$CHIP_BUILD_DIR" \
    arduino/esp32

  # boot_app0 is a fixed image shipped with the ESP32 core rather than a build
  # output; arduino-cli normally copies it alongside the binaries, but fall back
  # to the core's own copy if it doesn't.
  BOOT_APP0="$CHIP_BUILD_DIR/boot_app0.bin"
  if [ ! -f "$BOOT_APP0" ]; then
    BOOT_APP0=$(ls "$HOME"/Library/Arduino15/packages/esp32/hardware/esp32/*/tools/partitions/boot_app0.bin 2>/dev/null | tail -1)
    if [ -z "$BOOT_APP0" ]; then
      BOOT_APP0=$(ls "$HOME"/.arduino15/packages/esp32/hardware/esp32/*/tools/partitions/boot_app0.bin 2>/dev/null | tail -1)
    fi
  fi

  # Support images first — the app upload is what bumps the version and tells
  # orbs to OTA, so it goes last to avoid advertising a version whose flasher
  # artifacts aren't in place yet.
  upload_bin "$CHIP_BUILD_DIR/esp32.ino.bootloader.bin" "$CHIP" "bootloader" "bootloader"
  upload_bin "$CHIP_BUILD_DIR/esp32.ino.partitions.bin" "$CHIP" "partition table" "partitions"
  upload_bin "$BOOT_APP0" "$CHIP" "boot_app0" "bootapp0"
  upload_bin "$CHIP_BUILD_DIR/esp32.ino.bin" "$CHIP" "app version $VERSION"
done

echo "All chips uploaded. Arduino orbs will OTA within ~2 minutes."
