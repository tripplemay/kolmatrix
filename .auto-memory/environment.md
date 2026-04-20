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
- **KOLMatrix API Key：** `TBD`（B2 启动前由用户在 aigcgateway 控制台生成 pk_xxx，分 dev/prod 两份）
- **月预算：** $100 USD（B2-B4 初期）
- **Actions 清单（B2 spec 阶段创建）：** `kol-eval-bulk` / `kol-eval-precision` / `kol-campaign-match` / `email-personalize`
- **集成决策：** 见 ADR-009

## 生产服务器（与 aigcgateway 共机）

| 项目 | 值 |
|---|---|
| 机型 | e2-highmem-2（2 vCPU，16GB RAM） |
| 地区 | asia-northeast1-b（东京） |
| 外网 IP | `34.180.93.185` |
| 主机名 | `instance-20260403-154049` |
| SSH | `ssh tripplezhou@34.180.93.185`（sudo passwordless） |
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

## 扩容信号

- RAM 接近 14GB、CPU 持续 >70%、或 KOL 采集 worker 影响 aigcgateway 响应时，拆独立 VM。

## 测试账号

- **Admin:** `admin@kolmatrix.local` / `KOLM@2026!` / API Key: `TBD`
- **Marketer:** `marketer@kolmatrix.local` / `KOLM@2026!` / API Key: `TBD`

## VPS `.env.production` 待补 secrets（bootstrap 时占位 `TBD-set-later-via-pm2-reload`）

- `AIGCGATEWAY_API_KEY` — B2 启用 aigcgateway 调用前由用户从 aigcgateway 控制台生成 `pk_xxx`，`ssh + sudo vi .env.production` 改完 `pm2 reload kolmatrix --update-env` 即生效
- `RESEND_API_KEY` — B4 启用邮件前同上流程

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
