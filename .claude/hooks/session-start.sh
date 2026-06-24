#!/bin/bash
# Claude Code on the web: ensure node_modules is installed before the
# session starts so vitest / tsc / playwright work without a first-run
# stall. Local dev sessions skip this (the user already has deps).
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "$CLAUDE_PROJECT_DIR"

# Idempotent: a second run with unchanged package-lock.json is a no-op.
# --no-audit / --no-fund cut install time and remove noise.
npm install --no-audit --no-fund
