# KOLMatrix 生产镜像 — BL-PROD-MIGRATE-DEPLOYSVR F-MIG-01（deploysvr 容器化）。
# 由 CI(build-push.yml) 按 git sha 打 tag 推 GHCR；deploysvr 只 pull 不 build（H5 红线：
# 7.8GB 无 swap，机上 `next build` 会撑爆整机 = BL-117 事故）。
#
# 两个交付 target：
#   runner  — Next standalone 运行时（小镜像，app 服务用）
#   migrate — 全量 node_modules + prisma CLI + tsx + 全部源码（一次性 migrate 服务 + cron 跑 tsx 脚本用）

# ─────────────────────────────────────────────────────────────
# base — 装依赖 + 生成 Prisma client + 构建 Next standalone
# ─────────────────────────────────────────────────────────────
FROM node:22-slim AS base
WORKDIR /app

# Prisma 7 query engine 运行需 openssl；node:22-slim(debian) 默认可能缺，显式装。
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# build-time 占位 env（对齐 ci.yml build job 的顶层 env:）。原因：
#   - prisma.config.ts `import "dotenv/config"` + `env("DATABASE_ADMIN_URL")` 在任何 prisma CLI
#     调用（含 npm ci 的 postinstall: prisma generate）时求值；
#   - `next build` collect-page-data 阶段会 eval 路由模块，/api/auth/[...nextauth] 在模块加载时
#     读 DATABASE_URL（构造 Prisma adapter），缺失即 "DATABASE_URL is not set" 构建失败。
# 这些是**纯构建期占位、不连库**；runner 是独立 FROM(不继承本 ENV)，migrate/app 运行时由 compose
# env_file .env 的真值遮蔽 → 占位值永不参与真实连接。
ENV DATABASE_ADMIN_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
ENV NEXTAUTH_SECRET="build-placeholder-overridden-at-runtime"
ENV NEXTAUTH_URL="http://localhost:3000"

# 依赖层（利用缓存）：先只 COPY 清单 + prisma schema，postinstall 需要 schema 才能 generate。
COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci --production=false && npx prisma generate

# 源码 + 构建（build 脚本已带 --webpack：Next 16.2.x Turbopack 生产 build 不写 BUILD_ID 的 bug）。
COPY . .
RUN mkdir -p public && node --max-old-space-size=4096 ./node_modules/next/dist/bin/next build --webpack

# ─────────────────────────────────────────────────────────────
# runner — 运行时最小镜像（Next standalone）
# ─────────────────────────────────────────────────────────────
FROM node:22-slim AS runner
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV PORT=3000
# HOSTNAME 由 compose 设为 0.0.0.0（standalone 默认绑 $HOSTNAME=容器ID → 容器内 127.0.0.1 不监听）。

# GIT_SHA 由 CI 以 --build-arg 传入，烘进镜像供 /api/health 报告运行版本（容器内无 .git）。
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

COPY --from=base /app/.next/standalone ./
COPY --from=base /app/.next/static ./.next/static
COPY --from=base /app/public ./public
COPY --from=base /app/prisma ./prisma
# Prisma client + query engine（standalone tracing 可能不带 engine 二进制，显式拷贝）。
COPY --from=base /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=base /app/node_modules/@prisma/client ./node_modules/@prisma/client

EXPOSE 3000
CMD ["node", "server.js"]

# ─────────────────────────────────────────────────────────────
# migrate — 一次性迁移 + cron tsx 脚本（全量依赖）
# ─────────────────────────────────────────────────────────────
# FROM base 保留全量 node_modules（含 prisma CLI + tsx）+ 全部源码（含 scripts/、prisma/migrations）。
# compose 的一次性 migrate 服务 command 覆盖为 deploy/scripts/migrate-and-sync-role.sh；
# cron 用 `docker compose run --rm migrate npm run kol-sync:daily` 等跑 tsx 脚本。
FROM base AS migrate
WORKDIR /app
ENV NODE_ENV=production
CMD ["sh", "deploy/scripts/migrate-and-sync-role.sh"]
