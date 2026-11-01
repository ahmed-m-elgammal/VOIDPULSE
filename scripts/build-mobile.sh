#!/usr/bin/env bash
# VOIDPULSE mobile — build bundle + mirror into public/m/ (preview at /m/).
# Mobile source stays exclusively inside mobile/; this only copies artifacts.
set -euo pipefail
cd "$(dirname "$0")/.."

bun build mobile/src/main.ts --outfile mobile/dist/main.js
mkdir -p public/m/dist
cp mobile/index.html public/m/index.html
cp mobile/dist/main.js public/m/dist/main.js

echo "mobile build OK ($(du -k mobile/dist/main.js | cut -f1) KB) → serve at /m/"
