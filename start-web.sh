#!/bin/bash
cd "$(dirname "$0")/web"

if [ ! -d "node_modules" ]; then
  echo "[web] Installing dependencies..."
  npm install
fi

API_URL=$(grep "VITE_API_URL" .env.local 2>/dev/null | cut -d= -f2)
if [ -z "$API_URL" ]; then
  echo "[web] API URL: http://localhost:3000 (default)"
elif echo "$API_URL" | grep -q "localhost"; then
  echo "[web] API URL: $API_URL (local)"
else
  echo "[web] WARNING: API URL is set to $API_URL (production)"
  echo "[web] To use your local API instead, set VITE_API_URL=http://localhost:3000 in web/.env.local"
fi

npm run dev
