#!/bin/sh
set -eu

cd /app/TestForge
node dist/index.js &
backend_pid=$!

cleanup() {
  kill "$backend_pid" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cd /app/Dashboard
exec streamlit run app.py \
  --server.address 0.0.0.0 \
  --server.port 8501 \
  --server.fileWatcherType none \
  --browser.gatherUsageStats false

