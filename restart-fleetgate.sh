#!/bin/bash
# ============================================================
# FleetGate - Restart Script
# Run this whenever you want to restart the server + tunnel
# Usage: bash /Users/udhaya/.gemini/antigravity/scratch/lorry-track-pro/restart-fleetgate.sh
# ============================================================

echo "🔄 Restarting FleetGate..."

launchctl unload /Users/udhaya/Library/LaunchAgents/com.fleetgate.server.plist 2>/dev/null
launchctl unload /Users/udhaya/Library/LaunchAgents/com.fleetgate.tunnel.plist 2>/dev/null

sleep 2

# Kill any stray processes
lsof -ti:5173 | xargs kill -9 2>/dev/null
lsof -ti:3000  | xargs kill -9 2>/dev/null
lsof -ti:8080  | xargs kill -9 2>/dev/null

sleep 1

launchctl load /Users/udhaya/Library/LaunchAgents/com.fleetgate.server.plist
sleep 5
launchctl load /Users/udhaya/Library/LaunchAgents/com.fleetgate.tunnel.plist

sleep 10

LOCAL_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
TUNNEL_URL=$(grep -o "https://[a-zA-Z0-9-]*\.trycloudflare\.com" /Users/udhaya/.gemini/antigravity/scratch/lorry-track-pro/logs/tunnel.log 2>/dev/null | tail -1)

echo ""
echo "✅ FleetGate restarted!"
echo ""
echo "📱 Access URLs:"
echo "   Local WiFi  : http://$LOCAL_IP:5173"
echo "   Cloud (any) : $TUNNEL_URL"
echo ""
echo "🔍 To check status: launchctl list | grep fleetgate"
