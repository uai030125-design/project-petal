#!/bin/bash
# Double-click this file in Finder to restart the server
cd "$(dirname "$0")"
echo "Stopping existing server..."
pkill -f "node server/index.js" 2>/dev/null || pkill -f "node index.js" 2>/dev/null || true
sleep 1
echo "Starting server..."
cd server
node index.js
