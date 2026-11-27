#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$REPO_ROOT"

PORT_GOOD=8901
PORT_BAD=8902

PID_GOOD=""
PID_BAD=""

cleanup() {
  if [ -n "$PID_GOOD" ]; then kill "$PID_GOOD" 2>/dev/null || true; fi
  if [ -n "$PID_BAD" ]; then kill "$PID_BAD" 2>/dev/null || true; fi
}
trap cleanup EXIT INT TERM

echo "Starting Good Mock Server on port $PORT_GOOD..."
python3 scripts/tests/mock_api_server.py --port "$PORT_GOOD" --mode good &
PID_GOOD=$!
sleep 1

echo "Testing verify_live.sh against Good Mock Server with cross-origin WEB_URL (must succeed with exit code 0)..."
API_URL="http://127.0.0.1:$PORT_GOOD" WEB_URL="http://127.0.0.1:8903" API_ONLY=1 TEST_USER_TOKEN="mock-token-xyz" bash scripts/verify_live.sh
echo "Good mock verification passed!"

kill "$PID_GOOD" 2>/dev/null || true
PID_GOOD=""
sleep 1

echo "Starting Bad Mock Server on port $PORT_BAD..."
python3 scripts/tests/mock_api_server.py --port "$PORT_BAD" --mode bad &
PID_BAD=$!
sleep 1

echo "Testing verify_live.sh against Bad Mock Server (must fail with non-zero exit code)..."
set +e
API_URL="http://127.0.0.1:$PORT_BAD" WEB_URL="http://127.0.0.1:8903" API_ONLY=1 bash scripts/verify_live.sh
BAD_EXIT=$?
set -e

if [ "$BAD_EXIT" -eq 0 ]; then
  echo "ERROR: verify_live.sh unexpectedly passed against bad mock server!"
  exit 1
fi

echo "Bad mock correctly triggered non-zero exit code: $BAD_EXIT"
echo "All verify_live test scenarios passed successfully."
