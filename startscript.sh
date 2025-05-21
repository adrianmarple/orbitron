#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
echo "Staring Orbitron"
EXTERNAL_WIFI_CHECK=$SCRIPT_DIR/external_wifi_check.js
GIT_UPDATE=$SCRIPT_DIR/gitupdate.js
EXTERNAL_BOARD_UPDATE=$SCRIPT_DIR/external_board_update.js
MAIN=$SCRIPT_DIR/main.js
if [ $(whoami) = 'root' ]; then
  node $GIT_UPDATE
  node $EXTERNAL_WIFI_CHECK
  node $EXTERNAL_BOARD_UPDATE
  node $MAIN
else
  sudo node $GIT_UPDATE
  sudo node $EXTERNAL_WIFI_CHECK
  sudo node $EXTERNAL_BOARD_UPDATE
  sudo node $MAIN
fi