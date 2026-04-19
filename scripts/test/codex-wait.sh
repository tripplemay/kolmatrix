#!/usr/bin/env bash
# Codex 测试就绪等待脚本
#
# 轮询 /login 直到 HTTP 200（说明 Next.js dev server + middleware 就绪）。
# 最多等 60 秒，超时退出 1。
#
# 用法：
#   bash scripts/test/codex-wait.sh

set -euo pipefail

PORT="${CODEX_PORT:-3099}"
URL="http://localhost:${PORT}/login"
MAX_ATTEMPTS=60

for i in $(seq 1 $MAX_ATTEMPTS); do
  code=$(curl -sS -o /dev/null -w "%{http_code}" --noproxy '*' "$URL" 2>/dev/null || echo "000")
  if [ "$code" = "200" ]; then
    echo "[codex-wait] Next.js ready at $URL ($code) after ${i}s"
    exit 0
  fi
  sleep 1
done

echo "[codex-wait] TIMEOUT — $URL never returned 200 within ${MAX_ATTEMPTS}s"
exit 1
