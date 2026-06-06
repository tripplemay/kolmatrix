# BL-091-F003 · 344 backfill 入队脚本(我方 ops)

> **状态：** ✅ **脚本完成 + PR 已开 → https://github.com/guang-tech/apify/pull/8**
> （`packages/service/scripts/bl091-yt-email-backfill.ts`，分支 `bl091-f003-backfill`）。
> ⏳ **执行待用户确认**（实跑约 $41 + 写 prod apify_kol 库 + 触发 Apify actor runs）。
> 归档性质脚本，**运行不强依赖 PR merge**（可从 VM 检出直接跑）。

## 目的

对积压 youtube(`has_business_email=true` 且 `emails` 无 `@`，约 344 个)入队 `yt-email`，
已部署 worker(batchSize=1)自然消费。**走 Apify(SCALE 已付费)，不依赖 TikHub 充值**，
可在 Bug A/B merge 前先跑（立即价值，小批已验证 kol 6/9 解锁）。

## 设计

- 入队前先 `upsertQueued` 写 `yt_email_check_records`('queued')再 `boss.send` →
  即使 Bug B(PR #7)尚未部署，当前 worker 的 UPDATE 也命中已存在行 → 审计 + 去重立即可用。
- 幂等三层：本地 progress 文件 + DB 终态新鲜跳过(succeeded 永跳 / no_email 窗口内跳)+ pg-boss `singletonKey`。
- 限速(默认 1500ms/条)+ `--limit` 分批 + `--dry-run` / `--report` 预检。
- 复用 service `createBoss` / `getDb` / `YtEmailCheckRecordRepo.upsertQueued`，零重复。

## 运行步骤（待用户授权后执行）

```bash
# 在 prod VM,DATABASE_URL 指向 apify_kol 库(容器内 5432 / 宿主 localhost:15432)
cd /opt/apify-kol-service && git fetch && git checkout bl091-f003-backfill   # 或 merge 后用 master
cd packages/service

# 1. 先看现状(候选数 / 记录分布 / 邮箱覆盖),不写不发
DATABASE_URL=<apify_kol> npx tsx scripts/bl091-yt-email-backfill.ts --report
# 2. dry-run 确认候选
DATABASE_URL=<apify_kol> npx tsx scripts/bl091-yt-email-backfill.ts --dry-run
# 3. 小批试跑(10 条 ≈ $1.2)验证端到端链路通
DATABASE_URL=<apify_kol> npx tsx scripts/bl091-yt-email-backfill.ts --limit=10
#    跑后 --report 看 queued→running→succeeded/no_email + kols.emails 是否新增
# 4. 全量(约 344 ≈ $41)
DATABASE_URL=<apify_kol> npx tsx scripts/bl091-yt-email-backfill.ts
```

## 本地验证（已完成）

- 单测 `tests/unit/bl091-backfill-select.test.ts` 7/7(幂等筛选纯逻辑)。
- 真实 PG(colima)：候选筛选正确(排除已有邮箱 / 无 flag)、`queued` 行写入、
  pg-boss 入队、progress 增量、**重跑 0 入队幂等**。

## 执行记录（待回填）

| 项 | 值 |
|---|---|
| 实跑日期 / 批量 | _待回填_ |
| 解锁数 / NO_EMAIL / 失败 | _待回填_ |
| kols.emails 真实新增抽样 | _待回填_ |
| 实际成本 | _待回填_ |
