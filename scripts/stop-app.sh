#!/bin/bash
# scripts/stop-app.sh

echo "Stopping application processes on ports 3001 and 5173..."
PID_LIST=$(lsof -ti:3001,5173)

if [ -z "$PID_LIST" ]; then
    echo "No processes found on ports 3001 or 5173."
else
    echo "Killing processes: $PID_LIST"
    echo "$PID_LIST" | xargs kill -9
    echo "App stopped."
fi
