# Deploy Patterns（框架沉淀）

> 跨批次通用的生产部署 / 运行时进程管理 / 反向代理模式。Planner 在写涉及 deploy / PM2 / process management / nginx 的 spec 时必读。

---

## 1. PM2 cluster zero-downtime reload 的 3 个必要条件

### 1.1 坑

`pm2 reload` 做到"零丢包"**不是** "cluster mode + instances ≥ 2" 自动拥有的能力。常见的错误假设（BI2 Planner v1 犯过）：

> "PM2 cluster 会 hijack `listen` 调用，let master 代为分发端口；两个 instance 滚动替换即 zero-downtime。"

这只在"worker 进程是 PM2 的直接子进程 + app 主动发 ready 信号"时成立。KOLMatrix BI2-F002 两轮实测证伪该假设：

- **Round A**: `script: "npm", args: "start"` + `instances: 2` → `npm` 是 PM2 直接子进程，但 `npm` 再 spawn 孙子 `next`；`cluster` 模块只 hook 直接子进程的 `listen()`，孙子 `server.listen(3001)` 直接走 OS 端口 → **EADDRINUSE crash loop 116×**
- **Round A'**: `script: "node_modules/next/dist/bin/next"` 直连 + `instances: 2`（绕过 npm 双层进程）→ cluster hook 生效，两 worker 稳定，但 **60× curl + reload 只有 56/60 = 93%**（4× 超时），原因：没有 `process.send('ready')` 信号，PM2 走 `listen_timeout` 默认 3s 估算，new/old worker 切换窗口重叠 2-3s

### 1.2 真正 zero-downtime 的 3 个必要条件

**条件 1 — worker 是 PM2 直接子进程：**

不能用 `npm start` / `yarn start` / shell wrapper 脚本。PM2 fork/spawn 出来的**第一层**进程必须就是 app 进程。

**条件 2 — app 主动发 `process.send('ready')` 信号：**

在 `server.listen(port, callback)` 的 callback 里发 ready。PM2 靠这个信号精确感知"新 worker 已 accept 连接"，才去 SIGTERM 老 worker。没有此信号，PM2 只能用 `listen_timeout` 做超时估算，切换窗口重叠。

**条件 3 — `ecosystem.config.js` 配 `wait_ready: true` + 合理 `listen_timeout`：**

```js
{
  name: 'app',
  script: 'server.js',        // 条件 1：直接 JS 入口
  exec_mode: 'cluster',
  instances: 2,
  wait_ready: true,            // 条件 3：告诉 PM2 必须等 ready 信号
  listen_timeout: 10000,       // 10s 上限，Next cold start ~450ms 绰绰有余
  kill_timeout: 5000,          // SIGTERM 后给 drain in-flight 请求 5s
}
```

### 1.3 Next.js 生产部署的唯一可靠路径

对 Next.js `production build`，**唯一**同时满足 3 个条件的方式是 custom `server.js`：

```js
// server.js (~22 行)
const { createServer } = require("node:http");
const next = require("next");

const port = Number(process.env.PORT) || 3001;
const hostname = process.env.HOSTNAME || "0.0.0.0";
const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  server.listen(port, hostname, () => {
    console.log(`[server] listening on ${hostname}:${port}`);
    if (process.send) {
      process.send("ready");   // ← 条件 2：ready 信号
    }
  });

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.once(sig, () => {
      console.log(`[server] ${sig} received, closing connections`);
      server.close(() => process.exit(0));
    });
  }
});
```

该方式不失去任何 Next.js 特性（middleware / instrumentation.ts / app router / React 19 / server actions 全兼容）。丢失的只有 Turbopack dev 优化（dev 不用 server.js，跑 `next dev`）。

### 1.4 Planner spec 起草期检查清单

涉及 PM2 deploy 的 spec（BI2 F002 / BI3 F003 staging / B5+ worker 进程等），Planner **必须**核对：

- [ ] `script:` 是否指向**可执行 JS 文件**（非 `npm` / `yarn` / shell wrapper）？
- [ ] app 代码里是否有 `if (process.send) process.send('ready')`？（custom server 或 instrumentation.ts）
- [ ] `ecosystem.config.js` 是否配 `wait_ready: true`？
- [ ] `listen_timeout` 是否与 app 实际冷启动时间匹配（prod Next.js ~500ms，设 10s 有余量）？
- [ ] `kill_timeout` 是否足够 drain in-flight 请求（Next.js SSR 默认 1.6s 短，改 5s）？
- [ ] Acceptance 写"reload 0 掉包"时，是否附"60× curl 叠加 reload + 两 worker uptime 交错"两条可证伪指标？

### 1.5 反面案例（BI2 Planner v1 路径，已作废）

| 假设 | 结果 |
|---|---|
| `npm start` + cluster + instances=2 自动 zero-downtime | EADDRINUSE crash loop |
| `next` 直连 + cluster + instances=2（无 wait_ready）自动 zero-downtime | 93%（2-3s 窗口丢包） |
| fork mode + `increment_var: PORT` + nginx upstream | 架构更散，仍需 wait_ready，nginx 成状态依赖，不推荐 |

### 1.6 PM2 6.0.14 `env_file` 不可靠 anti-pattern

KOLMatrix B5 fixing-4 暴露：

- `ecosystem.config.js` 用 `env_file: /opt/<app>/.env.<env>` 字段
- 初次部署时 PM2 daemon 把 shell 环境变量（`source .env` 之后）作快照锁住
- **多次 `pm2 reload --update-env` / `pm2 restart --update-env` 后 env_file 不重读** —— 新增 env var 永远不进入 process env
- `/proc/<pid>/environ` 直接 dump 看不到新变量，但 .env 文件已含

**正确流程**（新增 env var 后）：

```bash
cd /opt/<app>
pm2 delete <app>                          # 不是 reload / restart
set -a && source .env.<env> && set +a     # 显式注入当前 shell
pm2 start ecosystem.config.js --only <app>  # PM2 从 shell 继承所有变量
sudo cat /proc/<NEW_PID>/environ | tr '\0' '\n' | grep <NEW_VAR>  # 验证
```

**spec 起草陷阱：** `ecosystem.config.js` 的 `env_file:` 字段名给人「PM2 会管」的强烈错觉。实际它只在初次 spawn 读一次。任何依赖「reload 自动注入新 env」的 runbook 都会踩。如果你的 deploy runbook 里写 `pm2 reload <app> --update-env`，**那是错的**，必须改成 delete + sourced-shell start。

### 1.7 不限于 `env_file` — 任何 `.env` 改动后 PM2 reload/restart 都不重读（v0.9.14 实战再现）

**实战触发：** BL-043 staging .env.staging 修复（2026-05-06）— Planner 添加新 env var `KOLMATRIX_APP_PASSWORD` + 同步改 `DATABASE_URL` 中密码后：

```bash
# 路径 1（标准 ecosystem.config.js 但不含 env_file 字段，PM2 启动时由 deploy-staging.sh 跑：
#   set -a; source .env.staging; set +a; pm2 start ecosystem.config.js --only <app>）
# .env 改动后：
pm2 reload kolmatrix-staging --update-env  # ❌ 仍 28P01 password authentication failed
pm2 restart kolmatrix-staging --update-env  # ❌ 同
```

**深入诊断（pm2 jlist 验证）：**
- `DATABASE_URL` 在 process env 中存在但**值是旧的**（PM2 daemon 启动时缓存的 env snapshot）
- `KOLMATRIX_APP_PASSWORD` 在 process env 中**根本不存在**（PM2 没读 `.env.staging` 新加的 line）
- 直接 `PGPASSWORD=$NEW_PWD psql -h localhost -U kolmatrix_app -d kolmatrix_staging` 通过 → 证明 PG 角色密码与 .env 一致，根因不是 PG 配置错位，而是 **PM2 进程内 env 与 .env 文件不一致**

**修订规则（reaffirm 加强）：** 不限于 §1.6 `env_file` 字段用法 — **任何环境下** `.env` 改动后必须 `pm2 delete + sourced shell start`（不是 reload / restart）。

**深层原因：** PM2 daemon 持有所有 process 的 env snapshot（process 启动时从 fork 的 shell 继承）。`reload --update-env` 只重启 process（保持 daemon 缓存的 env），不会重新 source `.env` 文件 — 因为 PM2 daemon 不知道 .env 文件存在（除非你用 `env_file:` 字段，但 §1.6 已证 `env_file:` 也只初次读）。

**修复模板（与 §1.6 一致，加注 .env 改动场景）：**

```bash
cd /opt/<app>
pm2 delete <app>                          # 不是 reload / restart — daemon 不重读 .env
set -a && source .env.<env> && set +a     # 显式 source 注入当前 shell（含新加的 var）
pm2 start ecosystem.config.js --only <app>  # PM2 daemon 从新 shell 重新缓存 env
# 如需验证：pm2 jlist | jq '.[] | select(.name=="<app>") | .pm2_env.<NEW_VAR>' 应非空
```

**反面案例（已落实战）：** BL-043 staging .env.staging 修复时 Planner 先尝 reload + restart 全失败 → 才用 delete + sourced start 解。**未来 spec 起草时凡涉及"新增 .env var + PM2 应用读"必须明示「pm2 delete + sourced shell start」流程，不可依赖 reload/restart --update-env**。

**来源：** v0.9.14 沉淀（BL-043 staging gap 修复 2026-05-06）。reaffirm v0.9.7 §1.6 + 扩范围（不限 env_file 字段用法）。Planner johnsong 在 prod redeploy ops 期间踩到，用户 2026-05-06 全 Accept。

### 1.6.1 SSH 加 env var `pm2 reload --update-env` 的成功条件 — 必须先 source shell（v0.9.24 #10 / BL-075 #10）

§1.6 / §1.7 强调"`pm2 reload --update-env` 不重读 `.env` 文件"，但 `--update-env` 标志的真实语义是"从**当前 shell** 重新继承 env"。BL-075-F002 实战补充：**先 `set -a; source .env; set +a` 显式注入到当前 shell，再 `pm2 reload --update-env` 会成功 carry over 新 vars**，比 §1.6 的"pm2 delete + sourced start"更轻量（零 downtime）。

#### 反例（无 source 直接 reload — §1.6 BL-043 模式）

```bash
# ❌ 失败模式：未 source shell，依赖 daemon 缓存
vi /opt/kolmatrix/.env.production    # 加新行 AIGCGATEWAY_KOL_COUNTRY_ACTION_ID
pm2 reload kolmatrix --update-env    # ← 仍只有 daemon 缓存的旧 env
sudo cat /proc/$(pgrep -f kolmatrix)/environ | tr '\0' '\n' | grep AIGCGATEWAY_KOL_COUNTRY
# (空，新 var 未生效)
```

**深层原因**：`--update-env` 从启动 PM2 daemon 的 shell 继承 env；改 `.env` 文件不自动注入到该 shell。

#### 4 步标准流程（BL-075-F002 实战 zero-downtime 模式）

```bash
# 1. 备份 .env（必须带 batch + feature + timestamp 标识，方便回滚）
cp /opt/kolmatrix/.env.production \
   /opt/kolmatrix/.env.production.bl075-f002.$(date +%Y%m%d-%H%M%S)

# 2. 加新行到 .env
echo "AIGCGATEWAY_KOL_COUNTRY_ACTION_ID=cmpm3pr2e0011bno3f1vd4v9r" \
  | sudo tee -a /opt/kolmatrix/.env.production

# 3. 关键：显式 source 到当前 shell（set -a 让 source 的所有 var 自动 export）
set -a; source /opt/kolmatrix/.env.production; set +a

# 4. pm2 reload --update-env 从当前 shell carry over 新 var
pm2 reload kolmatrix --update-env

# 5. 验证：读 /proc/PID/environ 确认实际进程含新 var
sudo cat /proc/$(pgrep -f "PM2.*kolmatrix" | head -1)/environ \
  | tr '\0' '\n' | grep AIGCGATEWAY_KOL_COUNTRY
# AIGCGATEWAY_KOL_COUNTRY_ACTION_ID=cmpm3pr2e0011bno3f1vd4v9r ✅
```

#### 与 §1.6 pm2 delete + sourced start 的选用

| 场景 | 推荐 | 理由 |
|---|---|---|
| 新增 env var（不改值）| **§1.6.1 reload --update-env 4 步** | 零 downtime，PM2 cluster 滚动重启 |
| 改 env var 值（如密码轮换） | **§1.6.1 reload --update-env 4 步** | 同上 |
| 删除 env var | §1.6 pm2 delete + sourced start | 确保 daemon snapshot 完全清空，避免残留 |
| PM2 daemon 自身行为异常 / pm2 jlist 出错 | §1.6 pm2 delete + sourced start | nuclear option 重建 daemon state |
| 复杂多 env 文件 / ecosystem.config.js 改动 | §1.6 pm2 delete + sourced start | 显式重新读 ecosystem.config.js |

**默认场景（增 env var）选 §1.6.1 4 步**，零 downtime + 简单 + 验证清晰；**异常 / nuclear 场景**回退 §1.6 pm2 delete + sourced start。

#### 同 protocol 适用

BL-075-F002 (`AIGCGATEWAY_KOL_COUNTRY_ACTION_ID` prod + staging) + BL-068-F001 (`AIGCGATEWAY_REFINE_ACTION_ID`) + BL-069-F001 (`AIGCGATEWAY_BRIEF_PARSE_ACTION_ID`) 都按此流程落地（详 `framework/memory/environment.md` aigcgateway Actions 清单）。

**来源：** BL-075-F002 prod + staging deploy 实战（2026-05-26 03:55 UTC，backup `.env.{production,staging}.bl075-f002.20260526-035529`）+ v0.9.24 #10 用户 2026-05-26 ack。

### 1.8 外部 API token 配置前必 dry-run 验证（v0.9.26 — BL-083 fork .env ops）

任何外部 API token 写入 `.env` 前必须先 dry-run 验 token 有效，不可"写完 restart 才发现 invalid"。

**反例（BL-083）：** 直接写 fork `.env` 新 `TIKHUB_TOKEN` + restart → 才报 `Invalid API token`，restart 后 4-32s 内 99 次 TikTok scrape fail，rollback 旧 token 才恢复。后续 `APIFY_API_TOKEN` 改用先 dry-run 成功避坑。

**fork .env token 改前 ops 模板（备份 → dry-run → 改 → restart → 对比基线）：**

```bash
# 1. dry-run 验 token（每个 SaaS 找其 me/identity endpoint，HTTP 200 才算有效）
curl -so /dev/null -w '%{http_code}' \
  -H "Authorization: Bearer <token>" https://api.apify.com/v2/users/me   # Apify
# 期望 200；401/403 = token 无效，禁止写入 .env

# 2. 备份 → 写 → restart
cp .env .env.bak.$(date +%Y%m%d-%H%M%S) && vi .env && <restart service>

# 3. restart 后 15s 窗口 grep 错误日志，对比基线确认无新增 Invalid token / auth fail
```

| SaaS | dry-run endpoint |
|---|---|
| Apify | `GET /v2/users/me` |
| TikHub | me/identity endpoint（TBD，按 API 文档定） |
| 其他 | 找 `/me` / `/account` / `/identity` 类 endpoint |

**通则：** 任何"不可逆写入生产配置前先验证"场景（token / 密钥 / 端点 URL）都适用本模板 —— 写入即生效且回滚有代价（99 次 scrape fail 窗口）时，dry-run 探测是唯一防线。

**来源：** BL-083 fork TIKHUB_TOKEN invalid 踩坑 + APIFY_API_TOKEN dry-run 避坑实战 + 用户 2026-06-09 ack。

---

## 2. VPS working tree 卫生 + artifact in-git 强制

### 2.1 两个关联 gap 的典型触发链

**Gap 1（严重）：** Reviewer 签收"在 VPS 上产出某 artifact"类 feature 时只核对"artifact 存在 VPS"，**未核对"artifact 是否 in git"**。BI3-F005 `scripts/cert-expiry-check.sh` 被 Generator 在 VPS 直接编辑创建，Reviewer 确认脚本存在 + cron + email 告警链路通后签收 PASS，**但脚本从未 commit 入 git**。86 行可执行代码活在 prod 单机 3 天，任何 re-deploy / 迁机器 / 灾后恢复都会丢失。

**Gap 2（工作区卫生）：** Generator 在 VPS SSH 直接编辑 `src/middleware.ts` 加 `console.log` 诊断 BI2-F002 的 UntrustedHost 问题后**未清理也未 commit**。3 天后 BAux1 触发 prod deploy，`deploy-prod.sh` 跑 `git checkout` 时被 working tree 冲突阻塞。

### 2.2 症状（如何知道坑了）

- `deploy-prod.sh` 在 "3/8 git fetch + checkout" 步骤失败
- 失败信息：`error: Your local changes to the following files would be overwritten by checkout` 或 `The following untracked working tree files would be overwritten by checkout`
- Deploy run 耗时不到 1 分钟（早 fail）
- VPS 上 `git status` 显示有 ` M` 或 `??` 文件

### 2.3 3 条防御规律

**规律 1（Reviewer 签收清单）：** Feature acceptance 写"在 VPS 上产出 X"时，**Reviewer 签收清单必须核对该 artifact 是否 `git ls-files` 能找到**：

```bash
ssh <vps> "cd /opt/<project> && git ls-files <artifact-path>"
# 应该输出该路径；空输出 = artifact 只活在 VPS 单点 = 拒绝签收
```

**规律 2（Generator + Planner 自律）：** VPS 上任何 `/opt/<project>` 内的 ad-hoc 编辑（SSH debug 改代码 / 临时加脚本）完成后必须：
- **要么 clean checkout 丢弃**（`git checkout -- <file>`、`rm <file>`）
- **要么 push 回 git**（`cd` 本地 repo → edit → commit → push → VPS `git pull`）
- 不允许长期保留 working tree 脏态（超过本次 debug session）

**规律 3（deploy-prod.sh 前置 check）：** 部署脚本加 `git status --porcelain` early fail：

```bash
# 在 scripts/deploy-prod.sh step 1 "记 prev-sha" 之前加：
STATUS=$(git status --porcelain)
if [[ -n "$STATUS" ]]; then
  echo "❌ VPS working tree not clean, aborting:"
  echo "$STATUS"
  exit 1
fi
```

Early fail 好过 step 3 失败时备份已跑一半 + 状态难清理。

### 2.4 Reviewer 签收新 checklist 模板

涉及 VPS 产出的 feature，L1 自动化验收之后补一步：

| 检查项 | 命令 | 期望 |
|---|---|---|
| artifact 存在 VPS | `ssh … "ls -la <path>"` | 文件存在 + 权限合理 |
| **artifact 在 git tracked** | `ssh … "cd /opt/<project> && git ls-files <path>"` | **输出非空**（该路径在 git index 中）|
| artifact 与 git 版本一致（可选）| `ssh … "cd /opt/<project> && git diff <path>"` | 空输出（无 diff）|

前两项**必检**，第三项可选（如果 VPS 有合法本地改动等待 push）。

### 2.5 Planner spec 起草期的 counter-check

涉及 VPS 部署 / 脚本 / cron 的 spec acceptance 写作时，**必须**包含以下 2 类验收项：

```
- [ ] 脚本 / config file 在 git tracked（`git ls-files <path>` 非空）
- [ ] VPS 上 artifact 与 git 版本 byte-identical（或明确声明允许 drift）
```

仅写"VPS 上脚本存在"是不够的 —— 这会让 Reviewer 走短路径签收。

---

## 3. Staging/Prod deploy 完整链 checklist（schema + 数据回填一并验）

### 3.1 坑

KOLMatrix B5 fixing-2 → fixing-3 → fixing-7 + MVP fixing-2 累积暴露：

- **fixing-2**（commit cfd9c1e）：staging DB 缺 F001 migration → 三页 P2022 ColumnNotFound on `kol.channel_created_at`。F001 commit 时 migration 文件入了 git，但 staging deploy 步骤里没列 `npx prisma migrate deploy`。
- **fixing-3**（commit 3066551）：staging F002 enrich 历史从未跑 → 5/5 抽样 KOL banner/age/videoCount 全空。F002 commit 时脚本入了 git，但 staging deploy 没跑 `npm run enrich:kol-youtube`。
- **fixing-7**（commit ec9340b）：staging /api/health.git_sha = 之前的 chore commit ee45543，本地 HEAD = e493ab4 → Reviewer 严卡 SHA 对齐。e493ab4 仅是 chore(state) progress.json 改动 paths-ignore，不会触发自动 staging deploy。
- **MVP fixing-2**：staging seed 漏 KolCampaign rows + KOL.email → C-10 outreach 不可用（看似 prod redeploy 完成实际数据未到位）。

共同 root cause：**「spec 里写了脚本/migration 入 git」≠「staging 实际跑通」**。runbook 不显式列每一步 = 必踩。

### 3.2 完整链 checklist

任何批次 status `building → verifying` 切换前，Generator 必须按下面顺序在 staging VM 跑通；缺任何一步 = 拒切：

```bash
# 1. SSH 进 staging（KEX 设置见 environment.md）
ssh tripplezhou@<staging-ip>

# 2. 拉代码到 deploy 路径（⚠️ git pull --ff-only 是硬要求，非可选）
#    根因：远端可能在本地 generator 推 commit 后又被其他 agent 推 chore/state，
#    本地 staging 路径若不 pull 则 build 出来的 git_sha 落后 main HEAD，
#    切 verifying 时 Reviewer SHA 对齐 fail 触发死循环（详见 §3.4）。
cd /opt/<app>-staging
git pull --ff-only origin main

# 3. 装依赖（npm ci 而非 install，保锁版）
set -a && source .env.<staging> && set +a
npm ci --include=dev

# 3.5. ⚠️ Prisma client 生成（必跑显式步骤，不依赖 postinstall hook）
# NODE_ENV=production 下 npm ci 不跑 package.json 的 postinstall（含 prisma generate），
# 导致 node_modules/.prisma/client/ 缺席 → next build 阶段 tsc 解析
# `import { PrismaClient } from "@prisma/client"` 失败。来源：BL-025-F001 staging deploy 失败。
npx prisma generate

# 4. ⚠️ Schema 迁移（必跑，即便本批次没改 schema 也跑 — 防漏）
npx prisma migrate deploy

# 5. ⚠️ 数据回填脚本（如本批次含 enrich/seed）
npm run db:seed                     # 或 npm run enrich:kol-youtube 等
# 如批次含数据回填脚本，spec § 必须显式列脚本名

# 6. Build（注意 OOM）
NODE_OPTIONS='--max-old-space-size=4096' GIT_SHA=$(git rev-parse --short HEAD) npm run build

# 7. PM2 重启（按 §1 anti-pattern：必须 delete + sourced-shell start）
pm2 delete <app>-staging
pm2 start ecosystem.config.js --only <app>-staging

# 8. 验证 SHA 对齐
curl -sS https://staging.<domain>/api/health | jq .git_sha
# 必须等于 git rev-parse --short HEAD

# 9. 抽样验证数据（如本批次含 enrich/seed）
psql ... 'SELECT COUNT(*) FROM <table> WHERE <new_col> IS NOT NULL'
# 抽 5 个白名单 ID 在浏览器走查
```

### 3.3 Spec 起草期 checklist 对应（Planner）

每条 spec § "staging deploy 步骤" 必含：

- [ ] `npx prisma generate`（npm ci 之后立即跑，不依赖 postinstall hook；BL-025-F001 沉淀）
- [ ] `prisma migrate deploy`（不论本批次是否改 schema）
- [ ] 数据回填脚本名 + 抽样验证条件（如含数据填充）
- [ ] `pm2 delete + sourced-shell start`（不要写 reload）
- [ ] `/api/health.git_sha = HEAD` 验证步骤
- [ ] Planner 提供白名单 ID 给 Reviewer 抽样（防 BL-012-style 数据池污染）

### 3.4 chore(state) commits 不触发 staging deploy + Reviewer SHA 严收紧的边界

`chore(state)` / `chore(planner)` / `test(...)` 类 commits 本质是状态机维护文件改动（progress.json / .auto-memory / docs/test-reports/），paths-ignore 配置使其**不触发** staging/prod deploy（设计如此，避免无意义重 build）。

**但 Reviewer 严收紧 SHA 对齐时**，本地 HEAD = chore commit、staging git_sha = 上一个 prod commit → 误判 mismatch。

两种处理（按情境选）：

- **(a) Planner 主动同步 SHA**：chore commit 后 Planner 自己 SSH staging 跑 §3.2 步骤 6-8（build + pm2 + SHA 验证），把 staging SHA 推齐到 chore HEAD。
- **(b) Reviewer 签收规则容许 chore-only 差异**：white-list SHA-1...SHA-2 区间内仅 paths-ignore matched 的差异 = 等价部署（见 `evaluator.md` "SHA 对齐严收紧的边界"）。

**默认推 (a)** —— 简单、无歧义、不需要 Reviewer 自己判 paths-ignore 范围。

### 3.5 路径 B fork sync 模板 — bundle 绕凭据 + stash/ff/pop 保本地 docker 定制（v0.9.26 — BL-086）

路径 B「merge 上游 PR → sync `/opt/apify-kol-service` → rebuild」的 sync 步骤踩两坑，模板如下。

**坑 1 — `/opt` 无 git 凭据拉私有上游：** remote 是 HTTPS 私有仓无 credential.helper；主机 deploy key 仅对 kolmatrix 有权限，对 `guang-tech/apify` 返 `Repository not found` → 非交互 SSH 下 `git pull` 直接 fatal。**绕开（无 token 泄露）：本地打 bundle scp 过去 fetch。**

**坑 2 — `/opt` 有本地未提交 docker 定制**（`reset --hard` 会抹掉破坏部署）：`docker-compose.yml` 端口改写（`3000:3000→3004:3003` 给 nginx 上游）、`packages/service/Dockerfile` 加 `@apify-kol/apify` 包构建（committed Dockerfile 没有）。**安全 sync 序列：stash 这两文件 → ff merge → stash pop。**

```bash
# 本地：打 bundle（绕私有仓凭据）
git bundle create /tmp/apify.bundle origin/master
scp /tmp/apify.bundle prod:/tmp/

# prod /opt/apify-kol-service：
git fetch /tmp/apify.bundle origin/master
# 先确认 master 未改这两 committed 文件，再 stash 本地定制
git stash push -- docker-compose.yml packages/service/Dockerfile
git merge --ff-only FETCH_HEAD
git stash pop                       # 干净 pop（因 committed 版未变）
docker compose up -d --build

# 验证新代码生效：/admin/stats 出现新字段
curl -s localhost:3004/admin/stats | jq .   # 本次新字段 tikhubBalanceUsd:0.0005
```

**长期修：** 给主机配 `guang-tech/apify` deploy key 或 fork remote 改 SSH，免每次 bundle。

**来源：** BL-086 路径 B sync /opt/apify-kol-service 实战 + 用户 2026-06-09 ack。

---

## 4. Visual baseline regen 注意事项

### 4.1 GITHUB_TOKEN push 不触发下游 workflow

KOLMatrix B5 F006 case（commits 14ea522 / 172c2df / 5b2f622）：

- `update-visual-baselines.yml` workflow 跑完 → 用 GITHUB_TOKEN 推 commit 把新 baseline 入 git
- GitHub 默认 policy：**用 GITHUB_TOKEN 推的 commit 不触发其他 workflow**（防 infinite loop）
- 结果：visual baseline 重生后 visual regression CI 没跑 → 没人知道 baseline 是否真匹配 → 后续 PR 跑 visual regression 才发现 baseline still off

**扩范围（v0.9.23 #24，BL-070 fix-round 1 实证）：** 同样适用所有 `github-actions[bot]` 默认 `GITHUB_TOKEN` commit — 这是 GitHub 默认安全行为（防止 bot commit 触发无限 CI 循环）。**通解：** 所有需在 bot commit 后手动重跑的 workflow 必加 `workflow_dispatch` trigger，让维护者可以手动 dispatch：

```yaml
# .github/workflows/ci.yml / deploy-staging.yml / deploy-prod.yml / update-visual-baselines.yml
on:
  push:
    branches: [main]
    paths-ignore: [...]
  pull_request:
    branches: [main]
  workflow_dispatch:  # ← 必加，bot commit 后手动重跑入口
```

适用 workflow 清单（必加 `workflow_dispatch`）：`ci.yml` / `deploy-staging.yml` / `deploy-prod.yml` / `update-visual-baselines.yml` / 任何其他需 bot commit 后手动重跑的 workflow。

**解决方法（实操）：** baseline regen workflow 之后**必须跟一个 real-content commit 触发下游 CI**（也可手动 `workflow_dispatch`）。空 commit 不够（paths-ignore matches all 时 CI skip）。

### 4.2 Spec / Generator checklist

任何 feature 改 UI layout（dashboard / discovery / detail / login 等）= 必有 visual baseline 重生：

- [ ] feature 改 UI 后 commit + push 触发 PR → visual regression workflow 失败（baseline mismatch 是预期的）
- [ ] 跑 `update-visual-baselines.yml` workflow → baseline 入 git（用 GITHUB_TOKEN）
- [ ] **跟一个 real-content commit**（如 `chore(visual): regenerate baselines via update-visual-baselines workflow` + 一行任意修改）触发 visual regression workflow 跑通
- [ ] 验证 visual regression workflow 全绿才算 baseline 真匹配

### 4.3 Visual test 选择器要 deterministic

KOLMatrix B5 F006 case：

- `firstCard = .first()` 选择器依赖默认排序，遇到平台条件渲染（recent videos / topic cloud 仅 youtube KOL 有）变成 flake
- 应改：`page.locator('[data-kol-platform="youtube"]').first()` — 显式锚点

任何条件渲染的 UI 元素，visual test 必须用 stable data-attribute 锚点而非位置 selector。

### 4.4 改落地页视觉的 feature 须 Linux runner 重拍 baseline + 连带断言同 commit（BL-080-F003 #1）

**坑：** 本仓 `ci.yml` 每次 push main 还跑完整 Playwright e2e + visual-regression（`landing-{en,zh}-{desktop,mobile}` 4 张 baseline + 功能断言）。若 spec 把 L1 acceptance 只写「lint + tsc + vitest」，据此判本地全绿即 push → 但任何改落地页视觉的 feature 一 push 即 CI 红，直到：

1. **baseline 在 Linux runner 重拍**：跑 `update-visual-baselines.yml` workflow_dispatch 重拍（本地 mac/WSL 生成的 PNG 因字体 hinting 差异在 CI diff，**不可本地重拍**）
2. **失效的功能断言同步更新**：因视觉改动失效的断言（如删 hero video → `landing-hero-video` 断言）同 commit 改

**两连带坑：**
- bot 用 `GITHUB_TOKEN` push 的 baseline commit **不触发 CI**（GitHub loop 防护）→ 须手动 `gh workflow run ci.yml` 验 HEAD（同 §4.1 通解）
- Docker Hub 偶发 `docker pull pgvector 500` 让 service-container init 挂，非代码问题 → `gh run rerun <id> --failed`

**spec 起草建议：** 对「改视觉的 feature」显式把 **baseline 重拍 + 连带断言更新纳入同一 feature 的 acceptance**，而非拆到后续 feature，避免 main 中途红。删 video 导致的 e2e 断言更新本属 Evaluator 测试域，但 CI 红阻塞 main 时 Generator 被迫改测试 = scope 边界争议，提前并入同 feature 可消解。

**配套：** 本文件 §4.1（GITHUB_TOKEN bot commit 不触发下游 workflow + workflow_dispatch 通解）；上游断言健壮性详 `framework/harness/generator.md`。

**来源：** BL-080-F003 落地页视觉改动 push 后 CI 红 + 用户 2026-06-09 ack。

---

## 5. 新 auth-gated endpoint 配套 deploy script（v0.9.12 — BL-034 F007 沉淀）

### 5.1 坑（双坑组合）

BL-034 F007 把 `/api/health` `git_sha` + `version` 字段加 token guard（`HEALTH_DETAIL_TOKEN` env 守卫）— 默认无 token 不返这两字段。但 deploy-staging.sh 既有验证段严格 grep `git_sha` 字段：

```bash
# deploy-staging.sh （F007 之前 OK，F007 之后死循环）
ACTUAL_SHA=$(curl -s "$HEALTH_URL" | jq -r .git_sha)
if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "SHA mismatch"; exit 1
fi
```

**死循环：** F007 commit 推 staging → deploy-staging.sh 跑 → curl health 返 `null`（token 未配）→ ACTUAL_SHA="null" ≠ EXPECTED_SHA → exit 1 → deploy 失败 → 用户无法落地 `HEALTH_DETAIL_TOKEN` env → **下次 deploy 仍 fail**（先有鸡先有蛋）。

**第二坑（bash 旧 bytecode）：** Generator 在 fix-round 1 同步加 graceful-degrade 路径（commit `07a6db4`：token 未配置时 warning + skip strict check），git pull 更新文件后第二次 deploy 仍 fail — 因为 bash 进程已读取旧 bytecode；第三次 deploy 重启进程才生效。

### 5.2 修订规则

**新增 default-deny 健康检查 endpoint（任何返回字段加 auth gate）时同 commit 改 deploy script，否则触发死循环：**

1. **Spec 起草必含子项：** 「本 feature 改动 health endpoint 字段返回行为时，同 commit 修 `scripts/deploy-*.sh` 加 graceful-degrade 路径（auth env 未配时 warning 而非 exit 1）」
2. **Generator 实装：** auth-gated endpoint 改动同 commit 改 deploy script。两个 commit 拆分 = 故障窗口（即使秒级窗口 staging deploy 死循环不可恢复，要等用户手动落 env）
3. **Reviewer L2 验收：** 新 auth-gated endpoint 的 deploy script 改动必须验证两条路径：(a) auth env 未配时 graceful-degrade（warning + 不 exit）+ (b) auth env 已配时 strict check
4. **Bash 旧 bytecode 重启 deploy run：** deploy script 改动同 commit 后必须**重启 deploy 进程**（pm2 reload 或 docker restart 或 simply 触发新 GH Actions run）— bash 已读取旧 bytecode，不会自动 reload；如果 deploy 是 GH Actions 触发则下次 run 自然新进程，无需特殊操作；如果是 SSH 持续连接 + bash interactive 则需手动 source 或退出重进

### 5.3 graceful-degrade 模板

```bash
# scripts/deploy-staging.sh （F007 fix-round 1 后版本）
ACTUAL_SHA=$(curl -s -H "X-Health-Token: ${HEALTH_DETAIL_TOKEN:-}" "$HEALTH_URL" | jq -r .git_sha)

if [ -z "$HEALTH_DETAIL_TOKEN" ]; then
  echo "⚠️  HEALTH_DETAIL_TOKEN not set — skip strict SHA verification (graceful-degrade)"
  echo "   To enable strict check: SSH staging, set HEALTH_DETAIL_TOKEN in .env.staging, redeploy"
  exit 0
fi

if [ -z "$ACTUAL_SHA" ] || [ "$ACTUAL_SHA" = "null" ]; then
  echo "❌ Health endpoint returned no git_sha despite token set"
  echo "   Token may be wrong or endpoint may not return git_sha. Investigate."
  exit 1
fi

if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
  echo "❌ SHA mismatch: expected $EXPECTED_SHA, got $ACTUAL_SHA"
  exit 1
fi

echo "✅ git_sha verified: $ACTUAL_SHA"
```

### 5.4 反面案例

**KOLMatrix BL-034 F007 实战（2026-05-05）：** F007 commit 0db858f 加 token gate → staging deploy 死循环（token 未配 + 严格 grep）→ 用户报障 → Generator fix-round 1 commit 07a6db4 加 graceful-degrade → 第二次 deploy 仍 fail（bash bytecode）→ 第三次 deploy 触发新 GH Actions run 才 PASS。

**反面（不遵守本节会发生的）：** 引入 default-deny 健康检查时不改 deploy script → staging deploy 死循环要 N 小时排查 + 全责落到 fix-round 1 + 用户驱动 SSH 落 env 时无法验证（deploy 跑不通）→ prod 上线时间被延后。

**来源：** KOLMatrix BL-034 F007 deploy-staging.sh 死循环 + bash 旧 bytecode 双坑。Reviewer 在 signoff 报告新提此规律入框架（v0.9.12 候选），用户 2026-05-05 全 Accept。

---

### 5.1 spec acceptance 改 deploy-script 时同 commit 必须改对应 yml workflow（v0.9.13 — BL-024-F006 retroactive 沉淀）

**坑：** BL-034 F001 spec acceptance 已 done @ dbbfbb3（deploy-prod.sh 加 ALTER ROLE 段 line 71-81）但漏了同 commit 改 `.github/workflows/deploy-prod.yml` script 块加 `set -a; source .env.production; set +a` 桥接 → GH Actions Run 时 `KOLMATRIX_APP_PASSWORD` env var 不会 export 到 shell 环境 → ALTER ROLE 段 silent skip → prod kolmatrix_app 角色实际仍用 init migration 字面 `'kolmatrix_app'` 弱密码（**CRIT-1 fix 未在 prod 生效 1+ 周**）。

Planner johnsong 在 BL-024 prod redeploy ops 准备阶段（2026-05-05 23:00）实地核查 deploy-prod.sh 注释「Reads KOLMATRIX_APP_PASSWORD from .env.production via the SSH workflow's `set -a; source .env.production; set +a` (added in the GH Actions step)」与 deploy-prod.yml script 块实际内容对比才发现 — 注释明示但 yml 实装漏。BL-024 F006 retroactive hotfix（commit eacbbbb）补 yml 桥接 + 同步修 deploy-staging.yml。

**根因：** spec 起草时 Planner / Generator 对「deploy 链」的端到端理解仅停在 deploy-script 层，未明确「shell env 来源 = yml 桥接」这一上下游关系。注释明示但实装漏 → silent skip 1+ 周不被发现。

**修订规则：**

1. **任何修改 `scripts/deploy-*.sh` / `infrastructure/deploy-*.sh` 的 spec feature acceptance**，必须同 commit 改对应 `.github/workflows/deploy-*.yml`（如 deploy-script 引入新的 env var 依赖 → yml script 块必须 `set -a; source .env*; set +a`）

2. **Planner spec lock 前 checklist：**
   ```bash
   # 任意 spec feature 涉及 deploy-script 改动时，spec lock 前跑：
   # 检查同 commit 是否 yml 配套
   git log --name-only -1 | grep -E 'scripts/deploy|infrastructure/deploy|\.github/workflows/deploy'
   # deploy-script 改动数 > 0 + yml 改动数 = 0 → 立即修订 spec acceptance 加 yml 配套段落
   ```

3. **Generator 实装 checklist：** deploy-script 改动需 yml 桥接同 PR；不分 commit 推（避免一边修一边漏）

4. **Reviewer L2 验收 checklist（强制）：** staging deploy 不仅看 health endpoint，还要**抓 deploy log warning**：
   ```bash
   # 验 staging deploy 后，gh run view <RUN_ID> --log | grep -E '⚠️|skipping|unset|warning'
   # 任意 warning 命中 → 立即标 PARTIAL 切 fixing；deploy 看似 success 但 silent skip = 实质 fail
   ```
   BL-034 F001 silent skip 持续 1+ 周未发现的根因正是 Reviewer 没看 deploy log 中 "⚠️ KOLMATRIX_APP_PASSWORD unset — skipping" 这行 warning。

**反面案例（已落 BL-024 F006 retroactive hotfix）：** BL-034 F001 spec acceptance 写 ALTER ROLE 段 done @ dbbfbb3 但 prod CRIT-1 实际未修 1+ 周（直至 2026-05-05 Planner 实地核查）。本可在 BL-034 F001 spec lock 时加「同 commit 改 yml」检查项 + Reviewer L2 deploy log warning 抓取避免。

**来源：** KOLMatrix BL-024-F006 retroactive hotfix（commit eacbbbb，BL-034 F001 root cause 1+ 周后实地核查发现）。Generator Kimi 在 BL-024 generator_handoff 提案 + Planner johnsong 实地核查 + 用户 2026-05-06 全 Accept（v0.9.13 候选 #1）。

---

## 6. 数据命名/结构变更类修复：部署立即触发 on-boot 后台任务，需配套幂等数据修复（v0.9.23 — aigcgateway BL-SYNC-ADAPTERTYPE-FALLBACK 沉淀）

### 6.1 坑

当修复**改变已存在数据的命名 / 结构规则**（如给某类记录的 canonical name 加前缀、改字段派生逻辑），且项目存在 **on-boot / 定时后台任务**（如 model sync 在 `instrumentation.ts` boot 时跑、cron 回填）时：

**部署 = `git reset --hard` + 重启 → 后台任务立即用新代码跑一次**，在"旧数据（旧命名）+ 新逻辑（新命名）"之间产生 **orphan / 中间态**。

aigcgateway BL-SYNC-ADAPTERTYPE-FALLBACK fix-round-1 实例：修复让 guangtech 模型 canonical 从裸 `gpt-5.5` 改为 `guangtech/gpt-5.5`。部署后 boot sync 立即跑 → 用新命名建了 6 个 `guangtech/*` 模型行，但**活跃 channel 仍按 `realModelId` 匹配、挂在旧的裸名模型上** → 新模型 orphan（0 channel）、旧模型仍带活跃 channel。一次性重命名脚本因此必须"先删 orphan 再 rename"。

### 6.2 规律

- **数据命名/结构变更类修复必须配套幂等数据修复脚本**（committed，非临时 SQL），把存量旧数据迁到新规则
- **修复脚本要能自愈部署后 boot 任务产生的中间态**（如"目标名已被 orphan 占用 → 无引用则删 orphan 再迁"），否则脚本会因"目标已存在"卡住
- **时序：先部署（让 prod 跑新代码）→ 再跑数据修复**。反序（先改数据、后部署）会被部署前旧代码的 boot 任务打回旧规则
- 脚本必须**幂等**：dry-run 默认 + 复跑无变化，Reviewer 可安全复验

### 6.3 Planner spec 起草 / Generator 实装 / Reviewer 复验 checklist

- [ ] 本批次是否改了"已存在数据的命名/派生规则"？是 → 必须配套数据修复脚本（feature 或 ops 步骤显式列出）
- [ ] 项目有 on-boot / cron 后台任务吗？会消费/重算被改的数据吗？→ acceptance 标注"部署后 boot 任务时序"
- [ ] 修复脚本处理 orphan / 目标已存在 / 共享引用等中间态（护栏跳过或自愈）
- [ ] 脚本幂等（dry-run 默认，复跑 0 变更）；Reviewer 复验含"脚本 dry-run 待处理 = 0"

**来源：** aigcgateway BL-SYNC-ADAPTERTYPE-FALLBACK fix-round-1（部署后 boot sync 建 orphan，一次性重命名脚本增强为删 orphan 再 rename）。

---

## 7. 不可逆生产迁移（换机 / 换部署模型）— v1.0.1（aigcgateway BL-PROD-MIGRATE-DEPLOYSVR 沉淀）

换生产服务器、或换部署模型（原生 PM2 → 容器化）属不可逆操作，必须按固定剧本，否则一次翻车全站瘫痪或数据丢失。

### 7.1 迁移剧本：演练 → 预置 → 最短停机窗口 → 回滚就绪

四段式，前两段完全可逆、旧机全程照常服务：

1. **并行演练（旧机不动）**：新机起完整新栈 + 灌一份**生产数据快照** + 全链路冒烟（真实凭据解密、跨云资源读写、流式、鉴权、MCP 等）。演练在新机 loopback 跑，不切流量。价值：本次演练即捕获 Next standalone HOSTNAME bug（§7.3），割接前挡掉。
2. **可逆预置（旧机不动）**：割接要用的**一切可逆步骤全预置完** —— 签 TLS 证书（DNS-01 免停机）、装反向代理 vhost、验证公网入口可达（`curl --resolve <域名>:443:<新IP>` 绕 DNS 直验新机 200 + 证书）。目的：把不可逆窗口压到只剩数据同步 + DNS 切换。
3. **最短停机窗口**：`停旧机写入 → 数据终态同步 → 切 DNS`。每个不可逆点（停写 / 数据终态 / DNS 切）执行前取用户 go/no-go。数据终态用 `drop schema public cascade + pg_restore --no-owner`（清演练残留）。
4. **回滚就绪**：旧机停写**冻结**（DB 不再写）作回滚点；旧 DNS 值 / `VPS_HOST` 旧值 / last-known-good 镜像 tag 全留档。观察期内不退旧机；旧机若还承载其他服务，整机退役单列。

**Planner spec checklist（迁移批次）：**
- [ ] acceptance 含"演练冒烟"（新栈 loopback）+ "割接后公网端到端"两层
- [ ] 三个不可逆门禁（停写 / 数据终态 / DNS 切）标注 go/no-go
- [ ] 回滚手册显式（流量回滚命令 + 镜像/进程回滚命令 + 旧机冻结确认）
- [ ] 旧机若跑多服务，退役范围 = 仅本服务冻结；整机下线依赖其他服务迁移，单列

### 7.2 凭据一致性（有状态应用迁移红线）

**"解密 DB 数据的密钥"必须与源机逐字节一致，且 sha256 跨机比对证明** —— 不能只"复制了就算"。一旦不一致，DB 内所有加密字段（如 provider 凭据）无法解密 = 全站瘫痪。

```bash
# 跨机比对（只传 hash，不落明文 / 不进日志）：源机 authoritative 配置 vs 新机 .env 逐项 ✓ 才继续
h() { printf '%s' "$1" | sha256sum | cut -c1-16; }   # 对 ENCRYPTION_KEY / JWT / 签名 secret / DB 密码逐项
```

**配套坑 — env_file 引号**：源机 `.env` 若被 bash `source`（值带引号 `KEY="v"`），迁到 docker compose `env_file` 时**引号被当字面量保留**（值变成 `"v"` 而非 `v`）→ 密钥错位。构建新 `.env` 时必须去外层引号规范化。

### 7.3 容器化 Next.js standalone 的 HOSTNAME 坑

Next.js standalone `server.js` 默认绑 `process.env.HOSTNAME`，而 **Docker 运行时把 HOSTNAME 注入为容器 ID** → app 绑到容器 IP 而非 `0.0.0.0`：
- 发布端口经 docker-proxy 仍可达（宿主 / 外部 curl 200）——**掩盖问题**
- 但**容器内** `127.0.0.1:<port>` 不监听 → 容器 HEALTHCHECK（`fetch 127.0.0.1`）ECONNREFUSED、状态永远卡 `starting`

**修复**：compose `environment: HOSTNAME=0.0.0.0`（发布端口仅绑 127.0.0.1 loopback 时无安全影响）。与 `web-runtime-patterns.md` §"Next standalone request.url origin 反代推导" 同族——一个是绑定地址、一个是对外 URL 构造。

**来源：** aigcgateway BL-PROD-MIGRATE-DEPLOYSVR（GCP 原生 PM2 → deploysvr 容器化，2026-07-12）。演练捕获 HOSTNAME bug；sha256 校验 ENCRYPTION_KEY 逐字一致；Certbot DNS-01 预签零停机割接。

---

## 8. Next.js 16.x Turbopack 生产 build 兼容性陷阱 + --webpack 防御（v0.9.22 #4）

**坑：** Next.js 16.2.x 默认 `next build` 走 Turbopack → 生产构建**不写 `.next/BUILD_ID` 文件**（仅在 `.next/static/<hash>/` 子目录名编码 BUILD_ID）。但 `server.js` 用 `next({ dev: false })` + `app.prepare()` 启动时**仍走旧 webpack 路径**读 `.next/BUILD_ID` 文本 → 抛 `production-start-no-build-id` → 进程启动失败 → PM2 fallback 旧 worker → 旧 worker 内存 build manifest 不含新 chunks → per-chunk 404 ErrorBoundary。

**防御（全栈 force --webpack）：**

```jsonc
// package.json — build script 强制 --webpack flag
{
  "scripts": {
    "build": "next build --webpack",
    "build:turbopack": "next build"
  }
}
```

```bash
# scripts/deploy-staging.sh / deploy-prod.sh — 同 commit 加清旧 Turbopack 残留
rm -rf .next/build .next/turbopack .next/static/[A-Za-z0-9]*
# 注意：不动 .next/cache 保 build 加速（webpack cache 仍可复用）

NODE_OPTIONS='--max-old-space-size=4096' GIT_SHA=$(git rev-parse --short HEAD) npm run build
```

**附加（v0.9.22 #8 链接）：** webpack 严格 typecheck 比 Turbopack 严，迁移时常暴露 hidden TS errors（如 BL-067 commit 6dbe231 修 4 处 Record exhaustive / undefined access / mock shape）。Next.js 升级 / Turbopack ↔ webpack 切换 checklist 详见 `framework/patterns/web-runtime-patterns.md`（Next 构建期 RSC / Turbopack↔webpack）。

**应用：** 任何使用 custom `server.js` + `next({ dev: false })` 的项目（即 §1.3 Next.js 生产部署唯一可靠路径）必须 force `--webpack`，不要依赖默认 Turbopack。

**build artifact 健康检查（建议加 deploy script）：**
```bash
# deploy 前置检查
[ -f .next/BUILD_ID ] || (echo "✗ Missing .next/BUILD_ID — Turbopack build 异常" && exit 1)
[ -f .next/required-server-files.json ] || (echo "✗ Missing required-server-files.json" && exit 1)
```

**来源：** BL-067 fix-round 1 commit f284d35 实战验证 + v0.9.22 #4（用户 2026-05-16 ack）。

---

## 9. prod 关键流程 log-based alerting（v0.9.24 合并段 — BL-073 #8 + BL-076 #14）

prod 关键 batch / sync / external API call 持续失败时**必须**触发 alerting，否则会复现 BL-076 14 天沉默 outage 模式。本段合并 BL-073 #8（识别 gap）+ BL-076 #14（实战代价证实）两候选，提供 grep pattern + 三件套防御模板。

### 9.1 反例 — BL-076 14 天 prod outage 未告警代价（v0.9.24 #14 / BL-076 #14）

**实战：** BL-076 SSH prod `/var/log/kolmatrix-kol-sync.log` 实测：`discover-import[apify-kol]: numeric field overflow` 自 5/12 起每天 daily-sync fail，**inserted=0 updated=0 持续 14+ 天**，prod 数据同步管道彻底断；全程未触发任何告警 → 1397 KOL 库 stale → 影响所有 `/match` 用户。

**关联识别 gap（v0.9.24 #8 / BL-073 #8）：** BL-073 SSH prod log 实测 `match.emptyState.body` + `weeklyReport.title` MISSING_MESSAGE 已多次出现于 prod log（5/25 17:18 ~ 18:02 UTC 至少 6 次），但**未触发任何告警** → next-intl 默认 production fallback 返 key 字面 + log 但不 throw，CI 跑不到 prod log，prod log 也无监控钩子。BL-072 #4 已识别 gap 未实装，BL-076 实战代价证实。

### 9.2 三件套防御模板（log-based alerting 三层防御）

**(a) Slack webhook on level=WARN/ERROR：**

```typescript
// scripts/kol-sync-daily.ts 等关键脚本结尾
const stats = await runSync();
const slackUrl = process.env.AI_DAILY_REPORT_SLACK_WEBHOOK_URL;
const level = stats.failed > 0 || stats.errors.length > 0 ? "ERROR" : "INFO";

if (slackUrl && level !== "INFO") {
  await fetch(slackUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `[${level}] kol-sync-daily: inserted=${stats.inserted} failed=${stats.failed}`,
      attachments: [{ color: "danger", text: JSON.stringify(stats, null, 2) }],
    }),
  });
}
console.log(JSON.stringify({ level, stats }));
```

**(b) GCP Cloud Monitoring log-based alert：** Cloud Logging 配 log-based metric `inserted=0 AND errors>0` 连续 3 天 → 触发 PagerDuty / Slack。

```yaml
# log-based metric filter
resource.type="gce_instance"
logName="projects/<project>/logs/kolmatrix-kol-sync"
jsonPayload.stats.inserted=0
jsonPayload.stats.failed>0
```

**(c) /api/health degraded 信号：** 加 `last_successful_sync` 字段（反查 kpi_daily_snapshot 或 redis 缓存），>48h 视为 degraded。

```typescript
// src/app/api/health/route.ts
const lastSync = await getLastSuccessfulSyncFromDB();
const ageHours = (Date.now() - lastSync.getTime()) / 3_600_000;
return Response.json({
  status: ageHours > 48 ? "degraded" : "healthy",
  git_sha: GIT_SHA,
  last_successful_sync: lastSync.toISOString(),
  sync_age_hours: ageHours,
});
```

### 9.3 grep pattern（log alerting 抓什么）

| 错误 pattern | 含义 | grep 正则 | 告警等级 |
|---|---|---|---|
| `MISSING_MESSAGE` | next-intl i18n key 缺失 → prod 返字面 key 给用户 | `MISSING_MESSAGE` | WARN |
| `Prisma error` / `numeric field overflow` | DB 写入边界 / schema mismatch | `Prisma\|numeric field overflow\|invalid input syntax` | ERROR |
| `5xx response` | API endpoint 内部错误 | `status":5\|HTTP/[\d.]+ 5\d\d` | ERROR |
| `inserted=0 updated=0` | sync 全 fail（per BL-076） | `inserted=0.*updated=0` | ERROR（连续 3 天 PagerDuty） |
| `429 RPM limit exceeded` | aigcgateway 限速 → LLM call skip | `RPM limit exceeded\|429` | WARN（连续 1 天 → ERROR） |

### 9.4 配套实装项（建议 BL-078+ follow-up）

本段是 framework 沉淀**模板与原则**，实物落地（prod Slack webhook URL + GCP Cloud Monitoring 配置 + /api/health 加 last_successful_sync 字段 + 关键脚本配 level/stats 落 log）留 BL-078+ 独立 batch 评估。优先级 = (a) Slack webhook 最低 → 1 day；(b) /api/health degraded 信号 → 0.5 day；(c) GCP Cloud Monitoring → 0.5 day。

### 9.5 配套上游沉淀（caller side）

batch loop 内 per-element try/catch + stats.failed 累加是本节 alerting 的**数据源前提**，详 `framework/patterns/database-patterns.md`（per-element try/catch） DB / 外部 API batch 健壮性（v0.9.24 #15 / BL-076 #15）。

**来源：** BL-073 SSH prod log 实测 MISSING_MESSAGE 多发未告警（v0.9.24 #8）+ BL-076 14 天 prod outage 实战代价（v0.9.24 #14）+ 用户 2026-05-26 / 2026-05-27 ack。同主题合并单段（识别 gap → 实战代价 → 三件套防御），不开两独立段。

---

## 10. prod-outage-recovery + VM 内存超额防护（v0.9.26 — BL-080+ deploy build OOM 拖垮整机）

### 10.1 事故与根因

**事故（2026-06-06）：** deploy-prod.yml 两次触发均失败，报 `ssh: handshake failed: EOF`（部署跑 17 分钟后）；`kol.guangai.ai` 宕机（HTTP 000，端口 22+443 超时，SSH banner 阶段断），staging 同 VM 一起挂。

**根因：整机系统内存耗尽。** 东京 VM（`instance-20260403-154049`，**仅 7.8Gi RAM**）同时跑 kolmatrix app + postgres + **aigcgateway 姊妹项目（4 cluster）** + **apify-kol-service docker（postgres+service）**。`deploy-prod.sh` 的 `node --max-old-space-size=4096 next build`（限的是 V8 堆，非系统 RAM）叠加常驻服务把系统 RAM 打满 → 内核 thrash → sshd 握手都完不成 → 部署失败 + rollback 也连不上 → 主机卡死，只能 GCP console reset。

### 10.2 恢复 runbook（已验证 3 步）

1. **GCP console reset VM**（agent 无 gcloud，须用户操作）。
2. **逐服务重建 .next（build OOM 中断留下残缺 → pm2 online 但 app 502）：**
   ```bash
   cd /opt/kolmatrix && NODE_ENV=production npx prisma generate \
     && node --max-old-space-size=4096 ./node_modules/next/dist/bin/next build --webpack \
     && pm2 reload kolmatrix
   # /opt/kolmatrix-staging 同样重跑一遍
   ```
3. **apify docker reboot 后崩溃循环 `EAI_AGAIN postgres`（service 容器起在 postgres+网络就绪前）：**
   ```bash
   cd /opt/apify-kol-service && docker compose up -d   # 按 depends_on 顺序 + 重建网络；restart policy 单独不够
   ```

### 10.3 防复发（待 Planner/ops 定，4 选项）

VM 7.8Gi 跑 4 套服务 + 4GB build 严重超额。**在落实其一前不要重试 prod 部署，会再 OOM。**

| 选项 | 做法 | 效果 |
|---|---|---|
| (a) 加 swap | 配 swapfile | OOM-killer 收割单进程而非整机 thrash，至少别拖死 SSH |
| (b) 部署时临时停 apify-docker | build 前 `docker compose stop` 腾 RAM，build 后再起 | 临时腾出 build 内存峰值 |
| (c) 扩 VM 内存 | GCP 改机型 | 治本但增成本 |
| (d) CI runner build artifact | 在 CI build 出 artifact 再传 VM | VM 不再承担 build 内存峰值（最优） |

### 10.4 ⚠️ 远端 bash heredoc 坑

SSH `bash -lc "..."` 里 `echo` 含括号 `(` 会 `syntax error near unexpected token`。**远端 echo 一律不带括号。**

**来源：** BL-080+ deploy build OOM 拖垮东京 VM 实战恢复（2026-06-06 ~ 06-07）+ 用户 2026-06-09 ack。

---

## 11. 部署触发 — `gh workflow run -f ref=` 只用 main 或完整 40 位 SHA（v0.9.26 — BL-097）

**坑：** `gh workflow run deploy-staging.yml -f ref=<短SHA>` 会在 `actions/checkout@v4` 步骤直接失败（`The process '/usr/bin/git' failed with exit code 1`），部署根本到不了 VM。**根因：** checkout@v4 用 `fetch-depth: 1` 浅拉取**指定 ref**，短 SHA（如 `04e5414`）不是可单独 fetch 的 ref，git 报错退出。`ref` 输入只能是**分支名 / tag / 完整 40 位 SHA**。改 `-f ref=main`（或完整 SHA）即过。

**误判风险：** 失败日志在 checkout 阶段，容易被误读成 VM 侧 build/OOM（§10），实际连 VM 都没碰。

**来源：** BL-097 staging 首次部署 ref=短SHA 失败 + 用户 2026-06-09 ack。

---

## 来源

- KOLMatrix BI2-F002 两轮重裁决 + Round 2 实测证伪（2026-04-20）
- KOLMatrix BI3-F005 脚本未入 git + BAux1 deploy 失败（2026-04-23）
- KOLMatrix B5 fixing-2/3/4/6/7（schema migration / enrich / PM2 env_file / timeout / SHA 对齐 多坑，2026-04-30 ~ 2026-05-01）
- KOLMatrix MVP-internal-demo-prep fixing-1/2/3（KolCampaign+email seed gap / SHA mismatch / aigcgateway contract drift，2026-05-01）
- 裁决文档：`docs/specs/BI2-f002-zero-downtime-fix.md` v2
- 交接文档：`docs/specs/BI2-f002-round2-adjudication.md`
- 修复 commits：`ba11e6b` / `bc1de3b` / `4f86fc0`（salvage cert-expiry-check.sh）/ `cfd9c1e` / `3066551` / `4d1057c` / `ee45543` / `ec9340b` / `8cd80f2` / `912fbc7`

---

## 版本历史

| 日期 | 修订 | 来源 |
|---|---|---|
| 2026-04-20 | 初版沉淀（§1 PM2 zero-downtime 3 条件 + Next.js custom server 路径）| KOLMatrix BI2-F002 两轮证伪 |
| 2026-04-23 | §2 VPS working tree 卫生 + artifact in-git 强制（3 条规律 + Reviewer checklist）| KOLMatrix BI3-F005 签收漏 + BAux1 deploy 失败 |
| 2026-05-01 | §1 扩展 PM2 6.0.14 env_file anti-pattern；§3 完整链 checklist（schema + enrich + SHA 对齐边界）；§4 Visual baseline regen 注意事项 | KOLMatrix B5 7 轮 fixing + MVP-internal-demo-prep 3 轮 fixing 累积 |
| 2026-05-05 | §5 新 auth-gated endpoint 配套 deploy script（v0.9.12，含 graceful-degrade 模板 + bash 旧 bytecode 重启 deploy run）| KOLMatrix BL-034 F007 deploy-staging.sh 死循环 + bash bytecode 双坑 |
| 2026-05-06 | §5.1 spec acceptance 改 deploy-script 时同 commit 必须改对应 yml workflow（v0.9.13，含 Planner spec lock checklist + Generator 实装 checklist + Reviewer L2 deploy log warning 抓取强制）| KOLMatrix BL-024-F006 retroactive hotfix（BL-034 F001 root cause 1+ 周后实地核查发现）|
| 2026-07-03 | §6 数据命名/结构变更类修复：部署立即触发 on-boot 后台任务产生 orphan/中间态，须配套幂等数据修复脚本（自愈 orphan + 先部署后修数据 + dry-run 默认）| aigcgateway BL-SYNC-ADAPTERTYPE-FALLBACK fix-round-1（v0.9.23）|
| 2026-07-12 | §7 不可逆生产迁移（换机/换部署模型）：演练→预置→最短停机窗口→回滚就绪四段剧本 + 凭据 sha256 逐字一致红线（含 env_file 引号坑）+ 容器化 Next.js standalone HOSTNAME=0.0.0.0 坑 | aigcgateway BL-PROD-MIGRATE-DEPLOYSVR（GCP 原生 PM2 → deploysvr 容器化，v1.0.1）|
| 2026-07-13 | v1.0.3 KOLMatrix 回填：§1.6.1 SSH 加 env var `pm2 reload --update-env` 先 source shell（BL-075）；§1.8 外部 API token 写入前 dry-run 验证（BL-083）；§3.2 step 2 `git pull --ff-only` 硬要求根因注解；§3.5 路径 B fork sync 模板 bundle 绕凭据 + stash/ff/pop（BL-086）；§4.1 workflow_dispatch 扩范围通解 + 清单；§4.4 改落地页视觉 feature 须 Linux runner 重拍 baseline（BL-080-F003）；§8 Turbopack 生产 build force --webpack（BL-067）；§9 prod log-based alerting 三件套（BL-073+BL-076）；§10 prod-outage-recovery + VM 内存超额 OOM（BL-080+）；§11 `gh workflow run -f ref=` 只用 main/全 40 位 SHA（BL-097）| joyce v0.9.25 → v1.0.3 结构合并（KOLMatrix 沉淀移植，来源标注 patterns #7-#15 + generator #18）|
