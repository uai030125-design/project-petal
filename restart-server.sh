#!/bin/bash
# Restart the Unlimited Avenues server (port 4000)
# Run this from ANYWHERE — it finds its own location automatically.

APP_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Stopping any process on port 4000..."
lsof -ti:4000 | xargs kill -9 2>/dev/null
sleep 1

echo "Starting server from: $APP_DIR/server"
cd "$APP_DIR" && node server/index.js > /tmp/ua-server.log 2>&1 &

sleep 2

STATUS=$(curl -s http://localhost:4000/api/health 2>/dev/null)
if [ -n "$STATUS" ]; then
  echo "✅ Server is up: $STATUS"
else
  echo "❌ Server failed to start. Check /tmp/ua-server.log"
  tail -20 /tmp/ua-server.log
fi
