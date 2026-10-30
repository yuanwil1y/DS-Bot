#!/bin/sh
# Local DSH web + ds-bot (packed 0.2.4-mobile.1) + mock LLM. No real API key.
#   run-local.sh [start|stop]   env: WEB_PORT (3097) MOCK_PORT (8797) DSH_HOME (/tmp/dsh-mobile)
set -eu
export PATH=/tmp/node-v24.22.2-linux-x64/bin:$PATH COREPACK_HOME=/tmp/corepack
H=${DSH_HOME:-/tmp/dsh-mobile}; WEB=${WEB_PORT:-3097}; MOCK=${MOCK_PORT:-8797}
DSH=/workspace/dsh; PLUGIN=/tmp/rb2/ds-bot; TGZ=/workspace/dsbot-mobile/ds-bot-0.2.4-mobile.1.tgz
stop() { for n in web mock; do [ -f "$H/$n.pid" ] && { kill -TERM -"$(cat "$H/$n.pid")" 2>/dev/null || true; rm -f "$H/$n.pid"; }; done; echo stopped; }
[ "${1:-start}" = stop ] && { stop; exit 0; }
P="$H/profiles/web"; mkdir -p "$P"
if [ ! -d "$P/node_modules/ds-bot" ]; then
  printf '{"name":"dsh-profile-web","private":true,"dependencies":{"ds-bot":"file:%s"},"dsh":{"profile":{"bundles":["@deepseek-ai/dsh-base","@deepseek-ai/dsh-web-app","ds-bot"]}}}\n' "$TGZ" > "$P/package.json"
  printf 'packages:\n  - .\n\nnodeLinker: hoisted\nautoInstallPeers: false\n' > "$P/pnpm-workspace.yaml"
  (cd "$P" && DSH_HOME="$H" pnpm install >/dev/null)
fi
(cd "$PLUGIN" && MOCK_PORT=$MOCK MOCK_DELAY_MS=${MOCK_DELAY_MS:-200} MOCK_LOG="$H/mock.jsonl" exec setsid sh -c 'echo $$ >"$1"; shift; exec "$@"' sh "$H/mock.pid" node dev/mock-llm.mjs "$H") </dev/null >"$H/mock.out" 2>&1 &
(cd "$DSH" && DSH_HOME="$H" DEEPSEEK_BASE_URL="http://127.0.0.1:$MOCK/v1" DEEPSEEK_API_KEY=mock-key exec setsid sh -c 'echo $$ >"$1"; shift; exec "$@"' sh "$H/web.pid" pnpm -s dsh --profile web --no-open --port "$WEB") </dev/null >"$H/web.log" 2>&1 &
i=0; until grep -q "dsh web: http" "$H/web.log" 2>/dev/null; do i=$((i+1)); [ $i -gt 180 ] && { echo "start failed, see $H/web.log"; exit 1; }; sleep 1; done
grep -o "http://127.0.0.1:$WEB/?token=[^ ]*" "$H/web.log" | tail -1
