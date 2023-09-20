#!/bin/bash
echo "Staring server"
if [ $(whoami) = 'root' ]; then
	node server.js
else
  sudo node server.js
fi