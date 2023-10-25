#!/bin/bash
echo "Staring server"
if [ $(whoami) = 'root' ]; then
  node gitupdate.js
	node server.js
else
  sudo node gitupdate.js
  sudo node server.js
fi