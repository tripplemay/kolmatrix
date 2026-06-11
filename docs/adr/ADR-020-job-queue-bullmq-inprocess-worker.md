# ADR-020: 任务队列 BullMQ 化 + 进程内 worker + 邮件发送异步化

## Status

**Accepted**

- 日期：2026-06-11
- 作者：Kimi (planner) + 用户
- 相关批次：BL-100（落地工单，本 ADR 同期产出）
- 前序：审计 docs/reviews/full-feature-chain-audit-2026-06-09.md（H1 邮件发送同步阻塞）· `lib/jobs/queue.ts`（JobQueue 抽象，注释预告 "B5 swap BullMQ"）
- 证据：源码巡检（jobQueue/instrumentation/redis/batch-send）

## Context（背景）

审计 H1：邮件批量发送 `sendBatchAction`(`reach/actions.ts:321`)**同步 await** `batchSendOutreach`，后者每封 `sleep(6000)`，整个发送在 server action 内与 60s wall-clock 竞速 → **>~10 收件人必超时**，且部分已发用户无从得知。`jobQueue`(`queue.ts:134`)是 `InMemoryJobQueue`(无持久化/重试/跨进程)，邮件发送**根本没接队列**（register.ts:5 "BM2 email sending will populate" 从未兑现）。

但基建大半已为此预建：`JobQueue` 接口抽象（register/add/stats，"swap BullMQ 不改调用点"）+ `instrumentation.ts register()`（Next boot 钩子，prewarm 已用此在进程内注册 worker）+ `redis.ts`（ioredis 已装，"future BullMQ workers reuse this"）+ `handlers/register.ts`（注释好的 send-email handler 模板）。

## Decision（决策）

### D1 — JobQueue 实现切到 BullMQ（同接口，调用点不改）
新增 `BullMQJobQueue implements JobQueue`，以 ioredis(`getRedis()`)为后端。`jobQueue` 单例工厂：**有 `REDIS_URL` → BullMQ；否则 → InMemoryJobQueue**（测试/无 Redis dev 回退，测试不需 Redis）。`register()` 为每个 job name 起一个 BullMQ Worker；`add()` 入 BullMQ Queue。prewarm 随单例 swap 自动迁移。

### D2 — Worker 进程内（用户决策 2026-06-11）
BullMQ Worker 在 kolmatrix Next 进程内启动（经 `instrumentation.ts`，同现有 prewarm 模式）。**不加独立 pm2 进程** —— 7.8G RAM VM（曾 OOM），+1 Node 进程是真成本；且 **BullMQ job 持久化在 Redis，Web 进程重启后 worker 自动续跑**，"独立进程隔离生存"的好处大半已被覆盖。Next 多 worker fork 时用 BullMQ concurrency 控并发避免重复消费。

### D3 — 邮件发送异步化 + 进度回报
`sendBatchAction` → 生成 `batchId` → `jobQueue.add('send-email-batch')` **立即返回** `{batchId,total}`（去掉 60s 同步 race）。一个 batch 一个 job，handler 在 worker 内跑现有 `batchSendOutreach`（节流 sleep 留在 worker 不再阻塞用户）。email_log 加 `batchId` 列关联；UI 轮询 `getSendBatchStatus(batchId)` 计数（queued/sent/failed/total）显进度条。

### D4 — 幂等（job 重试安全）
batch handler 发每封前按 `batchId+kolId` 查 email_log 是否已 sent/mock_sent，已发则跳过 → job 重试不重复发。

### D5 — Redis 挂回退同步直发（用户决策 2026-06-11）
入队时若 Redis 不可达，**回退到进程内同步发送**（旧行为，小批仍可发）+ 日志告警。保证"Redis 抖动时邮件还能发"。Redis 是大故障（也撑 rate-limit），此为降级而非常态。

### 范围
BL-100 一批：BullMQ 基建 + worker 注册 + email_log batchId + 发送异步化 + 进度 UX + prewarm 自动迁移验证。

## 被否方案

- **独立 pm2 worker 进程**：隔离但 +1 Node 进程吃 RAM；因 BullMQ 已持久化 job，隔离收益有限 → 否（选进程内）。
- **Redis 挂硬失败**：语义干净但故障期完全不能发邮件 → 否（选回退同步）。
- **一封一 job + BullMQ Redis 限流**：更granular但改动大、batchSendOutreach 重构 → 否（选一 batch 一 job，节流 sleep 留 handler 内，concurrency=1）。

## Consequences（影响）

**正面：** 发送不再阻塞用户（>10 收件人不再超时）；job 持久化（重启续跑、可重试）；prewarm 同步升级；为未来后台任务（webhook 重试、报表生成等）备好真队列。
**代价：** 新增 `bullmq` 依赖；发送变异步 → OutreachComposer UX 改为进度轮询（用户行为变化）；email_log schema migration（batchId）；Redis 从"rate-limit fail-open 可选"升为"发送主路径依赖"（D5 回退兜底）。
**部署：** worker 随 kolmatrix 进程起（instrumentation），无新进程；pm2 reload 零停机；注意 Next 多 worker 时 BullMQ concurrency。
