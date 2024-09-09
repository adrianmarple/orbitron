#!/bin/bash
# Made by help from ChatGPT

# Calculate the total number of lines in .js and .py files, excluding multiple directories
total_lines=$(find . \
    \( -path "*/node_modules" -o -path "*/thirdparty" -o -path "*/three.js"  \) -prune -o \
    -type f \( -name "*.js" -o -name "*.py"  -o -name "*.css"  -o -name "*.vue" -o -name "*.html"  \) -print0 | xargs -0 wc -l | \
    awk '{total += $1} END {print total}')

echo "Total number of lines of code: $total_lines"