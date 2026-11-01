#!/bin/bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$DIR/backend"
MOBILE_DIR="$DIR/mobile"

echo "=========================================="
echo "    Starting TripSplit Platform"
echo "=========================================="

# 1. Start Database Container
echo "[1/3] Starting PostgreSQL via Docker..."
cd "$BACKEND_DIR"
docker compose up db -d

# Wait for DB to be healthy
echo "Waiting for database to be ready..."
until docker compose exec -T db pg_isready -U tripsplit -d tripsplit > /dev/null 2>&1; do
    sleep 1
done
echo "Database is ready!"

# 2. Check and Start Backend
echo "[2/3] Starting Spring Boot Backend API..."
if lsof -i :8080 > /dev/null 2>&1; then
    echo "Backend is already running on port 8080."
else
    nohup ./mvnw spring-boot:run > backend.log 2>&1 &
    BACKEND_PID=$!
    echo "Backend started in background (PID: $BACKEND_PID, logs: backend/backend.log)"
    
    echo "Waiting for backend health check..."
    for i in {1..30}; do
        if curl -s http://localhost:8080/actuator/health | grep -q '"status":"UP"'; then
            echo "Backend is UP and healthy on http://localhost:8080"
            break
        fi
        sleep 1
    done
fi

# 3. Start Mobile App
echo "[3/3] Starting Expo Mobile..."
cd "$MOBILE_DIR"
echo "To run the mobile app:"
echo "  - In browser:     npm run web"
echo "  - In Android emu: npm run android"
echo "  - In iOS sim:     npm run ios"
echo "  - Expo dev menu:  npm start"
echo ""
echo "Starting Expo dev server in background (logs: mobile/expo.log)..."
nohup npx expo start --web > expo.log 2>&1 &
EXPO_PID=$!
echo "Expo dev server started (PID: $EXPO_PID, Web URL: http://localhost:8081)"
echo ""
echo "=========================================="
echo "TripSplit is running!"
echo "Backend: http://localhost:8080/api/v1"
echo "Web App: http://localhost:8081"
echo "=========================================="

