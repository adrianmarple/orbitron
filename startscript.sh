#!/bin/bash

echo "Running git"
git pull
echo "Staring server"
sudo node server.js
