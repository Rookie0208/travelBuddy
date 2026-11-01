#!/bin/bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$DIR/backend"

echo "Stopping TripSplit services..."

# Kill backend if running on 8080
PID_8080=$(lsof -ti :8080 2>/dev/null || true)
if [ -n "$PID_8080" ]; then
    echo "Stopping backend on port 8080 (PID: $PID_8080)..."
    kill -9 $PID_8080 2>/dev/null || true
fi

# Kill expo if running on 8081
PID_8081=$(lsof -ti :8081 2>/dev/null || true)
if [ -n "$PID_8081" ]; then
    echo "Stopping Expo on port 8081 (PID: $PID_8081)..."
    kill -9 $PID_8081 2>/dev/null || true
fi

# Stop Docker DB
echo "Stopping database container..."
cd "$BACKEND_DIR"
docker compose down

echo "All TripSplit services stopped."

