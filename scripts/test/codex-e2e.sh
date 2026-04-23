#!/usr/bin/env bash
# Playwright E2E wrapper for Codex L1 flow.
#
# Why this wrapper exists:
#   - Codex setup starts Next on port 3099 (AGENTS.md §3), but
#     `npm run test:e2e` defaults to port 3000 — so without env, Playwright
#     probes the wrong URL, fails, then tries to spawn a second dev server
#     and trips Next 16's single-instance lock ("Another next dev server
#     is already running").
#   - Even with E2E_PORT=3099 set, any stray NEXTAUTH_URL / AUTH_URL export
#     causes next-auth's reqWithEnvURL() to rewrite redirect Location
#     headers to a different origin, which makes Playwright's
#     reuseExistingServer probe fail on the redirect chain.
#   - Proxy env (all_proxy/http_proxy/https_proxy) in Codex sandboxes has
#     historically produced 502s on localhost traffic; Evaluator runbook
#     already strips them manually, encode that here.
#
# Usage (run AFTER codex-setup.sh + codex-wait.sh reported ready):
#   bash scripts/test/codex-e2e.sh                        # full suite
#   bash scripts/test/codex-e2e.sh tests/e2e/login-cinematic.spec.ts
#   bash scripts/test/codex-e2e.sh --grep "Google button"
#
# Any arguments are forwarded to `playwright test`.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

# 1) Strip proxies — they 502 localhost in Codex sandboxes.
unset all_proxy http_proxy https_proxy ALL_PROXY HTTP_PROXY HTTPS_PROXY

# 2) Clear NEXTAUTH_URL / AUTH_URL so next-auth's reqWithEnvURL() doesn't
#    rewrite /login redirect origins into localhost:3000.
unset NEXTAUTH_URL AUTH_URL

# 3) Point Playwright at the port codex-setup.sh uses for Next dev.
export E2E_PORT="${E2E_PORT:-3099}"
export E2E_BASE_URL="${E2E_BASE_URL:-http://localhost:${E2E_PORT}}"

echo "[codex-e2e] E2E_BASE_URL=${E2E_BASE_URL}"
echo "[codex-e2e] forwarding args: $*"

exec npx playwright test "$@"
