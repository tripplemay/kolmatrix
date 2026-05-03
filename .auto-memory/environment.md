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
| Postgres | 共用 prod Postgres 实例；DB 名 `kolmatrix_staging`，角色同 prod（kolmatrix + kolmatrix_app） |
| Redis | 共用 prod Redis 实例，db index `2`（aigcgateway 0 / prod 1 / staging 2） |
| Health URL | `https://staging.kol.guangai.ai/api/health` |

### Staging build OOM 兜底（NODE_OPTIONS 必带）

> **BL-027-F007 修正（S10）：** staging RAM 8GB（不是 16GB）。Node 默认 old-space ≈ 1.6GB，`npm run build` 在 staging 会 OOM。SSH 部署时 build 步骤必须带 `NODE_OPTIONS=--max-old-space-size=4096`：

```bash
NODE_OPTIONS='--max-old-space-size=4096' GIT_SHA=$(git rev-parse --short HEAD) npm run build
```

`framework/harness/deploy-patterns.md §3.2 step 6` 已固化此命令；本节是给读者的"为什么必须这么写"解释。Prod 的 16GB RAM 不受此限制，但同样写带 NODE_OPTIONS 的命令是无害的。

## 扩容信号

- RAM 接近 14GB、CPU 持续 >70%、或 KOL 采集 worker 影响 aigcgateway 响应时，拆独立 VM。

## 测试账号

> **2026-04-24 安全轮换：** prod 两账户密码已从 seed 默认值轮换为随机值，保存于用户密码管理器，本记忆文件**不记录**密码明文。Staging 仍用 `KOLM@2026!`（demo only，无真实数据）。seed.ts 使用的 `KOLM@2026!` 是 staging/local 用；prod **必须**在首次 deploy 后立即轮换（BM1.1 security-polish BI-F001 改为读 env var）。

- **Admin（prod）:** `admin@kolmatrix.local` / 密码见用户密码管理器（2026-04-24 rotated）/ API Key: `TBD`
- **Marketer（prod）:** `marketer@kolmatrix.local` / 密码见用户密码管理器（2026-04-24 rotated）/ API Key: `TBD`
- **Admin（staging / local）:** `admin@kolmatrix.local` / `KOLM@2026!` / API Key: `TBD`
- **Marketer（staging / local）:** `marketer@kolmatrix.local` / `KOLM@2026!` / API Key: `TBD`

## VPS env 文件当前 secrets 状态（2026-04-23 Planner 验证）

| Key | `/opt/kolmatrix/.env.production` | `/opt/kolmatrix-staging/.env.staging` | 备注 |
|---|---|---|---|
| `AIGCGATEWAY_API_KEY` | ✅ 已配（67 chars） | ✅ 已配（同 key） | 共用 "admintest" key；2026-04-23 从 staging VM 直 curl `/v1/models` 200 OK；完整 key 不落 git，仅存 .env 文件 |
| `RESEND_API_KEY` | ✅ 已配（36 chars） | ✅ 已配（同 key） | 未在本次验证真发邮件，仅确认非 placeholder；完整 key 不落 git |

**修改流程（如未来需要换 key）：**
```bash
ssh tripplezhou@34.180.93.185
sudo vi /opt/kolmatrix-staging/.env.staging   # 或 /opt/kolmatrix/.env.production
pm2 reload kolmatrix-staging --update-env     # 或 pm2 reload kolmatrix --update-env
```

DB 已 seed？**未**。prod DB 是空壳（迁移已 apply，无业务数据）。首次登录 flow 依赖 Sarah Chen / Admin 种子；真正上线时：
```bash
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix && npm run db:seed'
```
（幂等：用 upsert + 自然键）

## 部署触发方式（F003 DoD）

- **workflow**：`.github/workflows/deploy-prod.yml`（workflow_dispatch，inputs: `ref` / `skip_backup`）
- **首次 DoD 验证步骤**：GitHub UI → Actions → "Deploy to Production" → Run workflow → 5-10 分钟内 `curl https://kol.guangai.ai/api/health` 的 `git_sha` 等于 `github.sha`
- 手动 fallback + 回滚：见 `docs/dev/deployment-runbook.md`

<!-- 写入规则：由 Planner 统一维护，环境变更后及时更新。账号密码避免明文，必要时引用 secret manager。 -->
