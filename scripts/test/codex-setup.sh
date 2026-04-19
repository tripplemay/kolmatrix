#!/usr/bin/env bash
# Codex 测试环境启动脚本（前台运行于持久 PTY）
#
# 步骤：
#   1. docker compose up -d → PG16 + Redis7 healthcheck
#   2. 等待 PG 可连
#   3. prisma migrate deploy + db seed（幂等）
#   4. 前台启动 Next.js dev 在端口 3099（AGENTS.md 规范端口）
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
PORT=3099 exec npm run dev
