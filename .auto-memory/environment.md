---
name: environment
description: 生产/Staging 环境地址、服务器配置、测试账号（很少变）
type: reference
---

## 生产环境

- 主应用控制台：`https://kol.guangai.ai`
- 主应用 API：`https://kol.guangai.ai/api/v1/`
- **品牌域（2026-04-19 注册 + DNS 配完 + BI3-F006 Nginx 301 落地）：** `kolquest.com`
  - DNS 管理：Cloudflare zone `kolquest.com`（Free plan）
  - 用途：301 redirect 到主站 + 邮件发件
  - **发件地址：`marketer@kolquest.com`（根域，2026-04-20 BI3-F005 实测修正）** —— Resend API 只接受根域作为 sender；`marketer@send.kolquest.com` 返回 403 validation_error（原 ADR-010 §3 对 send 子域的理解误读，实际 send.* 只是 bounce 基础设施）
  - Resend region: `ap-northeast-1`（Tokyo，与 KOLMatrix VM 同区）
  - Resend Dashboard 注册 domain = `kolquest.com`（根域），status=verified + sending enabled
  - DNS 记录分布（6 条 2026-04-19 Cloudflare API 配完）：A/CNAME 给主站 redirect；DKIM 在根域 `resend._domainkey.kolquest.com`；MX/SPF 在 `send.kolquest.com` 子域（Resend bounce 基础设施，不是发件地址）；DMARC 在 `_dmarc.kolquest.com` 根域
  - Nginx 301 redirect + Let's Encrypt 证书：BI3-F006 已落地 ✅
  - 主站暂不迁移（ADR-010 B 方案）；未来业务稳定后再评估
- Stitch 视觉基调基准项目（Neural Velocity，已定稿 2026-04-18）：`9338165817879839093`
  - URL: https://stitch.withgoogle.com/projects/9338165817879839093
  - 设计系统 Asset: `18406648320972948834`（已含 canonical App Shell 强制规范）
  - Dashboard 屏幕（canonical shell）: `8b4aa02ae47c4da181239399c6ef4658`
  - KOL Discovery 屏幕: `a1771401c71140e49e20ebc559782dc3`
  - KOL Detail 屏幕: `b06528d25565440c833a7f94035feead`
- Stitch 早期探索项目（已淘汰）：`5540715662009406892`（scratch screens，不作参考）
- 视觉规范完整文档：`design-draft/design-system.md` + `docs/specs/visual-baseline.md`

## aigcgateway 姊妹项目（同 VM 部署）

- **项目位置：** `~/project/aigcgateway`
- **生产 API：** `https://aigc.guangai.ai/v1/`（OpenAI 兼容格式）
- **控制台：** `https://aigc.guangai.ai`（生成 API Key、创建 Action / Template）
- **MCP 端点：** `https://aigc.guangai.ai/mcp`（25 tools）
- **SDK：** `@guangai/aigc-sdk`（零依赖，Node 18+）
- **内网 URL：** `http://localhost:3099/v1/`（同 VM 走内网，生产用，零公网延迟）
- **KOLMatrix API Key：** `pk_REDACTED` (name: admintest, active, 2026-04-23 跨 staging + prod 共用单 key；长期建议拆 dev/prod 两份；完整 key 仅存 `.env.production` / `.env.staging` 文件，本记忆文件禁录)
- **月预算：** $100 USD（B2-B4 初期；当前余额 $49.60 @ 2026-04-23）
- **Actions 清单：**
  - **BM2 (2026-04-23 创建)：** `kol-email-customize` / `roi-insights` / `weekly-report-for-client`
  - **B5-F004 (2026-04-30 创建)：** `kol-topic-extract` (action_id `cmokr9z880009bn18sre31yf0`, model claude-haiku-4.5, 用于 KOL 详情页词云从 6 视频标题提取 5-10 关键词 + weight，单次 ~$0.001) — env var `AIGCGATEWAY_KOL_TOPIC_ACTION_ID` 待 SSH 落入 `.env.production` + `.env.staging`
  - 早期 B2 设想的 kol-eval-bulk/precision/campaign-match/email-personalize 未启用（MVP 未走 AI 匹配路线）
- **集成决策：** 见 ADR-009

## 生产服务器（与 aigcgateway 共机）

| 项目 | 值 |
|---|---|
| 机型 | e2-highmem-2（2 vCPU，16GB RAM） |
| 地区 | asia-northeast1-b（东京） |
| 外网 IP | `34.180.93.185` |
| 主机名 | `instance-20260403-154049` |
| SSH | `ssh tripplezhou@34.180.93.185`（sudo passwordless）— 2026-05-01 起本机 WSL2 默认 KEX 已通（`~/.ssh/config` 加 `KexAlgorithms -sntrup761x25519-sha512@openssh.com,sntrup761x25519-sha512` 从默认列表减掉 buggy KEX；不再需 `-o KexAlgorithms=curve25519-sha256` workaround）。`~/.ssh/sockets/` 目录已建（ControlMaster 多路复用启用） |
| 部署路径 | `/opt/kolmatrix`（git clone from GitHub，`core.sshCommand` 锁 `~/.ssh/id_ed25519_github`） |
| 备份路径 | `/opt/kolmatrix-backups`（tripplezhou:tripplezhou 0755） |
| 日志路径 | `/var/log/pm2/kolmatrix-{out,error}.log` |
| Env 文件 | `/opt/kolmatrix/.env.production`（root:tripplezhou 0640），`.env` symlink 至此以便 `prisma.config.ts` 的 `dotenv/config` 默认读取 |
| PM2 | app 名 `kolmatrix`，instances=1 cluster，listen `localhost:3001`；systemd unit `pm2-tripplezhou.service`（enabled） |
| Nginx | `/etc/nginx/conf.d/kolmatrix.conf` — `kol.guangai.ai:443` → `upstream kolmatrix_backend (127.0.0.1:3001)`；HTTP 80 走 ACME + 301 redirect |
| TLS 证书 | Let's Encrypt `kol.guangai.ai`（`/etc/letsencrypt/live/kol.guangai.ai/`），certbot auto-renew 已装，到期 2026-07-19 |
| Postgres | 共用实例；DB 名 `kolmatrix`（**不是** `kolmatrix_prod` —— init migration `GRANT CONNECT ON DATABASE kolmatrix` 硬编码该名），角色 `kolmatrix`（superuser for migrate）+ `kolmatrix_app`（app role，RLS 生效），密码随机生成仅存 `.env.production` |
| Redis | 共用实例，db index `1`（aigcgateway 用 0） |
| GitHub Read | VPS 用 `~/.ssh/id_ed25519_github` 作 GitHub repo deploy key（id 149079790，read-only） |
| CI/CD | GitHub Actions `deploy-prod.yml` → SSH（`PROD_SSH_KEY` secret）→ `cd /opt/kolmatrix && ./scripts/deploy-prod.sh` |
| 首次 bootstrap | 2026-04-20 完成（Generator 手动 clone + npm ci + migrate + build + nginx + certbot + pm2 save + pm2 startup systemd） |

## Staging 服务器（与 prod 同 VM 上独立 PM2 instance）

| 项目 | 值 |
|---|---|
| 机型 | 同 prod 主机（共 e2-highmem-2 16GB RAM 主机的 8GB RAM 子集 — staging build 触发 OOM 阈值 ≈ 4GB Node heap，超出默认 1.6GB；prod 不受此限。BL-027-F007 修正：早期 environment 误记为 16GB） |
| 部署路径 | `/opt/kolmatrix-staging` |
| Env 文件 | `/opt/kolmatrix-staging/.env.staging`（同 prod 0640 权限） |
| PM2 | app 名 `kolmatrix-staging`，listen `localhost:3002`；systemd unit 复用 `pm2-tripplezhou.service` |
| Nginx | `/etc/nginx/conf.d/kolmatrix-staging.conf` — `staging.kol.guangai.ai:443` → `127.0.0.1:3002` |
| TLS 证书 | Let's Encrypt `staging.kol.guangai.ai`（同 certbot auto-renew） |
| Postgres | 共用 prod Postgres 实例；DB 名 `kolmatrix_staging`，**角色同 prod**（kolmatrix superuser + kolmatrix_app app role）。**密码同步协议（BL-043 lock 2026-05-06）：** kolmatrix_app role 在 prod + staging 共享同一 PG role（同实例），密码必须在 `.env.production` 和 `.env.staging` 中保持完全一致；任一文件密码与 PG 实际不一致都会触发 28P01 password authentication failed（BL-040 staging deploy run 25415574990 health 503 即此根因）。**修改 kolmatrix_app 密码 ops 步骤：** (1) 生成新随机密码 `openssl rand -hex 32`；(2) 同时改 `.env.production` 和 `.env.staging` 中 `KOLMATRIX_APP_PASSWORD=<新值>` + `DATABASE_URL` 中 `kolmatrix_app:<新值>@`；(3) 触发 prod redeploy（deploy-prod.sh ALTER ROLE 落地新密码到 PG）；(4) 触发 staging redeploy（deploy-staging.sh 验证新密码工作）；(5) BL-043 F001 fail-fast 守门确保任一 .env 缺失立即 fail（exit 1 + multi-line error），不再 silent skip。**ALTER ROLE 模式：** sudo psql + unix socket peer auth（v0.9.13 §5.1 sediment + BL-024-F007 retroactive；非 PGPASSWORD over TCP）。详见下方「Postgres kolmatrix_app role 密码 sync 协议」5 处一致表 |
| Redis | 共用 prod Redis 实例，db index `2`（aigcgateway 0 / prod 1 / staging 2）；`.env.staging` 必含 `REDIS_URL=redis://localhost:6379/2`（BL-020-F005 部署时由 Generator SSH 落地，备份 `.env.staging.bak.bl020-f005`） |
| Health URL | `https://staging.kol.guangai.ai/api/health` |

### Postgres kolmatrix_app role 密码 sync 协议（BL-043 lock 2026-05-06）

| # | 文件 / 资源 | 字段 | 必须一致 |
|---|-------------|------|---------|
| 1 | `/opt/kolmatrix/.env.production` | `KOLMATRIX_APP_PASSWORD` | ✓ |
| 2 | `/opt/kolmatrix/.env.production` | `DATABASE_URL`（`kolmatrix_app:PWD@...`）| ✓ |
| 3 | `/opt/kolmatrix-staging/.env.staging` | `KOLMATRIX_APP_PASSWORD` | ✓ |
| 4 | `/opt/kolmatrix-staging/.env.staging` | `DATABASE_URL`（`kolmatrix_app:PWD@...`）| ✓ |
| 5 | Postgres `kolmatrix_app` role | `password` | ✓ |

修改任一字段必须同步全部 5 处。`deploy-{prod,staging}.sh` ALTER ROLE 自动落地 (3) → (5)（自 staging deploy；自 prod deploy 落地 prod 路径）；(1)(2)(3)(4) 由用户 ops 手工保持一致。BL-043 F001 fail-fast 在 deploy 入口立即 surface 缺失（任一 `.env` 缺 `KOLMATRIX_APP_PASSWORD` 即 exit 1，不再 silent skip）。

### Staging build OOM 兜底（NODE_OPTIONS 必带）

> **BL-027-F007 修正（S10）：** staging RAM 8GB（不是 16GB）。Node 默认 old-space ≈ 1.6GB，`npm run build` 在 staging 会 OOM。SSH 部署时 build 步骤必须带 `NODE_OPTIONS=--max-old-space-size=4096`：

```bash
NODE_OPTIONS='--max-old-space-size=4096' GIT_SHA=$(git rev-parse --short HEAD) npm run build
```

`framework/harness/deploy-patterns.md §3.2 step 6` 已固化此命令；本节是给读者的"为什么必须这么写"解释。Prod 的 16GB RAM 不受此限制，但同样写带 NODE_OPTIONS 的命令是无害的。

## apify-kol service（同 VM 共生，BL-012-F012 lock 2026-05-09）

- **项目位置：** `/opt/apify-kol-service`（fork 自 `guang-tech/apify`）
- **入口：** docker compose（同 VM 容器）
- **Host port：** `3003`（容器内 `3000`，sed workaround 将 docker-compose.yml `3000:3000` 改为 `3003:3000`，详 `docs/dev/kol-sync-runbook.md` §"apify-kol-service fork 同步流程"）
- **Postgres port：** `15432`（容器化 PG 独立实例，与 KOLMatrix 共用 VM 的 PG 隔离；fork 端自带 schema 与 KOLMatrix Prisma schema 完全独立）
- **TIKHUB_TOKEN：** 由爬虫团队提供，存 `/opt/apify-kol-service/.env`，KOLMatrix 不读
- **BUSINESS_API_KEY：** read-only 业务侧 key，KOLMatrix `x-api-key` header 用此值（同步到 KOLMatrix `.env.{production,staging}` 的 `APIFY_KOL_BUSINESS_API_KEY`）
- **ADMIN_API_KEY：** 创建 schedules / 账户管理用，KOLMatrix 侧不需要（仅 Planner 偶发 SSH ops 用）
- **月度 paid balance 监控：** TikHub 子计费 + Apify 子计费由爬虫团队的 dashboard 看；KOLMatrix 侧无监控钩子（如需调用 `/admin/stats` 需 ADMIN key）
- **Stage 1.5 admin preview 入口：** KOLMatrix 端 `/[locale]/admin/apify-preview` (要求 admin role)，背后调本 service 的 `GET /kol`，read-only 不入 KOLMatrix DB（spec §2.2 数据流隔离铁律）
- **Stage 2 daily sync 集成：** KOLMatrix `scripts/kol-sync-daily.ts` 注入 `ApifyKolSyncAdapter`，与 YouTube adapter 双源容灾（详 `docs/dev/kol-sync-runbook.md` §"双 adapter 双源容灾"）
- **同步 ops 流程：** fork 端有更新时按 runbook §"apify-kol-service fork 同步流程" 6 步走（B 方案 reset + 重 apply 2 sed workaround）
- **5 个长期 todo：** 见 BL-058 backlog（lockfile / port / X service 实装 / docs union shape / admin route X enum）

## 扩容信号

- RAM 接近 14GB、CPU 持续 >70%、或 KOL 采集 worker 影响 aigcgateway 响应时，拆独立 VM。

## 测试账号

> **2026-04-24 安全轮换：** prod 两账户密码已从 seed 默认值轮换为随机值，保存于用户密码管理器，本记忆文件**不记录**密码明文。Staging 现用 `KOLMatrix@2026!`（demo only，无真实数据；BL-035-F001 把 auth credentials min 从 1 升到 12 后旧的 `KOLM@2026!` 10 字符已无法登录）。seed.ts 默认密码同步升级为 `KOLMatrix@2026!`（15 chars），仅 staging/local 用；prod **必须**在首次 deploy 后立即轮换（BM1.1 security-polish BI-F001 改为读 env var）。

- **Admin（prod）:** `admin@kolmatrix.local` / 密码见用户密码管理器（2026-04-24 rotated）/ API Key: `TBD`
- **Marketer（prod）:** `marketer@kolmatrix.local` / 密码见用户密码管理器（2026-04-24 rotated）/ API Key: `TBD`
- **Admin（staging / local）:** `admin@kolmatrix.local` / `KOLMatrix@2026!` / API Key: `TBD`
- **Marketer（staging / local）:** `marketer@kolmatrix.local` / `KOLMatrix@2026!` / API Key: `TBD`

## VPS env 文件当前 secrets 状态（2026-04-23 Planner 验证）

| Key | `/opt/kolmatrix/.env.production` | `/opt/kolmatrix-staging/.env.staging` | 备注 |
|---|---|---|---|
| `AIGCGATEWAY_API_KEY` | ✅ 已配（67 chars） | ✅ 已配（同 key） | 共用 "admintest" key；2026-04-23 从 staging VM 直 curl `/v1/models` 200 OK；完整 key 不落 git，仅存 .env 文件 |
| `RESEND_API_KEY` | ✅ 已配（36 chars） | ✅ 已配（同 key） | 未在本次验证真发邮件，仅确认非 placeholder；完整 key 不落 git |
| `APIFY_KOL_BASE_URL` | ⏳ 部署时落入（`http://localhost:3003`） | ⏳ 同 prod | BL-012-F012 落地。同 VM 共生 service，走内网；外网可用 https `apify.kol.guangai.ai` 但当前不暴露。两 env 文件都必须配齐，否则 `kol-sync-daily.ts` 中 apify-kol adapter 静默 skip（YouTube 仍跑） |
| `APIFY_KOL_BUSINESS_API_KEY` | ⏳ 部署时落入（同 fork 端 `BUSINESS_API_KEY`） | ⏳ 同 prod | BL-012-F012 落地。来自 `/opt/apify-kol-service/.env` `BUSINESS_API_KEY`；KOLMatrix 仅用 read API（`x-api-key` header），不需 `ADMIN_API_KEY` |

**修改流程（如未来需要换 key）：**
```bash
ssh tripplezhou@34.180.93.185
sudo vi /opt/kolmatrix-staging/.env.staging   # 或 /opt/kolmatrix/.env.production
pm2 reload kolmatrix-staging --update-env     # 或 pm2 reload kolmatrix --update-env
```

**Prod DB 当前数据状态（2026-05-04 audit 后修正）：**
- `npm run db:seed` 仍**未跑**（系统种子模板 / Admin / Sarah Chen 等基础数据缺失）
- 但 prod DB **已含业务数据**：5 个用户创建的 Product（Clash Royale / Pokemon Go / PUBG Mobile / Genshin Impact / Honor of Kings 全 tenant `2b1d...3d5`），Asset 表 26 条 ai_generated 邮件 + video_script（来自 BL-025 Wizard 路径 + BL-030 KB→Asset backfill），EmailTemplate 表 17 条 user-type 镜像（dual-write），Campaign / Kol_campaign 等关联表对应数据；BL-031 SQL ops 镜像 1 行 + BL-032 backfill 25 行 bracket→mustache 已合并入此体系

**对外邀请客户前必须澄清：** 当前 prod DB ≠ "干净空壳"，含部分用户既有数据 + backfill 修复。如要给真客户进 demo，建议：
1. 跑 `db:seed` 补足系统模板（10 system_seed email 已在 — 由 BL-025 migration 写入；其它种子如 Sarah Chen 等仍缺）
2. 决定是否清掉现 5 个 tenant 的"内部测试"数据（如不影响真客户隔离则保留）

```bash
# 运行 seed（幂等，upsert + 自然键，不会破坏现有 tenant 数据）
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix && npm run db:seed'
```

## 部署触发方式（F003 DoD）

- **workflow**：`.github/workflows/deploy-prod.yml`（workflow_dispatch，inputs: `ref` / `skip_backup`）
- **首次 DoD 验证步骤**：GitHub UI → Actions → "Deploy to Production" → Run workflow → 5-10 分钟内 `curl https://kol.guangai.ai/api/health` 的 `git_sha` 等于 `github.sha`
- 手动 fallback + 回滚：见 `docs/dev/deployment-runbook.md`

<!-- 写入规则：由 Planner 统一维护，环境变更后及时更新。账号密码避免明文，必要时引用 secret manager。 -->
