#!/usr/bin/env bash
# Codex 测试就绪等待脚本
#
# 轮询 /login 直到 Next.js dev server + middleware 就绪。
#
# 协议：next-intl 的 locale middleware 把根 `/login` 重定向到默认 locale
# 前缀 `/en/login`，所以一个就绪的 dev server 在 GET /login 时返回
# 307 + Location: /en/login，而 GET /en/login 才返回 200。
#
# 之前版本只等 200 → 在 locale middleware 接入后会一直 false-fail（参见
# verifying-2026-04-26 BM2-HARNESS-004）。修复：把 307 当作"就绪"信号，
# 同时也接受 200（保持向后兼容，本机 root path 直返 200 的旧 build 不
# 会因升级脚本被锁死）。
#
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
  case "$code" in
    200|301|302|303|307|308)
      echo "[codex-wait] Next.js ready at $URL ($code) after ${i}s"
      exit 0
      ;;
  esac
  sleep 1
done

echo "[codex-wait] TIMEOUT — $URL never returned 2xx/3xx within ${MAX_ATTEMPTS}s"
exit 1
