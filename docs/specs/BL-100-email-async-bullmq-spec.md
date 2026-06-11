# BL-100 邮件发送异步化 + 真 BullMQ 队列(波2)

> **Type：** 基建/重构(审计 H1 最严重功能 bug)。spec 硬性。
> **决策：** ADR-020(BullMQ + 进程内 worker + 发送异步 + Redis挂回退同步)
> **来源：** docs/reviews/full-feature-chain-audit-2026-06-09.md H1 + 路线图波2
> **范围：** 纯 kolmatrix。新增 bullmq 依赖 + 1 schema migration(email_log.batchId)。

## §1 现状(源码实证)

- `jobQueue`(`lib/jobs/queue.ts:134`)= `InMemoryJobQueue`(无持久/重试/跨进程)。
- `sendBatchAction`(`reach/actions.ts:321`)同步 `Promise.race([batchSendOutreach, 60s timeout])` → `batch-send.ts` 每封 `sleep(6000)` → **>~10 收件人必超时**，部分已发不可见。
- 基建已备:`JobQueue` 接口抽象(swap 不改调用点) + `instrumentation.ts register()`(prewarm 已在进程内注册 worker) + `redis.ts`(ioredis, getRedis 单例) + `handlers/register.ts`(注释好的 send-email 模板)。
- 唯一现有 jobQueue 用户:prewarm(`prewarm-actions.ts:75` + `explain-recommendations-worker.ts:307` register)。

## §2 Features

> 全 generator 含单测 + L1 全绿(lint 0err warn≤3 / tsc=0 / npm test)。InMemoryJobQueue 保留作测试/无 Redis 回退，单测不依赖真 Redis。

### F001 — BullMQ 队列实现 + 工厂 + worker 注册(generator)
- 加 `bullmq` 依赖。`BullMQJobQueue implements JobQueue`(register/add/stats，以 `getRedis()` 为后端):`register(name,handler)` 起一个 BullMQ Worker(concurrency 控)+ `add(name,payload,opts)` 入 BullMQ Queue(支持 delay/idempotencyKey via jobId/tenantId)。
- 工厂:`jobQueue` 单例 = `REDIS_URL` 存在 → BullMQJobQueue，否则 InMemoryJobQueue(测试/dev 回退)。**导出名/类型不变**，调用点零改。
- worker 进程内启动:经现有 `instrumentation.ts`→`handlers/register.ts`(已 registerExplainPrewarmHandler)，BullMQ worker 随之消费。一次注册/进程，幂等。
- **Redis 挂回退(D5):** add() 若 Redis 不可达 → 抛/返回信号让上层回退(F003 同步兜底)；或工厂启动时探测。日志告警。
- 验收:BullMQ 入队/消费通；prewarm 在 BullMQ 下仍工作(register 起 worker)；REDIS_URL 缺失时回退 InMemory；单测(InMemory 行为 + BullMQ 入队 mock + 工厂选择 + 幂等 jobId)。

### F002 — email_log batchId 关联 + 幂等(generator, schema migration)
- prisma migration:`EmailLog` 加 `batchId String? @map("batch_id") @db.Uuid` + `@@index([tenantId, batchId])`。
- `batch-send.ts` 每封 email_log 写入传入的 `batchId`。
- 幂等:handler 发每封前按 `(batchId, kolId)` 查 email_log 是否已 sent/mock_sent，已发跳过 → job 重试不重复发。
- 验收:migration 跑通;email_log 带 batchId;重跑同 batchId 不重复发(单测构造已发行断言跳过)。

### F003 — send-email-batch handler + sendBatchAction 异步化 + 状态查询(generator)
- `handlers/register.ts` 注册 `send-email-batch` handler:在 worker 内跑 `batchSendOutreach(tenantId,userId,campaignId,items,batchId,{skipSleep:false})`(节流 sleep 留 worker)。
- `sendBatchAction`:生成 `batchId`(uuid) → `jobQueue.add('send-email-batch', {tenantId,userId,campaignId,items,batchId})` → **立即返回** `{ok,batchId,total}`(去掉 60s race + 同步 await)。
- **Redis 挂回退(D5):** 入队失败 → 回退同步 `batchSendOutreach`(旧行为)+ 返回同步结果 + 日志告警。
- 新 action `getSendBatchStatus(batchId)`:`withTenant` 查 email_log by batchId 计数 `{total, sent, failed, mock_sent, pending=total-处理数}`。
- 验收:发送立即返回 batchId 不阻塞;worker 后台跑;状态查询计数正确;Redis 挂回退同步通;单测(enqueue 路径 + 回退路径 + 状态计数)。

### F004 — OutreachComposer 异步进度 UX(generator)
- 发送按钮 → 调 sendBatchAction 拿 batchId → 显"发送中 X/Y"进度(轮询 getSendBatchStatus 每 ~2s) → 完成显 sent/failed 汇总;失败/超时优雅提示。回退同步路径(无 batchId/直接结果)兼容显示。
- i18n 5 locale(zh/en/ja/ko/es) 新文案(发送中/进度/完成/失败)。
- 验收:UI 发送不再卡 60s;进度条随 worker 推进;>10 收件人正常完成;含组件测试(轮询 mock + 进度渲染 + 完成态)。

### F005 — Codex L1+L2 + signoff(codex)
- L1:lint 0err warn≤3 / tsc=0 / npm test(含各 feature 新测)。
- L2 部署后 staging:① BullMQ worker 随进程启动(instrumentation 日志/health);② 发 **>10 收件人** → 立即返回 + 进度推进 + 完成，**不再 60s 超时**;③ **job 持久化**:发送中 `pm2 reload`/重启 → worker 续跑剩余(Redis 中 job 不丢);④ Redis 挂(临时停)→ 回退同步发送 + 告警;⑤ prewarm 在 BullMQ 下仍工作;⑥ 幂等:job 重试不重复发。
- signoff `docs/test-reports/BL-100-signoff-2026-06-XX.md`。

## §3 风险与部署

- **Redis 升为发送主路径依赖**:D5 回退兜底;部署确认 `REDIS_URL` 配置(prod db1/staging db2 已有)。
- **Next 多 worker fork**:每进程一 BullMQ worker，用 concurrency=1 + 一 batch 一 job 控全局节流(跨进程同时两 batch 是罕见边缘，可接受;如需严格全局限流后续用 BullMQ Redis limiter)。
- **schema migration(F002 batchId)**:nullable 加列，安全;部署 `prisma migrate deploy`。
- **异步 UX 改变用户行为**:发送从"等待结果"变"进度条"，符合预期(本批目的)。
- ⚠️ 部署 staging+prod(手动触发)OOM NODE_OPTIONS=4096;worker 进程内不加新进程。
- prewarm 自动迁移 BullMQ —— F005 须验证其仍工作(register 起 worker)。
