# BI2 F002 · Zero-downtime reload 修复规格（Planner 裁决）

> **发起者：** Kimi (Planner)
> **日期：** 2026-04-20
> **触发：** Reviewer reverifying round 1 判 F002 FAIL（commit a226399）
>   - 公网探针 `38×200 + 2×502`
>   - VPS 本地探针 `46×200 + 4× 连接失败`
>   - pm2 reload kolmatrix --update-env 期间未达 "no dropped request" 验收
> **用户裁决：** ✅ 方案 A（改双实例）— 用户消息 "同意"（2026-04-20）
> **Generator 执行者：** johnsong

---

## 1. 根因

`ecosystem.config.js` 当前：
```js
instances: 1,
exec_mode: 'cluster',
```

PM2 cluster 模式在 `instances: 1` 下，`pm2 reload` 的行为等同 `pm2 restart`：
1. SIGTERM 唯一 worker
2. 该 worker 退出后，端口释放
3. PM2 spawn 新 worker
4. 新 worker `listen` 完成，端口可用

步骤 2 和 4 之间存在 200-500ms 的端口无人接听窗口，公网请求走到 nginx → upstream 拒绝连接，返回 502。这**不是 PM2 bug，是 cluster + 单实例的固有语义**。

PM2 真正的 zero-downtime 依赖 cluster 模式下 **≥2 instances** 的滚动替换：
1. SIGTERM worker #1
2. 剩余 worker #2 继续吃流量
3. 新 worker #1 spawn → listen 完成
4. SIGTERM worker #2 → 新 worker #2 spawn
5. 全程至少 1 个 worker 在 listen，端口从不无人接听

---

## 2. 修复方案

> **2026-04-20 Round 2 重裁决（本文件 v2）：** 原 §2.1/§2.2 的假设"PM2 cluster + `npm start` + `instances:2` 自动 zero-downtime"在 VPS 两轮实测证伪（详见 `BI2-f002-round2-adjudication.md`）。Planner 按 §2.2 原文预案"升级到方案 B（custom server.js + wait_ready）"触发裁决。本节下内容为 **v2 方案 B1**（生效中）。旧 v1 方案以对比形式保留在 §2.5 供溯源。

### 2.1 方案 B1：custom `server.js` + `wait_ready: true`（三文件）

#### 2.1.1 新增 `server.js`（项目根目录，与 `ecosystem.config.js` 同级）

```js
// server.js — 生产 Next.js server + PM2 wait_ready 集成
//
// 目的：让 PM2 cluster 严格等 new worker listen ready 才杀 old worker，
//      实现 spec §4 "60× curl + pm2 reload 全 200" 零丢包验收。
//
// Next.js 16 production 本应直接 next start 即可，但 PM2 cluster 在
// `npm start` 双层进程下无法 hook 孙子进程 listen（EADDRINUSE crash loop），
// 直接 script: next 虽稳定但无 ready 信号导致滚动替换有 2-3s 丢包窗口
// （Round 2 实测 56/60 = 93%）。本 custom server 把 next 直接装载进
// 本进程，由 cluster hook 到的 listen 调用精确触发 process.send('ready')。

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
      process.send("ready");
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

**~22 行，无第三方依赖。Next.js 官方 custom server 推荐写法，兼容 Next 16 app router / middleware / instrumentation.ts。**

#### 2.1.2 修改 `ecosystem.config.js`

```diff
  module.exports = {
    apps: [
      {
        name: 'kolmatrix',
-       script: 'node_modules/next/dist/bin/next',
-       args: 'start',
+       script: 'server.js',
        cwd: '/opt/kolmatrix',
        instances: 2,
        exec_mode: 'cluster',
        max_memory_restart: '1G',
        kill_timeout: 5000,
+       wait_ready: true,           // PM2 等 process.send('ready') 才算 new worker 上线
+       listen_timeout: 10000,      // 10s 上限，Next.js 生产冷启动 ~400-450ms 绰绰有余
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
    ]
  };
```

#### 2.1.3 `package.json`（可选，视是否要统一 prod 入口）

不修改。生产启动入口统一走 PM2 读 `ecosystem.config.js` → `server.js`；`npm start` 仍用原 `next start` 供本地 smoke，不被生产链路依赖。

### 2.2 决策表（2026-04-20 重算）

| 方案 | 净收益 | 代价 | 2026-04-20 状态 |
|---|---|---|---|
| v1: `npm start` + cluster + `instances:2` | 理论上 cluster hook listen，代价最小 | ~~配置 2 行~~ | **实测证伪** — npm→next 双层进程，cluster 只 hook 直接子进程，孙子进程争端口 EADDRINUSE；Round A id 7 crash 116× |
| pivot: `script: next` 直连 + `instances:2` | crash loop 消除 | 配置 1 行 | **实测 93%** — 无 `process.send('ready')`，PM2 靠 `listen_timeout` 估算，new/old worker ready 差 <1s 时有 2-3s 重叠窗口，4×000 超时 |
| **v2: custom `server.js` + `wait_ready:true`（生效中）** | PM2 严格等 `process.send('ready')` 才切流量，真正滚动替换 | 新增 ~22 行 server.js；失去 Turbopack 部分 dev 优化（但 prod 无影响）；Next 16 compat OK | **生效中 — 待 Reviewer 复验 §4** |
| 备用 B2: `fork` mode + `increment_var:PORT` + nginx upstream | 架构最 clean | 需改 nginx conf + sudo reload nginx + 仍需 wait_ready | 未选（nginx 成为状态依赖，出坑概率高）|

### 2.3 为什么 `instances: 2` 不是 `instances: 'max'`（决策理由，不变）

2vCPU / 16GB 机器与 aigcgateway 共机：
- `'max'` = 2 → 和 `2` 一样的结果
- 若将来扩到 4 vCPU，`'max'` 会自动变 4 → 占满 CPU，aigcgateway 争抢 → 反而降低总吞吐

显式 `instances: 2` 是最匹配当前硬件的选择，未来加核时 Planner 再评估升到 3 或 4。

### 2.4 影响面（v2 方案 B1 下的复查）

- ✅ **Prisma / DB 连接池**：每 worker 各自 PrismaClient（由 server.js app.prepare() 初始化），共用 PG server 连接池；2 worker × Prisma 默认 `num_physical_cpus` 连接上限，远低于 PG `max_connections`（100），无风险
- ✅ **Next.js middleware / instrumentation.ts / app router**：custom server 用官方 `next({ dev: false })` + `getRequestHandler()`，所有 Next 特性自动继承（Next docs 明确支持）
- ✅ **Turbopack**：dev 才用，prod 不受影响
- ✅ **logging**：`merge_logs: true` 已在，两 worker 输出合并到同一文件；server.js 自身 console.log 也走 PM2 log
- ✅ **in-memory cache**：项目目前无 process-local cache，Redis/DB 为真相来源
- ✅ **WebSocket / SSE sticky session**：B0-B2 范围无 WS，未来有时再评估 sticky routing
- ✅ **健康检查**：/api/health 每次请求独立，两 worker 都能响应
- ✅ **Node runtime 版本**：不变（22.22.2）
- ⚠️ **SIGTERM 处理**：server.js 已内置 SIGINT/SIGTERM 监听 + server.close()，确保 `kill_timeout 5000ms` 内 Next.js 有机会 drain in-flight 请求

### 2.5 v1 方案归档（已作废，仅供溯源）

2026-04-20 上午 Planner 基于 "PM2 cluster + next start 官方预期行为" 拟：`script: "npm"`, `args: "start"`, `instances: 2`, `kill_timeout: 5000`, 不加 server.js。该方案假设 PM2 cluster 能 hijack `npm start` 产生的 next 进程的 `listen` 调用，实测证伪。详细实测数据见 `BI2-f002-round2-adjudication.md` §2.1-§2.3。

---

## 3. Generator 执行清单（v2 方案 B1）

1. **新增 `server.js`** 项目根（与 `ecosystem.config.js` 同级），内容按 §2.1.1 完整粘贴
2. **改 `ecosystem.config.js`** 按 §2.1.2 diff（`script: 'server.js'` + `wait_ready: true` + `listen_timeout: 10000`，删掉 `args`）
3. **本地回归**：
   ```bash
   npm run build              # 确保 Next build 通过
   node server.js &           # 手动起一次 server.js 确认监听 3001
   curl localhost:3001/api/health | jq .status   # 应返回 "healthy"
   kill %1                    # 清理
   ```
4. **Commit + push**：
   ```
   fix(BI2-F002): custom server.js + wait_ready for true zero-downtime reload
   ```
5. **VPS 上应用新配置**：
   ```bash
   ssh tripplezhou@34.180.93.185
   cd /opt/kolmatrix
   git pull
   npm ci --production=false   # server.js 无新依赖，但保证 lockfile 对齐
   npm run build               # 重新 build 确保 Next manifest 新鲜
   pm2 delete kolmatrix        # 架构从 "next 直连 script" 换成 "server.js"，需 delete + start
   pm2 start ecosystem.config.js
   pm2 save
   pm2 describe kolmatrix      # 确认 instances=2 + status=online×2 + wait_ready=true
   pm2 logs kolmatrix --lines 20 --nostream   # 应看到两行 "[server] listening on 0.0.0.0:3001"
   ```
   > 唯一一次 full restart 窗口发生在切换架构时（~3-5s 停服务）。选业务低谷（04:00-06:00 UTC+9）。

6. **自证（Generator，给 Reviewer 预热）**：
   ```bash
   # 在 VPS 上跑，叠加公网探针和本地探针两份
   # 公网
   ( for i in $(seq 1 60); do
       curl -sS -o /dev/null -w "%{http_code}\n" https://kol.guangai.ai/api/health
       sleep 0.5
     done ) > /tmp/probe-public.log &

   # VPS 本地
   ( for i in $(seq 1 60); do
       curl -sS -o /dev/null -w "%{http_code}\n" http://127.0.0.1:3001/api/health
       sleep 0.5
     done ) > /tmp/probe-local.log &

   sleep 3 && pm2 reload kolmatrix --update-env

   wait
   # 检查
   sort /tmp/probe-public.log | uniq -c     # 期望：60 200
   sort /tmp/probe-local.log  | uniq -c     # 期望：60 200
   pm2 describe kolmatrix | grep -E 'uptime|restart'   # 两 worker uptime 应明显错开
   ```

7. **若自证不过**：progress.json 不要切到 reverifying，写一份 round 3 adjudication 请求文档给 Planner（参照 `BI2-f002-round2-adjudication.md` 结构），附上 probe 日志 + `pm2 logs` 摘录。

---

## 4. Acceptance（Reviewer 复验用）

改动后 F002 通过条件：

- ✅ VPS `pm2 describe kolmatrix` 显示 `instances=2` / `exec_mode=cluster` / 两 worker 均 online
- ✅ 连续 60 次公网 curl（间隔 500ms）叠加一次 `pm2 reload kolmatrix --update-env`：**全 HTTP 200**（0 个 502 / 000）
- ✅ 连续 60 次 VPS 本地 curl（`http://127.0.0.1:3001/api/health`）叠加 reload：**全 HTTP 200**（0 连接失败）
- ✅ `pm2 describe kolmatrix` 两 worker uptime 有交错（证明滚动替换而非同时重启）

**如果任意一项未满足：** 回 fixing，Generator 写 round 3 adjudication 请求给 Planner（§3 step 7）；不得自行选方案 B2 或 C 不经 Planner 同意。

---

## 5. 相关文档

- `ecosystem.config.js`：v1 commit 2d0c30a（pre-fix）→ v1-B commit `e4b0b0e`（Round A 方案 A，npm start）→ v1-B' commit `660e05a`（Round A'，next 直连）→ **v2-B1 待 Generator 实施**
- Round 2 裁决请求：`docs/specs/BI2-f002-round2-adjudication.md`
- Reviewer reverifying 报告：`docs/test-reports/BI2-deployment-automation-reverifying-2026-04-20.md` §4
- BI2 spec §F002：`docs/specs/BI2-deployment-automation-spec.md` —— 本 commit 同步更新
- features.json F002 acceptance —— 本 commit 同步更新

---

## 6. 版本

| 日期 | 版本 | 裁决 | 产出 |
|---|---|---|---|
| 2026-04-20 上午 | v1（已证伪）| 方案 A：`npm start` + instances=2 + kill_timeout=5000 | 本文件 v1 |
| 2026-04-20 下午 | v2（生效中）| 方案 B1：custom `server.js` + `wait_ready:true` + listen_timeout=10000 | 本文件 v2（基于 johnsong Round 2 实测 + 重裁决请求）|
