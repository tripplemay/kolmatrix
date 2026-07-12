#!/bin/sh
# BL-PROD-MIGRATE-DEPLOYSVR F-MIG-01 — 一次性 migrate 服务入口（容器模型下替代旧机
# deploy-prod.sh 的 `prisma migrate deploy` + sudo ALTER ROLE 两步）。
#
# 在 migrate 镜像（FROM base，含全量 node_modules + prisma CLI）内运行：
#   1. prisma migrate deploy — 应用 pending 迁移（含 RLS policy + 授权 kolmatrix_app）。
#      以 DATABASE_ADMIN_URL(superuser) 连接（prisma.config.ts 的 datasource）；幂等：
#      已还原生产快照的库为 no-op。
#   2. ALTER ROLE kolmatrix_app 密码同步（H1 / BL-043 五处一致）：pg 容器首次 init 已建角色，
#      但后续部署密码轮换需在此兜底。用 `prisma db execute` 免依赖 psql 客户端。
set -eu

echo "── migrate: prisma migrate deploy"
npx prisma migrate deploy

if [ -n "${KOLMATRIX_APP_PASSWORD:-}" ] && [ -n "${DATABASE_ADMIN_URL:-}" ]; then
  echo "── migrate: 同步 kolmatrix_app 角色密码（幂等，H1/BL-043）"
  printf "ALTER ROLE kolmatrix_app WITH PASSWORD '%s';" "$KOLMATRIX_APP_PASSWORD" \
    | npx prisma db execute --url "$DATABASE_ADMIN_URL" --stdin
  echo "   ✓ kolmatrix_app 密码已与 .env 同步"
else
  echo "   ⚠️  KOLMATRIX_APP_PASSWORD 或 DATABASE_ADMIN_URL 未设，跳过角色密码同步" >&2
  echo "      （首次 init 已由 deploy/postgres/init/00-init.sh 落地密码；仅轮换场景需要此步）" >&2
fi

echo "✅ migrate 完成"
