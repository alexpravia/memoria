#!/bin/sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: scripts/maestro-ios.sh <flow-or-dir> [maestro args...]" >&2
  exit 1
fi

FLOW_TARGET="$1"
shift || true

export PATH="$PATH:$HOME/.maestro/bin"
EXPO_URL="${EXPO_URL:-exp://127.0.0.1:8081}"
DEVICE_ID="${MAESTRO_DEVICE_ID:-$(xcrun simctl list devices booted | awk -F '[()]' '/Booted/{print $2; exit}')}"
DEVICE_ID=$(printf '%s' "$DEVICE_ID" | tr -d '[:space:]')

if [ -z "$DEVICE_ID" ]; then
  echo "No booted iOS simulator found. Boot a simulator first." >&2
  exit 1
fi

xcrun simctl terminate "$DEVICE_ID" host.exp.Exponent >/dev/null 2>&1 || true
xcrun simctl launch "$DEVICE_ID" host.exp.Exponent >/dev/null 2>&1 || true
xcrun simctl openurl "$DEVICE_ID" "$EXPO_URL"

exec maestro test "$FLOW_TARGET" \
  --udid "$DEVICE_ID" \
  --debug-output .maestro/debug \
  --test-output-dir .maestro/artifacts \
  "$@"
