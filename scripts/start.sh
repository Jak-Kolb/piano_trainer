#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "Building Keys…"
npm run build
echo ""
echo "Keys is serving at: http://127.0.0.1:5173/"
echo "Open that URL in Chrome (not Safari)."
npm run preview -- --host 127.0.0.1 --port 5173
