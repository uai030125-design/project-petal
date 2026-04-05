#!/bin/bash
cd "$(dirname "$0")"
# Kill existing node server
pkill -f "node index.js" 2>/dev/null || true
sleep 1
# Start new server
cd server
nohup node index.js > ../server.log 2>&1 &
echo "Server restarted (PID: $!)"
