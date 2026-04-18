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
- Production deploy workflow 受 GitHub Environments 保护（reviewer 批准）

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
| Reload 方式 | `pm2 reload`（不是 restart） | zero-downtime，保留连接 |
| DB 备份 | pg_dump → `/opt/kolmatrix-backups/db-{timestamp}.sql` | 简单可靠；保留 30 天 |
| 备份清理 | crontab `find ... -mtime +30 -delete` | 防磁盘满 |
| Health check 端点 | `/api/health`（无 auth） | 简单；返回 JSON 含 db/redis/version |
| Health check 重试 | 5 次 × 3 秒间隔 | PM2 reload 后 3-15s 内应该 ready |
| 回滚策略 | git checkout prev-sha + reload；DB 不自动回滚 | DB 回滚风险大，留人工决策 |
| Migration 失败处理 | 立即停 + 报警 + 不回滚（防数据不一致） | 安全优先，让用户介入 |
| Environment protection | 用 GitHub Environments + required reviewer | 防止单人误操作 |

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
- 项目根 `ecosystem.config.js`：
  ```js
  module.exports = {
    apps: [
      {
        name: 'kolmatrix',
        script: 'npm',
        args: 'start',
        cwd: '/opt/kolmatrix',
        instances: 1,
        exec_mode: 'cluster',     // 后续可加 instances: 'max'
        max_memory_restart: '1G',
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
- `pm2 reload kolmatrix --update-env` 不丢请求
- Out/error log 写入 `/var/log/pm2/`
- 进程 RAM > 1G 自动重启
- 重启 VM 后 PM2 自动恢复（pm2 startup 完成）

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
        name: production    # 需 reviewer 批准
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
- workflow 受 GitHub Environments 保护（用户配置 required reviewer）
- 失败时 GitHub Actions 显示明确错误日志
- ROLLBACK SQL 校验：故意删一个 migration 的 ROLLBACK 注释 → CI fail

### F004 — DB 备份脚本 + cron 清理
**实现：**
- `scripts/backup-db.sh`（VPS 上）：
  ```bash
  #!/bin/bash
  set -e
  BACKUP_DIR=/opt/kolmatrix-backups
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  FILENAME=db-$TIMESTAMP.sql.gz
  
  mkdir -p $BACKUP_DIR
  pg_dump -U postgres kolmatrix_prod | gzip > $BACKUP_DIR/$FILENAME
  
  # 元数据记录
  echo "$TIMESTAMP $(git -C /opt/kolmatrix rev-parse HEAD)" >> $BACKUP_DIR/manifest.log
  
  echo "✅ Backup: $BACKUP_DIR/$FILENAME ($(du -h $BACKUP_DIR/$FILENAME | cut -f1))"
  ```
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
| 误触发 deploy（点错按钮） | GitHub Environment 加 required reviewer；workflow 名前缀 `[PROD]` |
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
  1. GitHub Actions 点 "Deploy to Production" → 选 main → 等批准
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

## 9. 启动检查清单（BI1 完成 + 用户确认后核对）

- [ ] BI1 status=done（自动化测试已就位，deploy 失败可查测试 log）
- [ ] B0 中 Auth 已实现（`/api/health` 端点能用 middleware skip auth）
- [ ] VPS 已安装：`jq`、`pg_dump`（postgresql-client）、`certbot`（BI3 需要）
- [ ] PM2 已就绪（`pm2 -v` 显示版本）
- [ ] 用户已在 GitHub repo Settings → Environments 创建 "production" 环境 + required reviewer
- [ ] 用户已在 GitHub repo Settings → Secrets 录入：PROD_HOST / PROD_USER / PROD_SSH_KEY
- [ ] 用户已生成 deploy 专用 SSH key 并 authorize（不复用主 key）
- [ ] 用户确认 BI2 范围（如不要 GitHub Environment 保护可剥离）
- [ ] role_assignments 决定（默认 generator=johnsong / evaluator=Reviewer）

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
