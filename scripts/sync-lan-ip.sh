#!/bin/bash
# Detects this Mac's current LAN IP and rewrites every .env file that hardcodes
# it (API_PUBLIC_URL, EXPO_PUBLIC_API_BASE_URL) so LAN-based Expo Go / API
# testing keeps working after the IP changes (new WiFi, DHCP renewal, etc.).
# Run this before starting the API server and Expo dev servers for a testing
# session; restart any already-running servers afterward so they pick it up.
set -euo pipefail

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "Could not detect a LAN IP (no active en0/en1 interface). Aborting." >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FILES=(
  "$ROOT/apps/api/.env"
  "$ROOT/apps/mobile-donor/.env"
  "$ROOT/apps/mobile-institution/.env"
)

for FILE in "${FILES[@]}"; do
  [ -f "$FILE" ] || continue
  sed -i '' -E "s#(API_PUBLIC_URL|EXPO_PUBLIC_API_BASE_URL)=http://[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+:#\1=http://${IP}:#" "$FILE"
  echo "Updated: $FILE"
done

echo "LAN IP synced to $IP. Restart any running API/Expo dev servers to pick this up."
