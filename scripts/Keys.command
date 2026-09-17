#!/bin/bash
cd "$(dirname "$0")/.."
open -a "Google Chrome" "http://127.0.0.1:5173/" 2>/dev/null || true
exec ./scripts/start.sh
