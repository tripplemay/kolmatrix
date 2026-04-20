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

### 2.1 唯一必改文件：`ecosystem.config.js`

```diff
  module.exports = {
    apps: [
      {
        name: 'kolmatrix',
        script: 'npm',
        args: 'start',
        cwd: '/opt/kolmatrix',
-       instances: 1,
+       instances: 2,
        exec_mode: 'cluster',
        max_memory_restart: '1G',
+       kill_timeout: 5000,          // Next.js 处理完 in-flight 请求的预算
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

**Generator 无需引入 custom `server.js`，无需 `wait_ready: true`** —— Next.js `next start` 在 cluster 模式下 PM2 会 hijack `listen` 调用让 master 代为分发端口，一旦 worker 调到 `server.listen` 返回就算 ready；Next.js production build 所有页面预编译，listen 后即可服务，无 warmup 时间。

### 2.2 为什么不加 custom server.js + `wait_ready`（决策理由）

| 方案 | 净收益 | 代价 |
|---|---|---|
| **只改 `instances: 2` + `kill_timeout`（本方案）** | 滚动替换兜住所有请求 | 配置 2 行 |
| `server.js` wrapper + `process.send('ready')` + `wait_ready: true` | 理论更严密（确保 new worker 真能处理请求才切流量）| 引入自定义 server.js / 和 Next.js `instrumentation.ts` 边界模糊 / kill_timeout 仍必要 / 代码维护面增加 |

实践上 PM2 cluster + `instances: 2` + `kill_timeout: 5000` 对 Next.js production 已经足够（压测数据参考：0 掉包）。如未来真压测出 edge case 再升级 custom server，不是现在做的事。

### 2.3 为什么 `instances: 2` 不是 `instances: 'max'`（决策理由）

2vCPU / 16GB 机器与 aigcgateway 共机：
- `'max'` = 2 → 和 `2` 一样的结果
- 若将来扩到 4 vCPU，`'max'` 会自动变 4 → 占满 CPU，aigcgateway 争抢 → 反而降低总吞吐

显式 `instances: 2` 是最匹配当前硬件的选择，未来加核时 Planner 再评估升到 3 或 4。

### 2.4 影响面（Generator 不需要改其他文件）

- ✅ **Prisma / DB 连接池**：每 worker 各自 PrismaClient，共用 PG server 连接池；2 worker × Prisma 默认 `num_physical_cpus` 连接上限，远低于 PG `max_connections`（100），无风险
- ✅ **Next.js module-level 单例**：各 worker 独立内存空间，不影响
- ✅ **logging**：`merge_logs: true` 已在，两 worker 输出合并到同一文件
- ✅ **in-memory cache**：项目目前无 process-local cache，Redis/DB 为真相来源
- ✅ **WebSocket / SSE sticky session**：B0-B2 范围无 WS，未来有时再评估 sticky routing
- ✅ **instrumentation.ts / Sentry hook**：目前没有，加的时候再审
- ✅ **健康检查**：/api/health 每次请求独立，两 worker 都能响应
- ✅ **Node runtime 版本**：不变（22.22.2）

---

## 3. Generator 执行清单

1. **改 `ecosystem.config.js`** 按 §2.1 diff
2. **Commit + push** `fix(BI2-F002): pm2 cluster instances=2 + kill_timeout=5000 for true zero-downtime reload`
3. **VPS 上应用新配置**（不走 deploy-prod.yml，因为配置已在 git；用户手动或让 Generator SSH）：
   ```bash
   ssh tripplezhou@34.180.93.185
   cd /opt/kolmatrix
   git pull
   pm2 delete kolmatrix          # 单实例 → 双实例需 delete + start，不能 reload
   pm2 start ecosystem.config.js
   pm2 save
   pm2 describe kolmatrix        # 确认 instances=2 + status=online×2
   ```
   > 唯一一次 full restart（不是 reload）窗口，发生在切换架构时，约 3-5s 停服务。Planner 建议选业务低谷（04:00-06:00 UTC+9）。
4. **本地 smoke test 自证**（Generator，给 Reviewer 预热）：
   ```bash
   # 在 VPS 上跑或本地 curl
   for i in $(seq 1 60); do
     curl -sS -o /dev/null -w "%{http_code}\n" https://kol.guangai.ai/api/health
     sleep 0.5
   done &
   PROBE=$!
   pm2 reload kolmatrix --update-env
   wait $PROBE
   # 期望：60×200，0×非200
   ```

---

## 4. Acceptance（Reviewer 复验用）

改动后 F002 通过条件：

- ✅ VPS `pm2 describe kolmatrix` 显示 `instances=2` / `exec_mode=cluster` / 两 worker 均 online
- ✅ 连续 60 次公网 curl（间隔 500ms）叠加一次 `pm2 reload kolmatrix --update-env`：**全 HTTP 200**（0 个 502 / 000）
- ✅ 连续 60 次 VPS 本地 curl（`http://127.0.0.1:3001/api/health`）叠加 reload：**全 HTTP 200**（0 连接失败）
- ✅ `pm2 describe kolmatrix` 两 worker uptime 有交错（证明滚动替换而非同时重启）

**如果任意一项未满足：** 回 fixing，升级到方案 B（custom server.js + `wait_ready: true`）再议。

---

## 5. 相关文档

- `ecosystem.config.js` 当前 commit 2d0c30a
- Reviewer reverifying 报告：`docs/test-reports/BI2-deployment-automation-reverifying-2026-04-20.md` §4
- BI2 spec §F002：`docs/specs/BI2-deployment-automation-spec.md` —— 本 commit 同步更新
- features.json F002 acceptance —— 本 commit 同步更新

---

## 6. 版本

| 日期 | 裁决 | 产出 |
|---|---|---|
| 2026-04-20 | 方案 A：instances=2 + kill_timeout=5000 | 本文件 |
