#!/bin/bash
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
NODE_HEAP_MB=256  # Cap V8 old-space heap to keep GC active; raise if you see out-of-memory crashes
echo "Starting Lumatron"
GIT_UPDATE=$SCRIPT_DIR/gitupdate.js
MAIN=$SCRIPT_DIR/main.js
if [ $(whoami) = 'root' ]; then
  node $GIT_UPDATE
  node --max-old-space-size=$NODE_HEAP_MB $MAIN
else
  sudo node $GIT_UPDATE
  sudo node --max-old-space-size=$NODE_HEAP_MB $MAIN
fi