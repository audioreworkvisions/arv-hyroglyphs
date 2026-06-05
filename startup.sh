#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="${APP_ROOT:-$(pwd)}"
PORT_VALUE="${PORT:-8080}"

cd "$APP_ROOT"

if [ ! -d node_modules ]; then
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
fi

AVAILABLE_SCRIPTS="$(npm run 2>/dev/null || true)"

if printf '%s' "$AVAILABLE_SCRIPTS" | grep -qE '(^|[[:space:]])build($|[[:space:]])'; then
  npm run build
fi

if printf '%s' "$AVAILABLE_SCRIPTS" | grep -qE '(^|[[:space:]])start:prod($|[[:space:]])'; then
  exec npm run start:prod
fi

if printf '%s' "$AVAILABLE_SCRIPTS" | grep -qE '(^|[[:space:]])start($|[[:space:]])'; then
  exec npm run start
fi

if printf '%s' "$AVAILABLE_SCRIPTS" | grep -qE '(^|[[:space:]])preview($|[[:space:]])'; then
  exec npm run preview -- --host 0.0.0.0 --port "$PORT_VALUE"
fi

exec npx --yes tsx server.ts