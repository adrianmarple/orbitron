#!/bin/bash

echo "Running git"
git config pull.ff only
git pull
echo "Staring server"
sudo node server.js
