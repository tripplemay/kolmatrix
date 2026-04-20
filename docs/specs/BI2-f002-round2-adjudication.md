# BI2 F002 · Round 2 实测 + 再裁决请求（Generator → Planner）

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-20
> **触发：** spec §2.2 方案 A 在 VPS 实测失败，第二次 pivot（script: next 直连）仍未达 spec §4 全 200 验收
> **状态：** 等待 Kimi (Planner) 明确回复，**未收到前不开工**
> **用户指示：** 2026-04-20 明确说"让 Planner 重裁决"

---

## 1. 背景 & 目标

- **目标：** F002 Zero-downtime reload（pm2 reload 期间 0 丢包）
- **原 spec：** `docs/specs/BI2-f002-zero-downtime-fix.md` §2.1，方案 A = `instances: 2` + `kill_timeout: 5000`，`script: "npm", args: "start"`
- **验收（§4）：** 60× 公网 curl（500ms 间隔）叠加一次 `pm2 reload kolmatrix --update-env`，**全 HTTP 200**

## 2. 两轮实测事实

### 2.1 Round A（commit `e4b0b0e`，spec 原方案）

执行 `pm2 delete + pm2 start ecosystem.config.js` 后：

| 观察 | 数据 |
|---|---|
| 两 worker 启动 | id 6 pid 1051993 / id 7 pid 1052000，同时 online |
| id 6 | uptime 8s+，restart=0（稳定）|
| id 7 | pid 在 6s 内变化（1052000 → 1052646 → …），restart=116 in ~2min（crash loop）|
| pm2 logs | 反复 `> next start` 无 stderr 输出（EADDRINUSE 静默崩）|
| 生产影响 | 无（id 6 顶流量，公网 200）|

**根因：** `script: "npm", args: "start"` 下 PM2 spawn `npm` 作为 cluster worker，`npm` 再 spawn 孙子进程 `next`；Node `cluster` 模块只 hook 直接子进程的 `listen()`，孙子的 `server.listen(3001)` 不走 cluster master 端口分发，两个 next 争端口，输家 EADDRINUSE 崩死。

**spec §2.2 的假设**（"PM2 hijack listen 调用"）**在 `npm start` 双层进程下不成立**。

### 2.2 Round A'（commit `660e05a`，script 直连 next，不加 custom server）

改动：`script: "node_modules/next/dist/bin/next", args: "start"`（其他不变）。

执行 `pm2 delete + pm2 start ecosystem.config.js` 后：

| 观察 | 数据 |
|---|---|
| 两 worker 启动 | id 8 pid 1055644 / id 9 pid 1055651，均 online |
| 稳定性 | 两 worker restart=0 持续 30s 无 crash（✅ 根本修好了 crash loop）|
| PM2 version detect | `16.2.4`（之前 `npm start` 显示 `N/A`）|
| Next.js ready 时间 | 每 worker ~400-450ms |
| 60× 公网 smoke（叠加一次 reload） | **56×200 + 4×000（timeout）** |
| 丢包段 | 第 35-39 秒左右 ~2-3s 窗口，curl `000 5.000s` 超时 |
| pm2 logs ready 时间戳 | 两 worker ready 差 <1s（08:52:13 / 08:52:14）|

**根因推测：** 没有 `process.send('ready')` 信号，PM2 走 `listen_timeout` 超时机制（default 3s），无法精确等到 new worker 真正 accept 连接才杀 old worker；两 worker 替换窗口重叠，nginx 在老 worker 关 socket + 新 worker 未 listen 的瞬间 hold 连接，curl 5s 超时。

### 2.3 对比表

| 指标 | Round A (`npm start`) | Round A' (`next` 直连) | Spec §4 要求 |
|---|---|---|---|
| Worker crash loop | ❌ id 7 crash 116× | ✅ restart=0 | 两 worker 均 online |
| `pm2 describe` instances=2 | ✅（但 1 在 crash）| ✅ 两 online | ✅ |
| uptime 交错（滚动替换）| ❌ | ⚠️ ready 时间差 <1s，接近同时 | ✅ 有明显交错 |
| 60× 公网 全 200 | 未跑 | **56/60 = 93%** | 60/60 = 100% |
| 60× VPS 本地全 200 | 未跑 | 未跑 | 60/60 = 100% |

**严格按 spec §4："如果任意一项未满足：回 fixing，升级到方案 B（custom server.js + `wait_ready: true`）再议。"**

## 3. 三条再往下的路

### 3.1 方案 B1 — custom server.js + `wait_ready: true`

**spec §2.2 fallback 已预案，本次显式触发。**

改动：
- 新增 `server.js`（~20 行）：
  ```js
  const { createServer } = require('http');
  const next = require('next');
  const app = next({ dev: false });
  const handle = app.getRequestHandler();
  app.prepare().then(() => {
    const server = createServer((req, res) => handle(req, res));
    server.listen(process.env.PORT || 3001, () => {
      if (process.send) process.send('ready');  // PM2 wait_ready 信号
    });
  });
  ```
- `ecosystem.config.js`：
  ```js
  script: "server.js",
  wait_ready: true,
  listen_timeout: 10000,
  ```

**预期效果：** PM2 严格等新 worker `process.send('ready')` 才杀 old，理论 0 丢包。

**代价：**
- 新增 ~20 行 JS（server.js，项目级）
- `npm run dev` 不受影响（dev 走 `next dev`），生产走 server.js
- Next.js 15+ 官方不再默认推荐 custom server（因为失去 Turbopack 部分优化），但对我们 SSR 场景几乎无影响
- spec §2.2 决策表"custom server 代价"栏目的"维护面增加"在本项目早期阶段可控

**风险：**
- Next.js 16 的 `instrumentation.ts` / `middleware.ts` / app router 与 custom server 的边界需要回归测试
- 生产 build 路径：`next build` 产物仍兼容 custom server（Next docs 确认）

### 3.2 方案 B2 — fork mode + `increment_var: "PORT"` + nginx upstream

改动：
- `ecosystem.config.js`：
  ```js
  exec_mode: "fork",
  instances: 2,
  increment_var: "PORT",   // PORT=3001 和 3002
  env: { NODE_ENV: "production", PORT: 3001 },
  ```
  (script 可改回 `npm start` 也行，因为 fork mode 不走 cluster 端口共享)
- `/etc/nginx/conf.d/kolmatrix.conf` upstream 改为 2 backend：
  ```nginx
  upstream kolmatrix_backend {
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
  }
  ```
  nginx reload（需 root + `nginx -s reload`）

**预期效果：** 两进程完全独立端口，nginx upstream fallback 机制保证一 worker reload 时另一继续服务；业界成熟模式。

**代价：**
- 需改 `/etc/nginx/conf.d/kolmatrix.conf`（root-owned，Generator SSH 可写但要 sudo）
- 需 `sudo nginx -t && sudo systemctl reload nginx`
- 仍符合 spec §2.2 "不加 custom server"精神

**风险：**
- nginx reload 瞬间若配置错，生产 503 —— 需 `nginx -t` 先 dry-run
- pm2 reload 在 fork mode 下仍需 `wait_ready` 才能 0 丢包（因为 nginx 健康检查默认被动，upstream 挂了才切）；可加 nginx `max_fails=1 fail_timeout=5s` 让 nginx 快速标记坏 worker

### 3.3 方案 C — 降标接受 93% 丢包率（写 ADR 登记）

改动：仅文档 + spec §4 验收松动（"95%+ 200，无连续 >5 次非 200"）

**代价：** 0 代码改动

**风险：**
- 违背 spec §4 原始承诺（全 200）
- 未来 deploy 频率增高时风险累积
- 外部观感不好（用户做 deploy 有几率看到 502）

## 4. 建议（非绑定，Planner 可否定）

- **B1** 最接近 spec §4 的"全 200"精神，代价可控，spec §2.2 本身就预案了这条 fallback
- **B2** 架构更干净，但需动 nginx（风险更高），且 fork mode 与未来 cluster 生态的兼容性要考虑
- **C** 只有在 Planner 判断 "reload 频次极低 + 93% 够用" 时才选

**一票推荐：B1**。spec §2.2 拒绝 custom server 的理由是"`npm start` cluster 就够"——该假设已被两轮实测驳倒，重裁决合理。

## 5. 裁决格式请求

请 Kimi (Planner) 就以下给出明确选择 + 简短理由：

| # | 问题 | A / B / C |
|---|---|---|
| 1 | 选 B1 / B2 / C？ | ? |
| 2 | 若选 B1，server.js 放项目根（与 ecosystem.config.js 同级）还是 `src/`？ | ? |
| 3 | 若选 B1，`listen_timeout` 设多少？（建议 10000 足够 Next.js 冷启动 + buffer） | ? |
| 4 | 若选 B2，nginx conf 改动由 Generator SSH 直改，还是 Planner 另开 F002-subfix spec 规范流程？ | ? |
| 5 | spec §2.2 决策表是否需要追加一列"2026-04-20 两轮实测证伪"？若是由谁改 spec 原文？ | ? |

**短格式回复即可**，例 `#1:B1 #2:root #3:10000 #4:Generator-direct #5:yes-Planner-update`。

## 6. 开工条件

收到 Planner 对 #1-#5 明确回复后，Generator 将：
1. 按决议实现 server.js / ecosystem.config.js / （如涉及）nginx conf
2. 本地 `npm run build` + `npm run dev` 回归
3. VPS `pm2 delete + pm2 start` 应用
4. Re-run spec §4 的 60× 公网 smoke + 60× VPS 本地 smoke
5. 全通过才 commit + push，progress.json → `reverifying`
6. 若仍不过，回到本文件再追加一轮

**未收到明确回复前不开工。**

## 7. VPS 当前状态（handoff snapshot）

- `ecosystem.config.js` 在 git（commit `660e05a`）= Round A' 方案（script: next 直连 + instances=2）
- PM2 实际运行：两 worker（id 8 / id 9）均 online，restart=2（经过 2 次 reload），uptime ~2min
- 公网 `https://kol.guangai.ai/api/health` = 200（非 reload 期间 100% 稳定）
- 生产无影响，但 reload 瞬间有 ~2-3s 窗口会丢包

**切勿手动 `pm2 start ecosystem.config.js`（会 delete 后重建，正常流程；除非刻意重搭）；`pm2 reload kolmatrix --update-env` 会 cycle 但有丢包窗口。**

## 8. 相关文档

- `docs/specs/BI2-f002-zero-downtime-fix.md`（spec 原文，Planner 2026-04-20 拟）
- `docs/specs/BI2-deployment-automation-spec.md` §F002
- `docs/test-reports/BI2-deployment-automation-reverifying-2026-04-20.md`（Reviewer Round 1 reverify 报告）
- 本轮 commits：`e4b0b0e`（Round A）、`660e05a`（Round A'）
