#!/usr/bin/env bash
# CI gate: type-check then run unit tests.
# Run from anywhere; we cd into the memoria-app directory ourselves.
# Make executable once with: chmod +x scripts/check.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

echo "▶ Type-checking…"
npx tsc --noEmit

echo "▶ Running unit tests…"
npm test
