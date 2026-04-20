# BI2 — 部署自动化 批次规格

> 类型：Infrastructure Sprint（基建批次 2）
> 状态：草稿（待 BI1 完成 + 用户确认后启动；部分子项可与 BI3 域名/TLS 并行）
> Planner: Kimi · Generator: TBD · Evaluator: Reviewer
> 起草日期：2026-04-18

## 1. 背景与目标

当前生产部署完全手动（用户 SSH + 手动跑 6 行命令），**没有健康检查、没有自动回滚、没有 DB 备份**。任何失败都需要用户人工补救，凌晨故障没人响应。

本批次（BI2）目标：**把部署流程包装成 GitHub Actions workflow，加上完整的安全网**——pre-deploy DB 自动备份 / migration deploy / zero-downtime reload / health check + 5 次重试 / 失败自动回滚。完成后用户只需在 GitHub UI 点 "Run workflow"，剩下交给自动化。

**Definition of Done：**
- 用户在 GitHub Actions 点 "Deploy to Production" → 5-10 分钟内 `kol.guangai.ai` 跑新版
- 健康检查失败 → 自动回滚到上一个 SHA + 通知用户
- DB 每次部署前自动 pg_dump 备份（保留 30 天）
- 所有 migration 含 ROLLBACK SQL 注释（CI 强制校验）
- Production deploy workflow 用 `workflow_dispatch` 手动触发 + `environment: production`（Free 私有 repo 限制，无 required reviewer，见 §3 计费说明）

**Out of Scope：**
- ❌ Staging 环境（BI3 的 Staging 子域 + DB 完成后再加 staging deploy workflow）
- ❌ 多区域部署 / CDN（远期，流量大时考虑）
- ❌ Blue-green deployment（远期，PM2 reload 已经 zero-downtime 够用）
- ❌ 蓝绿 DB 迁移（远期，遇到大表 ALTER 时再做）
- ❌ Sentry / 监控告警（BI4）

## 2. 范围

### In Scope
- `/api/health` route handler（DB + Redis + version check）
- `ecosystem.config.js`（PM2 配置文件）+ stub for kolmatrix-worker
- `.github/workflows/deploy-prod.yml`（手动触发部署 workflow）
- VPS 端 `pg_dump` 自动备份脚本 + cron 清理
- VPS 端 health check 脚本（curl + retry）
- 自动回滚逻辑（git checkout prev-sha + reload）
- Migration 部署集成（`prisma migrate deploy`）
- ROLLBACK SQL 校验脚本（CI 中跑）
- `docs/dev/deployment-runbook.md`（手动 fallback 步骤）
- GitHub Environment 配置（用户操作）+ Secrets 录入

### Out of Scope
- Staging deploy workflow（BI3 后追加）
- Sentry / 监控告警（BI4）
- 性能监控 / APM（BI4 远期）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| Deploy 触发方式 | `workflow_dispatch`（手动触发） | 符合 CLAUDE.md "部署由用户手动触发"；防止误推 |
| SSH action | `appleboy/ssh-action@v1` | 维护活跃，社区标准 |
| Reload 方式 | `pm2 reload` + `instances: 2` + `kill_timeout: 5000`（cluster 模式滚动替换）| 真正 zero-downtime；单实例 reload 有 200-500ms 端口空窗（2026-04-20 BI2-F002 reverify 印证 + 裁决方案 A，见 `BI2-f002-zero-downtime-fix.md`）|
| DB 备份 | pg_dump → `/opt/kolmatrix-backups/db-{timestamp}.sql` | 简单可靠；保留 30 天 |
| 备份清理 | crontab `find ... -mtime +30 -delete` | 防磁盘满 |
| Health check 端点 | `/api/health`（无 auth） | 简单；返回 JSON 含 db/redis/version |
| Health check 重试 | 5 次 × 3 秒间隔 | PM2 reload 后 3-15s 内应该 ready |
| 回滚策略 | git checkout prev-sha + reload；DB 不自动回滚 | DB 回滚风险大，留人工决策 |
| Migration 失败处理 | 立即停 + 报警 + 不回滚（防数据不一致） | 安全优先，让用户介入 |
| Environment protection | `environment: production`（无 protection rules，Free 私有 repo 限制）+ `workflow_dispatch` 手动触发 | Free 计划下 required reviewer 需 Team/Enterprise 订阅（2026-04-20 用户选"暂不升级"，工 dispatch 点击已是一道门）|

## 4. 功能列表（8 项，全 executor:generator）

### F001 — `/api/health` 端点
**实现：**
- `src/app/api/health/route.ts`（Route Handler）
- 返回 JSON：
  ```json
  {
    "status": "healthy",
    "version": "1.2.3",       // package.json version
    "git_sha": "abc1234",     // process.env.GIT_SHA
    "uptime_seconds": 12345,
    "checks": {
      "database": { "status": "ok", "latency_ms": 12 },
      "redis": { "status": "ok", "latency_ms": 3 }
    },
    "timestamp": "2026-04-18T13:45:00Z"
  }
  ```
- DB check：`SELECT 1` via Prisma
- Redis check：`PING`（B2 引入 Redis client 后）；BI2 期间可 stub 返回 ok
- 任何 check 失败：返回 HTTP 503 + `status: "unhealthy"`
- 无认证（必须在 `middleware.ts` 跳过 auth）
- Response time < 200ms

**Acceptance：**
- `curl https://kol.guangai.ai/api/health` 返回 200 + JSON
- DB 故意停掉时返回 503
- Response time < 200ms

### F002 — PM2 ecosystem.config.js
**实现：**
- 项目根新增 `server.js`（~22 行 custom server + `process.send('ready')`，详见 `BI2-f002-zero-downtime-fix.md` §2.1.1）
- 项目根 `ecosystem.config.js`：
  ```js
  module.exports = {
    apps: [
      {
        name: 'kolmatrix',
        script: 'server.js',       // custom server（wait_ready 必需）
        cwd: '/opt/kolmatrix',
        instances: 2,              // 滚动替换基准；'max' 在未来加 vCPU 时再评
        exec_mode: 'cluster',
        max_memory_restart: '1G',
        kill_timeout: 5000,        // 让 Next.js 处理完 in-flight 请求再强杀（default 1.6s）
        wait_ready: true,          // PM2 等 process.send('ready') 才切流量到 new worker
        listen_timeout: 10000,     // 10s 上限，Next cold start ~450ms 绰绰有余
        env: {
          NODE_ENV: 'production',
          PORT: 3001,
        },
        env_file: '/opt/kolmatrix/.env.production',
        log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
        out_file: '/var/log/pm2/kolmatrix-out.log',
        error_file: '/var/log/pm2/kolmatrix-error.log',
        merge_logs: true,
      },
      // Future B2: kolmatrix-worker（BullMQ workers，独立进程）
      // {
      //   name: 'kolmatrix-worker',
      //   script: 'node',
      //   args: 'workers/index.js',
      //   instances: 2,
      //   ...
      // }
    ]
  };
  ```
- VPS 上首次执行：`pm2 start ecosystem.config.js && pm2 save && pm2 startup`
- `.env.production` 由用户在 VPS 上手动维护（不入 git）
- README 说明 PM2 命令（`pm2 status` / `pm2 logs kolmatrix` / `pm2 reload kolmatrix`）

**Acceptance：**
- `pm2 describe kolmatrix` 显示 `instances=2` / `exec_mode=cluster` / 两 worker 均 online
- 连续 60 次公网 curl（间隔 500ms）叠加 `pm2 reload kolmatrix --update-env`：全 HTTP 200（0 个 502/000）
- 连续 60 次 VPS 本地 curl（`http://127.0.0.1:3001/api/health`）叠加 reload：全 HTTP 200（0 连接失败）
- 两 worker uptime 交错（证明滚动替换而非同时重启）
- Out/error log 写入 `/var/log/pm2/`
- 进程 RAM > 1G 自动重启
- 重启 VM 后 PM2 自动恢复（pm2 startup 完成）

> **2026-04-20 裁决链：**
> - Reviewer round 1 judged F002 FAIL（单实例 reload 空窗导致 2×502 + 4× 本地连接失败）
> - Planner round 1 裁决：方案 A（`npm start` + `instances:2`）—— v1 假设 cluster 自动 zero-downtime
> - Generator round 2 两轮 VPS 实测证伪：npm start 下 cluster crash loop（EADDRINUSE）；next 直连无 ready 信号 → 93% 通过（4×000 超时）
> - **Planner round 2 重裁决：方案 B1（custom `server.js` + `wait_ready:true`）** —— spec §2.2 预案触发，详见 `docs/specs/BI2-f002-zero-downtime-fix.md` v2 + `BI2-f002-round2-adjudication.md`

### F003 — Deploy production workflow
**实现：**
- `.github/workflows/deploy-prod.yml`：
  ```yaml
  name: Deploy to Production
  on:
    workflow_dispatch:
      inputs:
        ref:
          description: 'Branch / tag / SHA to deploy'
          default: 'main'
          required: true
        skip_backup:
          description: 'Skip pre-deploy DB backup (NOT recommended)'
          type: boolean
          default: false
  
  jobs:
    deploy:
      runs-on: ubuntu-latest
      environment:
        name: production    # 用于 secrets 作用域 + deployment history；Free 私有 repo 无 protection rules
        url: https://kol.guangai.ai
      steps:
        - uses: actions/checkout@v4
          with:
            ref: ${{ inputs.ref }}
        
        - name: Validate ROLLBACK SQL in migrations
          run: ./scripts/validate-rollback-sql.sh
        
        - name: SSH and deploy
          uses: appleboy/ssh-action@v1
          with:
            host: ${{ secrets.PROD_HOST }}
            username: ${{ secrets.PROD_USER }}
            key: ${{ secrets.PROD_SSH_KEY }}
            script_path: ./scripts/deploy-prod.sh
            envs: GIT_SHA,SKIP_BACKUP
          env:
            GIT_SHA: ${{ github.sha }}
            SKIP_BACKUP: ${{ inputs.skip_backup }}
        
        - name: Notify on failure
          if: failure()
          uses: ...      # Slack / email webhook
  ```
- `scripts/deploy-prod.sh`（VPS 上跑）：
  ```bash
  #!/bin/bash
  set -e
  cd /opt/kolmatrix
  
  # 1. 记录上一个 SHA
  PREV_SHA=$(git rev-parse HEAD)
  echo $PREV_SHA > /tmp/prev-sha
  
  # 2. DB 备份（除非 skip）
  if [ "$SKIP_BACKUP" != "true" ]; then
    /opt/kolmatrix/scripts/backup-db.sh
  fi
  
  # 3. Pull + install + migrate + build
  git fetch
  git checkout ${GIT_SHA:-origin/main}
  npm ci --production=false
  npx prisma migrate deploy   # 失败立即 set -e 退出
  npm run build
  
  # 4. Reload
  pm2 reload kolmatrix --update-env
  
  # 5. Health check
  /opt/kolmatrix/scripts/healthcheck.sh
  
  # 6. 健康 → 完成；不健康 → 自动回滚
  if [ $? -ne 0 ]; then
    /opt/kolmatrix/scripts/rollback.sh
    exit 1
  fi
  
  echo "✅ Deploy successful: $GIT_SHA"
  ```

**Acceptance：**
- 用户在 GitHub Actions UI 点 "Run workflow" → 5-10 分钟内 `kol.guangai.ai` 跑新版
- workflow 用 `environment: production` 作用域（secrets 绑定），无 required reviewer（Free 私有 repo 限制，见 §3）
- 失败时 GitHub Actions 显示明确错误日志
- ROLLBACK SQL 校验：故意删一个 migration 的 ROLLBACK 注释 → CI fail

### F004 — DB 备份脚本 + cron 清理
**实现：**
- `scripts/backup-db.sh`（VPS 上）：
  ```bash
  #!/bin/bash
  set -euo pipefail
  BACKUP_DIR=/opt/kolmatrix-backups
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  FILENAME=db-$TIMESTAMP.sql.gz

  # 读 .env.production 拿 DATABASE_ADMIN_URL（superuser 角色 kolmatrix）
  set -a; source "${REPO_DIR:-/opt/kolmatrix}/.env.production"; set +a
  # 剥离 Prisma 加的 ?schema=public 后缀，pg_dump 不认 URI query param
  ADMIN_URL="${DATABASE_ADMIN_URL%%\?*}"

  mkdir -p "$BACKUP_DIR"
  pg_dump "$ADMIN_URL" | gzip > "$BACKUP_DIR/$FILENAME"

  # 元数据：timestamp / git SHA / filename
  echo "$TIMESTAMP $(git -C "${REPO_DIR:-/opt/kolmatrix}" rev-parse HEAD) $FILENAME" >> "$BACKUP_DIR/manifest.log"

  echo "✅ Backup: $BACKUP_DIR/$FILENAME ($(du -h "$BACKUP_DIR/$FILENAME" | cut -f1))"
  ```

> **DB 命名约定（2026-04-20 确认）：** prod PG 数据库名固定为 **`kolmatrix`**（不是 `kolmatrix_prod`）—— init migration `20260418010000_app_role` 硬编码 `GRANT CONNECT ON DATABASE kolmatrix`，故 prod 实际创建的 DB 名即 `kolmatrix`。Planner 裁决接受固定名约定（方案 A，不起新 parameterize migration），全项目文档（environment.md / architecture.md / runbook / infrastructure.md）统一对齐。
- VPS crontab：
  ```
  # 清理 30 天前备份
  0 4 * * * find /opt/kolmatrix-backups -name 'db-*.sql.gz' -mtime +30 -delete
  ```
- 首次部署 BI2 时用户在 VPS 手动跑 `crontab -e` 加上述行

**Acceptance：**
- deploy-prod.sh 调用 backup-db.sh 后 `/opt/kolmatrix-backups/` 多一个文件
- 备份文件可解压：`gzip -dc db-XXX.sql.gz | head` 输出 SQL
- 30 天前的备份被 cron 清理
- 备份单文件 < 100MB（gzip 压缩比 ~10x）

### F005 — Health check 脚本（重试 + 容错）
**实现：**
- `scripts/healthcheck.sh`（VPS 上）：
  ```bash
  #!/bin/bash
  ENDPOINT=${1:-https://kol.guangai.ai/api/health}
  MAX_RETRIES=5
  WAIT=3
  
  for i in $(seq 1 $MAX_RETRIES); do
    sleep $WAIT
    HTTP_CODE=$(curl -s -o /tmp/health.json -w "%{http_code}" $ENDPOINT)
    if [ "$HTTP_CODE" = "200" ]; then
      STATUS=$(jq -r .status /tmp/health.json)
      if [ "$STATUS" = "healthy" ]; then
        echo "✅ Healthy on attempt $i"
        exit 0
      fi
    fi
    echo "⚠️ Attempt $i/$MAX_RETRIES failed (HTTP $HTTP_CODE)"
  done
  
  echo "❌ Health check failed after $MAX_RETRIES attempts"
  cat /tmp/health.json
  exit 1
  ```
- VPS 需安装 `jq`（apt install jq）

**Acceptance：**
- 应用正常时脚本退出码 0
- 故意停 PM2 进程，脚本 5 次重试后退出码 1
- 输出清晰可定位问题

### F006 — 自动回滚脚本
**实现：**
- `scripts/rollback.sh`（VPS 上）：
  ```bash
  #!/bin/bash
  set -e
  cd /opt/kolmatrix
  
  PREV_SHA=$(cat /tmp/prev-sha)
  if [ -z "$PREV_SHA" ]; then
    echo "❌ No prev-sha recorded, cannot rollback"
    exit 1
  fi
  
  echo "🔄 Rolling back to $PREV_SHA"
  git checkout $PREV_SHA
  npm ci --production=false
  npm run build
  pm2 reload kolmatrix --update-env
  
  # 再次 health check
  sleep 3
  if /opt/kolmatrix/scripts/healthcheck.sh; then
    echo "✅ Rollback successful"
  else
    echo "❌ Rollback also failed - MANUAL INTERVENTION REQUIRED"
    exit 2
  fi
  ```
- 只回滚应用代码，**不自动回滚 DB**（migration 已 deploy 的 schema 变更）
- 报警通知用户介入

**Acceptance：**
- 模拟健康检查失败：故意 break 一行 src code → push → deploy → 自动回滚到上一版
- rollback.sh 输出清晰
- 二次回滚失败时退出码 2，触发严重告警

### F007 — Migration deployment + ROLLBACK SQL 校验
**实现：**
- `scripts/validate-rollback-sql.sh`（CI 中跑）：
  ```bash
  #!/bin/bash
  set -e
  for migration in prisma/migrations/*/migration.sql; do
    if ! grep -q "^-- ROLLBACK:" $migration; then
      echo "❌ Missing ROLLBACK SQL in $migration"
      exit 1
    fi
  done
  echo "✅ All migrations have ROLLBACK SQL"
  ```
- 在 CI workflow（.github/workflows/ci.yml）加一个 job 跑此脚本
- deploy-prod.yml 中作为 pre-deploy 步骤

**Acceptance：**
- 故意删一个 migration 的 ROLLBACK SQL 注释 → CI 立即 fail
- 所有现存 migration 都符合规范

### F008 — Deployment runbook（手动 fallback 文档）
**实现：**
- `docs/dev/deployment-runbook.md`：
  - 完整部署流程（手动版本，作为 GitHub Actions 失败的 fallback）
  - Health check 失败时 debug 步骤
  - Rollback 手动步骤
  - DB 备份恢复步骤（pg_restore 命令 + 注意事项）
  - Common errors 表（OOM / 端口冲突 / Prisma generate 失败 / etc）
  - 各种 PM2 命令速查
  - SSH 进 VPS 的应急入口
- 内容必须 Reviewer 测试过（在 staging 跑一遍验证步骤可重现）

**Acceptance：**
- Runbook 步骤清晰，新人按步骤可手动部署
- "Common errors" 包含至少 5 种已知错误的处理
- Reviewer 在干净环境按 runbook 执行一次成功部署

## 5. 依赖关系

```
F001 (/api/health) → F005 (healthcheck script needs endpoint)
F002 (PM2 config) → F003 (deploy script reloads PM2)
F004 (backup script) → F003 (deploy invokes backup)
F005 (healthcheck) → F003 (deploy verifies health)
F006 (rollback) → F003 (deploy invokes rollback on failure)
F007 (ROLLBACK SQL validate) → F003 (CI gate before deploy)
F008 (runbook) 跨阶段，最后写
```

**强制执行顺序：** F001 → F002 → F005 → F004 → F006 → F007 → F003 → F008

> F003 deploy workflow 是最后聚合，因为它依赖前置的 health/backup/rollback 脚本就位。

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| Migration 部署中失败导致 DB 状态不一致 | 不自动回滚 DB；deploy 立即停 + 通知；用户手动介入用 ROLLBACK SQL |
| Pre-deploy backup 失败导致部署被阻 | 用户可手动加 `skip_backup=true` 跳过（但记录在 audit log） |
| pg_dump 时间长（大表） | 监控备份耗时；超过 5 分钟告警；远期切换到逻辑备份 + WAL 增量 |
| PM2 reload 仍丢请求 | reload 用 `--wait-ready` + 应用 listen ready 信号；测试中验证连接保持 |
| GitHub Actions 卡住 | workflow timeout 设 30 分钟；超时自动 fail |
| SSH key 泄露 | repo secrets + GitHub Environments 限制；定期轮换；用 ed25519 |
| Health check 端点故障掩盖问题 | 端点返回详细 checks 字段，每个组件单独验证；Sentry (BI4) 兜底 |
| 误触发 deploy（点错按钮） | Free 私有 repo 无 required reviewer，靠 `workflow_dispatch` 手动点击 + repo admin 权限单人控制 + workflow 名前缀 `[PROD]`（升级 Team 计划后再加 reviewer）|
| `/var/log/pm2/` 撑满磁盘 | logrotate 配置（VPS 系统级）；BI4 加监控 |

## 7. 验收方式（Evaluator 阶段）

由 Reviewer (Codex) 执行：

### L1 — 自动化检查
- `curl https://kol.guangai.ai/api/health` 返回 200 + healthy
- ROLLBACK SQL 校验脚本在 CI 中通过
- deploy-prod.yml workflow 文件 `actionlint` 通过（GitHub Actions linter）
- 所有 shell 脚本 `shellcheck` 通过

### L2 — 真实 Deploy 测试
- Reviewer 触发一次完整 deploy（用 staging 域名或 prod 测试时段）：
  1. GitHub Actions 点 "Deploy to Production" → 选 main → 直接启动（Free 私有 repo 无二次批准）
  2. 5-10 分钟内 health check 通过
  3. `/opt/kolmatrix-backups/` 出现新备份
  4. 应用版本号更新（curl /api/health 看 git_sha）
- **回滚测试：** 故意 push 一个 break health check 的 commit → deploy → 验证自动回滚到上一版本

### L3 — Runbook 可重现性
- Reviewer 假装"凌晨故障"场景，按 runbook 手动 SSH 进 VPS 处理：
  - 故意停 PM2 进程 → 按 runbook 重启
  - 故意改坏 .env.production → 按 runbook 修复
  - 故意 PG 连接被打满 → 按 runbook 排查

## 8. 引用文档

- `docs/dev/infrastructure.md` — CI/CD 总览（本批次落地实施）
- `docs/dev/architecture.md` — §13 部署
- `.auto-memory/environment.md` — VPS 配置 / SSH / DB 连接
- `harness-rules.md` — 分支规则（推 main，部署手动触发）
- `docs/specs/B0-database-schema.md` — Migration 规范

## 9. 启动检查清单（BI1 完成后立即启动 — Option α 已锁定）

> **顺序约束：** B0 → BI1 → **BI2** → BI3 → B1 → ...
> 详见 `docs/specs/roadmap.md`

- [x] BI1 status=done（自动化测试已就位，deploy 失败可查测试 log）
- [x] B0 中 Auth 已实现（`/api/health` 端点能用 middleware skip auth）
- [x] VPS 已安装：`jq`、`pg_dump`（postgresql-client）、`certbot`（BI3 需要）— 2026-04-20 Planner 核对全齐
- [x] PM2 已就绪（`pm2 -v` = 6.0.14）
- [x] `production` environment 已创建（2026-04-20 Planner 自动完成）；Free 私有 repo 下无 required reviewer（见 §3）
- [x] Secrets 已录入：PROD_HOST / PROD_USER / PROD_SSH_KEY（2026-04-20 Planner 自动完成）
- [x] deploy 专用 SSH key 已生成并 authorize（`~/.ssh/kolmatrix_deploy`，ed25519；VPS authorized_keys 已追加；新 key 登录验证通过）
- [x] 用户确认 BI2 全做 8 features（2026-04-20）
- [x] role_assignments: Planner: Kimi / Generator: johnsong / Evaluator: Reviewer（沿用 B0/BI1）

## 10. 完成后效果

BI2 后，**用户部署生产**的流程：
1. 在 GitHub Actions 点 "Deploy to Production"
2. 选择 ref（默认 main）
3. 在 Environments 通知中点 "Approve"
4. 等 5-10 分钟
5. 看到 ✅ workflow success → kol.guangai.ai 已是新版

**失败场景：**
- Migration 失败 → workflow stop + GitHub UI 显示日志 + 用户介入
- Health check 失败 → 自动回滚 + workflow fail + 通知
- 严重情况（回滚也失败）→ 用 runbook 手动 SSH 处理

后续 BI3 完成 staging 后，可加 `deploy-staging.yml`（自动 push 到 main 即触发 staging deploy，无需 reviewer 批准）。
