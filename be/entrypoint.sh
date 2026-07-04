#!/usr/bin/env bash
# Boots a local Canton sandbox (waits until the DAR is vetted) then starts the BE — UNLESS
# JSON_LEDGER_API points at an external ledger (e.g. 5N DevNet), in which case the embedded
# sandbox is skipped entirely (no wasted boot/RAM) and the BE talks straight to that ledger.
set -uo pipefail

PKG="${NELVA_PACKAGE_ID:?NELVA_PACKAGE_ID required}"
LEDGER_PORT=7575
LEDGER_URL="${JSON_LEDGER_API:-http://localhost:${LEDGER_PORT}}"

case "${LEDGER_URL}" in
  *localhost*|*127.0.0.1*)
    echo "[nelva] local ledger (${LEDGER_URL}) — starting embedded Canton sandbox..."
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
    ;;
  *)
    echo "[nelva] external ledger (${LEDGER_URL}) — skipping embedded sandbox."
    echo "[nelva] verifying package ${PKG} is vetted on the external ledger..."
    # best-effort check (external ledger may require auth for /v2/packages; don't block boot)
    if curl -s "${LEDGER_URL}/v2/packages" 2>/dev/null | grep -q "${PKG}"; then
      echo "[nelva] package confirmed vetted on external ledger."
    else
      echo "[nelva] NOTE: could not confirm package via unauthenticated /v2/packages (auth-gated is normal) — continuing."
    fi
    ;;
esac

echo "[nelva] starting backend on :${PORT:-8090}..."
exec npm start
