#!/usr/bin/env bash
# Boots the Canton sandbox, waits until the DAR is vetted, then starts the BE.
set -uo pipefail

PKG="${NELVA_PACKAGE_ID:?NELVA_PACKAGE_ID required}"
LEDGER_PORT=7575

echo "[nelva] starting Canton sandbox..."
dpm sandbox --json-api-port "${LEDGER_PORT}" --dar /app/nelva-sc-0.1.0.dar &

echo "[nelva] waiting for sandbox + DAR vetting..."
ready=0
for i in $(seq 1 240); do
  if curl -sf "http://localhost:${LEDGER_PORT}/livez" >/dev/null 2>&1 \
     && curl -s "http://localhost:${LEDGER_PORT}/v2/packages" | grep -q "${PKG}"; then
    echo "[nelva] sandbox ready + DAR vetted after ${i}s"
    ready=1
    break
  fi
  sleep 1
done
[ "${ready}" = "1" ] || echo "[nelva] WARN: sandbox not confirmed ready — starting BE anyway"

echo "[nelva] starting backend on :${PORT:-8090}..."
exec npm start
