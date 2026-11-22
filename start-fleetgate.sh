#!/bin/bash
# FleetGate Auto-Start Script
# This script starts the FleetGate server and Cloudflare tunnel.
# It is called by launchd on system boot.

PROJECT_DIR="/Users/udhaya/.gemini/antigravity/scratch/lorry-track-pro"
LOG_DIR="$PROJECT_DIR/logs"
NODE_PATH="$(which node)"

mkdir -p "$LOG_DIR"

# Kill any existing processes on our ports
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:8080 | xargs kill -9 2>/dev/null

sleep 1

# Start the server
cd "$PROJECT_DIR"
"$NODE_PATH" server.js >> "$LOG_DIR/server.log" 2>&1 &
SERVER_PID=$!
echo "[$(date)] FleetGate server started (PID: $SERVER_PID)" >> "$LOG_DIR/server.log"

# Wait for server to be ready
sleep 3

# Start Cloudflare tunnel
"$PROJECT_DIR/bin/cloudflared" tunnel --url http://127.0.0.1:5173 >> "$LOG_DIR/tunnel.log" 2>&1 &
TUNNEL_PID=$!
echo "[$(date)] Cloudflare tunnel started (PID: $TUNNEL_PID)" >> "$LOG_DIR/tunnel.log"

echo "[$(date)] FleetGate fully started. Server PID=$SERVER_PID, Tunnel PID=$TUNNEL_PID"
