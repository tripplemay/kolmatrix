#!/bin/bash
# BL-PROD-MIGRATE-DEPLOYSVR F-MIG-01 — postgres 容器首次初始化（H3 pgvector + H4 双角色）。
#
# docker-entrypoint-initdb.d/*.sh 仅在**数据卷为空的首次启动**执行一次。它保证：
#   1. pgvector 扩展就位（KOLMatrix embeddings / 语义搜索列依赖；plain postgres 镜像会缺）。
#   2. kolmatrix_app 应用角色**先于** migrate / pg_restore 存在——迁移 SQL 与旧库 dump 里的
#      GRANT / RLS policy 都指向该角色，角色不存在则失败（H4）。
#   3. 角色密码 = $KOLMATRIX_APP_PASSWORD（compose 从 .env 注入到本容器 env），落地 BL-043
#      五处一致协议里的「PG 实际 role 密码」。
#
# 注：后续部署的密码轮换由 migrate 服务的 ALTER ROLE 兜底（本脚本首次 init 后不再运行）。
set -euo pipefail

if [[ -z "${KOLMATRIX_APP_PASSWORD:-}" ]]; then
  echo "❌ FATAL(pg-init): KOLMATRIX_APP_PASSWORD 未注入 postgres 容器 env" >&2
  echo "   在 docker-compose.prod.yml 的 postgres.environment 里传入（来自 .env）。" >&2
  exit 1
fi

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	-- H3: pgvector（KOLMatrix 语义搜索 / embeddings）
	CREATE EXTENSION IF NOT EXISTS vector;
	-- gen_random_uuid() 在 PG13+ 为核心内置；如旧库 dump 依赖 pgcrypto 亦一并装（幂等）
	CREATE EXTENSION IF NOT EXISTS pgcrypto;

	-- H4: 应用角色（RLS 生效角色）。幂等：存在则改密码，不存在则创建。
	DO \$\$
	BEGIN
	  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kolmatrix_app') THEN
	    ALTER ROLE kolmatrix_app WITH LOGIN PASSWORD '${KOLMATRIX_APP_PASSWORD}';
	  ELSE
	    CREATE ROLE kolmatrix_app WITH LOGIN PASSWORD '${KOLMATRIX_APP_PASSWORD}';
	  END IF;
	END
	\$\$;

	-- 允许应用角色连接本库（迁移 SQL 会再补表级 GRANT + RLS policy）
	GRANT CONNECT ON DATABASE ${POSTGRES_DB} TO kolmatrix_app;
EOSQL

echo "✓ pg-init: vector + pgcrypto 扩展就位，kolmatrix_app 角色已建（密码来自 env）"
