# KOLMatrix 工程基建（CI/CD + 部署 + 域名 + TLS）

> 版本：v1.0 · 日期：2026-04-18
> 当前实施状态：B0 阶段只有最小 CI（lint + tsc + build），其余基建待 BI1/BI2/BI3 批次落地
> 本文档为规划与现状参考，落地以对应批次 spec 为准

## 1. 环境总览

| 环境 | 用途 | 域名 | 数据库 | Redis | 状态 |
|---|---|---|---|---|---|
| **Local** | 开发 | `http://localhost:3000` | docker-compose PG16（5432，本机冲突走 5433） | docker Redis7 | ✅ B0 完成 |
| **CI** | 自动化测试 | GitHub Actions runner | service container PG | service container Redis | ⚠️ B0 F008 仅起 PG，无 Redis |
| **Staging** | 预生产验证 | `staging.kol.guangai.ai`（待申请 DNS） | `kolmatrix_staging` on Tokyo VM 共享 PG | 共享 db index `2` | ❌ 未搭建 |
| **Prod** | 线上 | `https://kol.guangai.ai` | `kolmatrix_prod` on Tokyo VM 共享 PG | 共享 db index `1` | ✅ 域名 + VM 已就绪，应用未部署 |

**Staging 设计原则：** 同 Tokyo VM 子域名 + 不同 DB schema，控制成本。如未来流量大需要拆分，再独立 VPS。

**Worker 进程：** B2 引入 BullMQ workers 时，独立 PM2 进程（`kolmatrix-web` + `kolmatrix-worker`），避免 worker 阻塞 SSR。

## 2. CI 策略（GitHub Actions）

### 2.1 当前（B0 F008 范围）

```yaml
# .github/workflows/ci.yml
on:
  push:
    branches: [main]
    paths-ignore:
      - '.auto-memory/**'
      - 'progress.json'
      - 'features.json'
      - 'backlog.json'
      - 'docs/**'
      - 'design-draft/**'
      - 'framework/**'
      - '*.md'
      - 'harness-rules.md'
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: kolmatrix_test
        ports: [5432:5432]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma migrate deploy
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
```

### 2.2 BI1 后增项

- 加 Redis service container
- `npm test -- --coverage` 跑单元 + 集成测试
- 上传 coverage 到 Codecov（可选）
- 缓存 `.next/cache` 加速 build

### 2.3 BI2 后增项

- Visual regression：`npx playwright test` + 截图 diff（baseline 在 `design-draft/stitch-references/`）
- E2E 跑关键用户流（marketer 登录 → 浏览 dashboard → 查看 KOL）

### 2.4 BI3 后增项

- Deploy job（手动 `workflow_dispatch` 触发）
- Tag-based release（`git tag v1.2.0` 触发 production deploy）

## 3. CD 策略（VPS 部署）

### 3.1 当前现状

CLAUDE.md 写 "代码提交推 main 分支。部署由用户手动触发"。当前是手动 SSH + 手动操作：

```bash
# 用户手动操作
ssh tripplezhou@34.180.93.185
cd /opt/kolmatrix
git pull origin main
npm ci --production=false
npx prisma migrate deploy
npm run build
pm2 reload kolmatrix --update-env
```

**问题：** 无自动化 + 无健康检查 + 无回滚 + 无 DB 备份

### 3.2 BI2 目标方案：GitHub Actions Deploy Workflow

```yaml
# .github/workflows/deploy-prod.yml
on:
  workflow_dispatch:    # 手动触发，用户在 GitHub UI 点 Run
    inputs:
      ref:
        description: 'Branch/tag/SHA to deploy'
        default: 'main'

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production    # GitHub Environments，需 reviewer 批准
    steps:
      - name: SSH and deploy
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.PROD_HOST }}
          username: ${{ secrets.PROD_USER }}
          key: ${{ secrets.PROD_SSH_KEY }}
          script: |
            set -e
            cd /opt/kolmatrix
            BACKUP=$(mktemp -d)
            
            # 1. DB 快照（pg_dump）
            pg_dump -U postgres kolmatrix_prod > $BACKUP/db-$(date +%s).sql
            
            # 2. Git 拉新代码（记录上一个 SHA 用于回滚）
            PREV_SHA=$(git rev-parse HEAD)
            echo $PREV_SHA > $BACKUP/prev-sha
            git fetch && git checkout ${{ github.event.inputs.ref }}
            
            # 3. 安装 + migrate + build
            npm ci --production=false
            npx prisma migrate deploy
            npm run build
            
            # 4. Zero-downtime reload
            pm2 reload kolmatrix --update-env
            
            # 5. 健康检查（5 次重试）
            for i in 1 2 3 4 5; do
              sleep 3
              if curl -fs https://kol.guangai.ai/api/health; then
                echo "✅ Healthy"; exit 0
              fi
            done
            
            # 6. 健康检查失败 → 自动回滚
            echo "❌ Health check failed, rolling back"
            git checkout $PREV_SHA
            npm ci --production=false
            npm run build
            pm2 reload kolmatrix
            exit 1
```

**Secrets 需要配置（GitHub Settings → Secrets）：**
- `PROD_HOST` = `34.180.93.185`
- `PROD_USER` = `tripplezhou`
- `PROD_SSH_KEY` = SSH private key（用户生成）
- 后续可加 `STAGING_HOST` 等

**前置实现：**
- 项目需提供 `/api/health` route（B0 F004 后追加）
- VM 需安装 PostgreSQL client (`pg_dump`)
- PM2 ecosystem 配置文件

### 3.3 Migration 部署策略

| 场景 | 处理 |
|---|---|
| 新增表 / 新增列（nullable） | 直接 `prisma migrate deploy` 安全 |
| 改 column 类型 | 4 步：加新列 → backfill → 切换代码 → 删旧列（分多次 deploy） |
| 删表 / 删列 | 先停止使用代码 → deploy → 一周后再删（防回滚需要） |
| RLS policy 变更 | 在 migration 内 ALTER POLICY，注意已有连接的 session 不影响 |

**每个 migration 文件头必须有 ROLLBACK SQL 注释**：

```sql
-- migration.sql
-- ROLLBACK:
-- ALTER TABLE kol DROP COLUMN ai_score_v2;

ALTER TABLE kol ADD COLUMN ai_score_v2 int;
```

### 3.4 回滚步骤

**应用回滚（最常用）：**
```bash
git checkout <prev-sha-from-backup>
npm ci && npm run build
pm2 reload kolmatrix
```

**DB 回滚（破坏性，慎用）：**
```bash
# 从 BI2 自动备份的 pg_dump 恢复
psql kolmatrix_prod < /tmp/db-XXXX.sql
# 或手动跑 migration 文件里的 ROLLBACK SQL
```

## 4. 域名与 TLS

### 4.1 当前现状

- DNS：`kol.guangai.ai` A 记录 → `34.180.93.185`（已就绪）
- Nginx：反代 `kol.guangai.ai` → `localhost:3001`（已配置，无 TLS）

### 4.2 BI3 目标：Let's Encrypt + 自动续期

**初始申请：**
```bash
# VM 上一次性操作
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d kol.guangai.ai -d staging.kol.guangai.ai \
  --non-interactive --agree-tos -m tripplezhou@gmail.com
```

certbot 自动修改 nginx config 加 TLS：

```nginx
# /etc/nginx/sites-available/kolmatrix
server {
    listen 443 ssl http2;
    server_name kol.guangai.ai;
    
    ssl_certificate /etc/letsencrypt/live/kol.guangai.ai/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/kol.guangai.ai/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # HSTS（可选但推荐）
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    server_name kol.guangai.ai;
    return 301 https://$server_name$request_uri;
}
```

**自动续期（certbot 安装时自动配置 systemd timer）：**

```bash
# 检查
systemctl list-timers | grep certbot
# certbot.timer 每天跑两次，到期前 30 天自动续期
```

**手动验证续期：**
```bash
sudo certbot renew --dry-run
```

### 4.3 多子域名规划

| 子域名 | 用途 | 何时申请 |
|---|---|---|
| `kol.guangai.ai` | 生产应用 | 已有 |
| `staging.kol.guangai.ai` | Staging 环境 | BI3 |
| `kolquest.com` | 品牌域 + 301 redirect 到主站 + 根域发件（marketer@kolquest.com） | BI3（DNS + redirect + TLS）/ B4（接 Resend 补 DKIM） |
| `api.kol.guangai.ai` | 公开 API（如开放） | 远期 |

**发件域策略（2026-04-19 定稿）：** 已注册独立品牌域 `kolquest.com`。主站仍留 `kol.guangai.ai`，`kolquest.com` 作 301 redirect + 根域直接发件（`marketer@kolquest.com`）。因 kolquest.com 没有 web 主站流量，reputation 风险可控。详见 ADR-009 + BI3 F006。

## 5. 推荐基建批次（BI 系列）

| 批次 | 主题 | 主要交付 | 预估时间 |
|---|---|---|---|
| **BI1** | 测试基建落地 | Vitest + Testcontainers + Playwright + 首批 unit/integration tests + CI 集成 | 2-3 天 |
| **BI2** | 部署自动化 | GitHub Actions deploy workflow + 健康检查 + 回滚 + DB 自动备份 + `/api/health` 端点 + PM2 ecosystem | 1-2 天 |
| **BI3** | 域名与 TLS | Let's Encrypt 申请 + Nginx HTTPS + Staging 子域 + 续期监控 | 1 天 |
| **BI4**（可选） | 监控与日志 | Sentry / pino + log aggregation / Grafana | 2 天 |

执行时机：
- **BI1 紧迫：** B1 业务批次开工前必须完成（测试是 acceptance 基础）
- **BI2 / BI3 中等：** B0 完成后 + 第一次需要 staging 验证前
- **BI4 远期：** 流量上来后

详见 `docs/specs/roadmap.md`。

## 6. 风险与对策

| 风险 | 对策 |
|---|---|
| 共用 PG 实例：staging 写坏 prod 表 | 用 PostgreSQL ROLE 严格隔离权限；staging 用户只能访问 `kolmatrix_staging` schema |
| Let's Encrypt 续期失败 | 续期前 7 天 cron 报警（mail/Slack）；手动跑 `certbot renew` 兜底 |
| Worker 进程吃光内存影响 web | PM2 设 max_memory_restart；监控 RAM；BI4 加 Sentry/alerts |
| Deploy 中数据库锁阻塞 | migration 用 `CREATE INDEX CONCURRENTLY`；大表 ALTER 走蓝绿 |
| SSH key 泄露 | 仓库 secrets 不漏；用 ssh-action 不在脚本中 echo key；定期轮换 |
| pg_dump 备份积累爆磁盘 | BI2 加 cron 清理 30 天前备份 |

## 7. 引用文档

- `docs/dev/architecture.md` — 系统架构（生产部署在 §13）
- `docs/dev/testing.md` — 测试策略与 Codex 工作流
- `docs/specs/roadmap.md` — 批次路线图（BI 在其中）
- `.auto-memory/environment.md` — 生产环境地址 / SSH / PG 连接细节
- `harness-rules.md` — 分支规则（推 main，部署手动触发）
