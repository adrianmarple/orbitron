#!/bin/bash

# Made by ChatGPT

# Calculate the total number of lines in .js and .py files, excluding node_modules
total_lines=$(find . -type d -name node_module -prune -o \( -name "*.js" -o -name "*.py" \) -type f -print0 | xargs -0 wc -l | awk '{total += $1} END {print total}')

echo "Total number of lines in .js and .py files (excluding node_modules): $total_lines"