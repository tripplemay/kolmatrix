# BL-PROD-MIGRATE-DEPLOYSVR — KOLMatrix 生产环境迁移到 deploysvr

- **批次类型：** 混合批次（generator 代码 + ops 割接 + codex 验收）
- **状态：** planning → building
- **创建：** 2026-07-12（Planner: Kimi）
- **role_assignments：** planner=Kimi(cli) / generator=Kimi(cli) / evaluator=Reviewer(codex)
- **前置：** BL-117 已 done（用户 2026-07-12 手工关闭）——满足 backlog 决策 C
- **参考模板：** 姊妹项目 aigcgateway 已于 2026-07-12 迁往**同一台 deploysvr**，其 `docs/ops/deploysvr-migration-runbook.md` + spec 为已实操验证的剧本，本批次对标改写。

---

## 1. 背景与目标

旧生产 VPS（GCP e2，`34.180.93.185`，东京，7.8GB）即将退役。将 **KOLMatrix** 生产环境迁到 `deploysvr`（`194.238.26.173`，Ubuntu 24.04，4 vCPU / 7.8 GB / 145 GB，SSH 别名 `deploysvr`，key `~/.ssh/kolmatrix_new`）。

aigcgateway 已迁到 deploysvr（容器化），本迁移是**旧机整机退役的最后一块拼图**。迁移后 KOLMatrix 与 aigcgateway 仍同机共存（KOLMatrix 调 aigcgateway 走公网 `https://aigc.guangai.ai`，本就如此，见 §2.1）。

## 2. 现状调查（2026-07-12 只读探测已核实）

### 2.1 旧生产（源）
- 运行方式：**原生 PM2** — prod cluster×2（`kolmatrix`，port 3001）+ staging fork×1（`kolmatrix-staging`，port 3002），已跑 21 天。部署路径 `/opt/kolmatrix`，用户 `tripplezhou`。
- 数据库：共享原生 PostgreSQL（**17.x**，与 aigc 同实例），库 `kolmatrix` **432 MB** / `kolmatrix_staging` 222 MB（体量小，dump/restore <2 min）。**含 pgvector 扩展**（embeddings / 语义搜索）。**双角色：** `kolmatrix`（superuser，migrate 用）+ `kolmatrix_app`（app role，RLS 生效）。
- Redis：共享实例，db index prod=1 / staging=2（aigc=0）。内容为缓存/限流/BullMQ 队列，非持久业务数据。
- 反代/TLS：nginx + Certbot（HTTP-01），`kol.guangai.ai:443` → `127.0.0.1:3001`；另有 `kolquest.com` 301 redirect 块 + `staging.kol.guangai.ai`。
- **aigcgateway 依赖走公网：** 实测 `.env.production` `AIGCGATEWAY_BASE_URL=https://aigc.guangai.ai`（**非**记忆所载内网 `localhost:3099`）→ 迁移后零改动、零内网耦合。
- **唯一真内网依赖：** `APIFY_KOL_BASE_URL=http://localhost:3004`（apify-kol-service，KOL 采集），且旧机上该 service **现正 crash-loop（Restarting）**。
- **需原样迁移的 secrets（键名，值从旧机 `.env.production` 读取，禁写入仓库）：**
  `NEXTAUTH_SECRET` / `AUTH_SECRET`（会话/认证，不一致则全体登出）、`KOLMATRIX_APP_PASSWORD` + `DATABASE_URL` 内 `kolmatrix_app` 密码（BL-043 五处一致协议，不一致触发 28P01）、`AIGCGATEWAY_API_KEY`、`RESEND_API_KEY`、`APIFY_KOL_BUSINESS_API_KEY`、`YOUTUBE_API_KEY`、全部 `AIGCGATEWAY_*_ACTION_ID`。

### 2.2 新目标 deploysvr（目标，2026-07-12 只读探测）
- 现状健康：**used 1.4G / avail 6.4G，无 swap**；磁盘 12G/133G。已跑 aigcgateway（app+pg+redis 344MB）+ grandtianfu（162MB）+ invoce（406MB）。KOLMatrix 全栈运行态 ~1.5–2G 可舒适容纳。
- 已有成熟容器化范式：aigcgateway/grandtianfu/invoce 均 GHCR 预构建镜像 + 容器绑 `127.0.0.1` loopback + host nginx 反代。参照 `/opt/apps/aigc-gateway/docker-compose.prod.yml`（同技术栈最近）。
- 端口占用：aigc pg 发布在 `127.0.0.1:5432`、redis `127.0.0.1:6379`、app `127.0.0.1:3000`；invoce pg/redis 不发布 host。**KOLMatrix 的 pg/redis 一律不发布 host 端口**（仅 compose 内网），app 绑一个空闲 loopback 端口（如 `127.0.0.1:3001`）。
- Certbot 已装（aigc 迁移时装了 DNS-01 + Cloudflare token `/root/.secrets/cloudflare.ini`），可复用。
- GHCR owner：`ghcr.io/tripplemay/kolmatrix/...`（remote = github.com/tripplemay/kolmatrix）。

### 2.3 拓扑决策（直连模型，对齐 aigc）
```
用户 → Cloudflare DNS kol.guangai.ai (+ kolquest.com 301) → 194.238.26.173(deploysvr 公网)
     → deploysvr host nginx :80/:443 (Certbot DNS-01 via Cloudflare)
     → 127.0.0.1:3001 (kolmatrix app 容器)
     → pgvector 容器 + redis:7 容器（compose 内网，不发布 host 端口）
     → BullMQ worker（app 内进程）+ cron（host cron 调 docker compose exec）
外调：AI → https://aigc.guangai.ai（公网，同机 aigc）；邮件 → Resend；KOL 采集 → apify-kol(localhost:3004，随迁)
```

## 3. 硬约束（必须专门处理）

- **H1 kolmatrix_app 密码五处一致（红线，BL-043）：** `.env` 内 `KOLMATRIX_APP_PASSWORD` + `DATABASE_URL` 密码 + PG 实际 role 密码必须一致，否则 28P01。migrate 服务须 `ALTER ROLE kolmatrix_app WITH PASSWORD` 落地。
- **H2 认证 secrets 一致性：** `NEXTAUTH_SECRET`/`AUTH_SECRET` 逐字沿用旧机，否则全体用户会话失效（非数据破坏，但体验断裂）。
- **H3 pgvector 扩展：** postgres 容器必须用 `pgvector/pgvector` 镜像（匹配旧机 PG major，预计 17.x，实操前 SSH 确认），restore 前 `CREATE EXTENSION IF NOT EXISTS vector`，否则含 vector 列的表 restore 失败、语义搜索崩。
- **H4 双角色 + RLS 还原：** 角色是 cluster 级不随单库 dump 迁移。新 pg 容器 init 须先建 `kolmatrix_app` role（+ GRANT + RLS），再 `pg_restore --no-owner`，保证 RLS 策略与 app role 生效。
- **H5 永不在 deploysvr 本地 build（红线）：** 7.8GB 无 swap，`npm run build` 需 ~4GB heap 会撑爆整机（正是 BL-117 事故）。镜像**必须 CI 构建推 GHCR**，deploysvr 只 `docker compose pull`。
- **H6 不可逆步骤门禁：** 数据终态同步、DNS 切换、旧机停写为不可逆操作，执行时需用户显式 go/no-go。
- **H7 apify-kol 先行：** KOLMatrix app 依赖内网 `localhost:3004`，apify-kol-service 必须在 KOLMatrix prod 割接前先在 deploysvr 起好（且修复 crash-loop）。

## 4. 设计决策

- **D1 部署模型：** 容器化 GHCR-pull（H5 红线）。新写 `Dockerfile`（Next.js standalone 多阶段）；**弃用/保留仓库现有 dev `docker-compose.yml`**（仅本地开发用），新写 deploysvr 专用 `docker-compose.prod.yml`。
- **D2 Next standalone + HOSTNAME 修复：** `next.config.ts` 加 `output: "standalone"`。**compose app.environment 设 `HOSTNAME=0.0.0.0`**——aigc 迁移实测踩过：standalone 默认绑 `$HOSTNAME`(容器 ID) → 容器内 127.0.0.1 不监听、healthcheck 卡 starting。
- **D3 compose 结构（对标 invoce/aigc）：** `app`(绑 `127.0.0.1:3001:3001`) + `postgres`(pgvector 镜像) + `redis:7-alpine` + 一次性 `migrate` 服务；GHCR 镜像 `ghcr.io/tripplemay/kolmatrix/app:${IMAGE_TAG}`；pg/redis 命名卷持久化；**pg/redis 不发布 host 端口**；`env_file: .env`（不入仓，600）。
- **D4 Prisma 迁移 + 角色初始化（容器模型，H1/H3/H4）：** standalone runner 无 prisma CLI → 新增含全量依赖 + schema 的 **migrate 镜像**（`ghcr.io/tripplemay/kolmatrix/migrate`）或 compose 一次性 `migrate` 服务。部署流程「先 migrate 后起 app」：(a) `CREATE EXTENSION vector`；(b) `prisma migrate deploy`（as kolmatrix superuser）；(c) `ALTER ROLE kolmatrix_app WITH PASSWORD` 从 env 落地。pg 容器 init 脚本建 `kolmatrix_app` role + DB `kolmatrix`。
- **D5 CI/CD 改造：** 新增 `build-push.yml`（`main` push → build app + migrate 镜像 → 推 `ghcr.io/tripplemay/kolmatrix/{app,migrate}:<git-sha>+:latest`，`packages: write`）；改写 `deploy-prod.yml`：`workflow_dispatch` → SSH deploysvr → `cd /opt/apps/kolmatrix` → 设 `IMAGE_TAG` → `docker compose pull` → migrate → `up -d` → 健康检查 `curl -sf http://127.0.0.1:3001/api/health`。GitHub secrets 更新清单：`PROD_HOST=194.238.26.173`/`PROD_USER=root`/`PROD_SSH_KEY`(deploysvr 私钥)，标注旧值 `34.180.93.185` 作回滚。`ci.yml` 不回归。**staging 相关（deploy-staging.yml / seed-prod.yml）标注 deprecated**（决策 A 弃用 staging）。
- **D6 入口 nginx：** 仓库维护 `deploy/nginx/kolmatrix.conf`（host nginx `sites-available` → `sites-enabled` 软链），公网 `listen 80`+`443 ssl http2`，`server_name kol.guangai.ai`，`proxy_pass http://127.0.0.1:3001`；websocket upgrade（复用 aigc 的 `00-http-upgrade-map.conf`）；复刻旧机安全头。**外加 `kolquest.com` 301 redirect server 块**（旧机现有，随迁）。与既有 aigc/grandtianfu/invoce 块监听不冲突。
- **D7 TLS：** 复用 deploysvr certbot + Cloudflare DNS-01 token，**预签发** `kol.guangai.ai`（+ `kolquest.com`）证书，DNS 切换零空窗。
- **D8 BullMQ worker + cron：** worker 随 app 容器内进程起（现 PM2 cluster 模型 → 容器内同进程）；cron（`kolmatrix-kpi-snapshot` 00:30 UTC + `kolmatrix-backup-retention`）改 **host `/etc/cron.d/` 调 `docker compose exec app node ...`**，deploy 脚本自愈重建（对齐旧机 deploy-prod.sh step8b 抗 reset）。
- **D9 apify-kol-service 随迁（决策 B，H7）：** 把 apify-kol-service docker 栈（自带 postgres:15432）搬到 deploysvr，先诊断修复其 crash-loop，KOLMatrix 继续走内网 `localhost:3004`。KOLMatrix 侧**无代码改动**（纯 server ops）。
- **D10 Redis 弃旧起新：** 缓存/限流/BullMQ 队列，非持久业务。新栈起空 Redis。割接前 `redis-cli --scan` 确认旧机无持久业务 key。
- **D11 回滚控制：** 旧机 KOLMatrix API 停写但数据冻结 + PM2 可快速拉起；旧 nginx/DNS/`PROD_HOST` 回滚点留存；镜像 TAG 回滚命令记录。观察期内不退旧机。

## 5. Feature 分解

### F-MIG-01（generator）— 容器化部署基座 + 入口配置（代码）
- `next.config.ts` 加 `output: "standalone"`（D2）。
- 新增 `Dockerfile`（standalone 多阶段）+ `.dockerignore`。
- 新增 `docker-compose.prod.yml`（D3/D4）：app(`127.0.0.1:3001`, `HOSTNAME=0.0.0.0`) + postgres(pgvector) + redis:7 + 一次性 migrate；pg/redis 不发布 host；命名卷；`env_file: .env`。
- 新增 `.env.production.example`（deploysvr 版，仅键名占位，**禁真值**）：`DATABASE_URL`(容器内 `postgres:5432`)、`REDIS_URL`(`redis:6379/1`)、`NEXTAUTH_SECRET`/`AUTH_SECRET`/`KOLMATRIX_APP_PASSWORD`、`AIGCGATEWAY_BASE_URL`/`AIGCGATEWAY_API_KEY`、`RESEND_API_KEY`、`APIFY_KOL_BASE_URL`/`APIFY_KOL_BUSINESS_API_KEY`、`YOUTUBE_API_KEY`、全部 `AIGCGATEWAY_*_ACTION_ID`、`NEXTAUTH_URL=https://kol.guangai.ai`。
- migrate 路径（D4）：pg init 建 `kolmatrix_app` role + `CREATE EXTENSION vector`；migrate 服务跑 `prisma migrate deploy` + `ALTER ROLE kolmatrix_app`。
- 新增 `deploy/nginx/kolmatrix.conf`（D6）：kol.guangai.ai 反代 + kolquest.com 301 + 安全头 + ws upgrade。
- cron 容器化脚本/文档（D8）。
- **不改** 任何 `src/**` 产品代码。`npx tsc --noEmit` + `npm run build` PASS；独立 commit。

### F-MIG-02（generator）— CI/CD 管道改造
- 新增 `build-push.yml`：`main` push → build app + migrate 镜像 → 推 GHCR（`packages: write`）。
- 改写 `deploy-prod.yml`：SSH deploysvr → `docker compose pull` → migrate → `up -d` → 健康检查 `/api/health`。
- 文档化 GitHub secrets 更新清单（D5），标注 `PROD_HOST` 旧值作回滚；`deploy-staging.yml`/`seed-prod.yml` 标 deprecated。
- `ci.yml` 不回归。独立 commit。

### F-MIG-03（generator/ops）— apify-kol-service 随迁 deploysvr（D9/H7）
- 把 apify-kol-service docker 栈（含 postgres:15432）迁到 deploysvr；诊断修复旧机现有 crash-loop。
- 落位 `/opt/apify-kol-service`（或 deploysvr 惯例路径）；`.env`（TIKHUB/APIFY/BUSINESS/ADMIN token 从旧机原样迁，禁入仓）；host 端口 `3004:3003` 供 KOLMatrix 内网调用。
- 验证 `curl http://localhost:3004/health` + 一次 read `GET /kol`。KOLMatrix 侧无代码改动。
- 交付：apify-kol 在 deploysvr 稳定运行的实操记录（写入 runbook）。

### F-MIG-04（generator/ops）— 迁移 runbook + 生产割接实操（P0–P6，受监督，H6 门禁）
- 新增 `docs/ops/deploysvr-kol-migration-runbook.md`（对标 aigc runbook），含 P0 准备 / P2 起新栈+灌快照演练+loopback 冒烟 / 🔴P3 数据终态同步(停旧写→pg_dump→clean restore→逐表 parity) / 🔴P4 边缘割接(Certbot DNS-01 预签→装 nginx→Cloudflare A 切→更新 secrets) / P5 观察期+回滚就绪 / 🔴P6 退役门禁。
- 按 runbook 执行 P0–P5 受监督实操；**H6 三个不可逆门禁执行前取得用户显式 go/no-go**。
- 割接完成回写 runbook「Live state / Verified parity / Rollback controls」实测值。

### F-MIG-05（codex/evaluator）— 验收 signoff
前置：F-MIG-01~04 完成、新栈已割接。
- 冒烟：`https://kol.guangai.ai` 公网 → `/api/health`(db/redis ok) + 登录(prod 账号) + AI 邮件定制(验 aigcgateway 公网调用) + 一条 KOL 流程(discovery/detail，验 apify localhost:3004) + 发一封邮件(验 Resend + BullMQ)。
- 数据 parity：新库关键表行数与旧库一致；抽查 RLS 多租户隔离生效（kolmatrix_app role）。
- 直连可达 + TLS 有效 + 5 locale 抽查。
- 回滚演练可行性（不真正回滚）。
- 输出 `docs/test-reports/BL-PROD-MIGRATE-DEPLOYSVR-signoff-YYYY-MM-DD.md`，含命令/日志证据 + PASS/FAIL。

## 6. 验收标准（总）
1. `https://kol.guangai.ai` 直连 deploysvr，证书有效，控制台 + API 全可用，5 locale 正常。
2. 登录/会话正常（NEXTAUTH/AUTH secrets 迁移正确）；RLS 多租户隔离生效（kolmatrix_app）。
3. AI 邮件定制/推荐正常（走公网 aigcgateway）；发邮件成功（Resend + BullMQ worker）。
4. KOL 采集链路通（apify-kol 在 deploysvr localhost:3004 可达 + daily sync 可跑）。
5. 数据 parity 通过（新旧库关键表一致，432MB 全量迁移）。
6. push-to-deploy 管道可用（GHCR 构建 → pull/up → 健康检查绿）。
7. 回滚控制齐备，旧机观察期保持可回退。

## 7. 回滚方案
- **流量回滚：** Cloudflare `kol.guangai.ai`(+kolquest) A 记录改回 `34.180.93.185`；GitHub `PROD_HOST` 改回旧值；旧机 `pm2 start kolmatrix`（若已停）。
- **镜像回滚（新机内）：** `IMAGE_TAG=<上个 good sha> docker compose up -d`。
- P3 后旧机 DB 冻结不写作一致性回退点 → 回滚无丢数据窗口（故回滚决策须尽早）。

## 8. 风险与门禁
- **R1** kolmatrix_app 密码五处不一致 → 28P01 全站 DB 认证失败。缓解：H1 + migrate ALTER ROLE + restore 后立即验证。
- **R2** pgvector 缺失 → restore 失败/语义搜索崩。缓解：H3 pgvector 镜像 + CREATE EXTENSION。
- **R3** 本地 build 撑爆 7.8GB 无 swap 整机（BL-117 事故重演）。缓解：H5 红线，CI 构建镜像，机上只 pull；可选加 swapfile 兜底。
- **R4** apify-kol crash-loop 未修/迁移失败 → KOL 采集断。缓解：F-MIG-03 先行 + 修复验证。
- **R5** NEXTAUTH/AUTH secrets 不一致 → 全体登出。缓解：H2 逐字迁移。
- **R6** DNS/割接不可逆。缓解：H6 门禁 + D11 回滚控制 + 观察期。
- **R7** 公网 80/443 provider 防火墙。缓解：P0 验证 inbound（aigc 迁移已验证 deploysvr 80/443 可达，低风险）。
- **R8** 决策 A 弃 staging → 无 pre-prod 环境。缓解：P2 在 deploysvr 起新栈 + 灌旧库快照做**演练**(rehearsal) 充当 pre-prod 验证，旧机不受影响。
