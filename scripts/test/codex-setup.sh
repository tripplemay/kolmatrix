#!/usr/bin/env bash
# Codex 测试环境启动脚本（前台运行于持久 PTY）
#
# 步骤：
#   1. npm ci（同步 node_modules + postinstall prisma generate）
#   2. docker compose up -d → PG16 + Redis7 healthcheck
#   3. 等待 PG 可连
#   4. prisma migrate deploy + db seed（幂等）
#   5. 前台启动 Next.js dev 在端口 3099（AGENTS.md 规范端口）
#
# 用法（在持久 PTY session 中前台执行）：
#   bash scripts/test/codex-setup.sh
# 然后另开一个 shell 执行：
#   bash scripts/test/codex-wait.sh
#
# 环境要求：Docker daemon 运行中；.env 已 cp 自 .env.example。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

if [ ! -f .env ]; then
  echo "[codex-setup] .env 不存在，从 .env.example 复制"
  cp .env.example .env
fi

# Sanitize stale NEXTAUTH_URL / AUTH_URL from pre-existing .env files.
#
# Earlier revisions of .env.example shipped `NEXTAUTH_URL="http://localhost:3000"`
# uncommented. Evaluator environments that ran codex-setup on those revisions
# already have an .env copied with that value, and the `if [ ! -f .env ]`
# guard above means a later template change (commenting NEXTAUTH_URL out)
# never propagates to the stale .env. The leftover value makes next-auth's
# reqWithEnvURL() rewrite every request origin to localhost:3000, so /login
# redirects emit `Location: http://localhost:3000/...` even when the dev
# server binds to :3099 — which breaks the Codex L1 flow end to end.
#
# Commenting (not deleting) keeps the line visible for operators who
# genuinely need a fixed URL in production; they can uncomment in a
# separate .env.production file. This sanitize runs every setup so drift
# can't sneak back in.
if [ -f .env ] && grep -qE '^[[:space:]]*(NEXTAUTH_URL|AUTH_URL)=' .env; then
  echo "[codex-setup] 检测到 .env 中存在未注释的 NEXTAUTH_URL/AUTH_URL，已自动注释以恢复 :3099 流程"
  # Delimiter must not be `|` — the pattern uses `|` as ERE alternation,
  # and `#` is reserved here since that's the character we're adding.
  sed -i -E 's@^([[:space:]]*)(NEXTAUTH_URL|AUTH_URL)=@\1# \2=@' .env
fi

# Dependency sync: must run before prisma/dev because
# (1) new runtime deps like `resend` can land in package.json between
#     Evaluator runs and the old node_modules won't have them, and
# (2) `postinstall: prisma generate` regenerates @prisma/client against
#     prisma/schema.prisma — new models (e.g. AccessRequest) are only
#     visible on the client after this step, otherwise
#     `prisma.accessRequest` is undefined at runtime.
echo "[codex-setup] npm ci（同步 deps + prisma generate via postinstall）"
npm ci --no-audit --no-fund

echo "[codex-setup] docker compose up -d (PG16 + Redis7)"
docker compose up -d

echo "[codex-setup] 等待 postgres 健康..."
ATTEMPTS=0
until docker compose ps --format json postgres 2>/dev/null | grep -q '"Health":"healthy"' \
  || docker compose exec -T postgres pg_isready -U postgres >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [ "$ATTEMPTS" -ge 30 ]; then
    echo "[codex-setup] postgres 30s 内未就绪，请检查 docker compose logs postgres"
    exit 1
  fi
  sleep 1
done
echo "[codex-setup] postgres 就绪 ✓"

echo "[codex-setup] prisma migrate deploy"
npx prisma migrate deploy

echo "[codex-setup] prisma db seed (idempotent)"
npm run db:seed

echo "[codex-setup] 启动 Next.js dev on port 3099"
# Belt-and-suspenders: even if a stale shell export leaked NEXTAUTH_URL /
# AUTH_URL into the process env (the .env sanitize above only cleans the
# file), explicitly unset them so next-auth doesn't rewrite the origin.
unset NEXTAUTH_URL AUTH_URL
PORT=3099 exec npm run dev
