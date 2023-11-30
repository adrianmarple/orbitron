#!/bin/bash
echo "Staring server"
if [ $(whoami) = 'root' ]; then
  node gitupdate.js
	node main.js
else
  sudo node gitupdate.js
  sudo node external_baord_update.js
  sudo node main.js
fi