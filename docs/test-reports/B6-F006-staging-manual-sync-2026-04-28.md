# B6-F006 acceptance #5 · staging 手动 sync 验证

> **状态：PASS（用户 2026-04-28 BJ 15:10 同意 Ⅱ+Ⅲ 组合：宽松读 + 修订 acceptance 措辞）。**

---

## 1. 背景

来自 `B6-kol-daily-sync` F006 acceptance（A 方案 lock 2026-04-28 13:15 BJ）：

> #5 staging 手动 sync 验证 — Generator 立即做（A 方案）

acceptance #1-3 已在 day-1/day-2 交付（tests + spec 链 + crawler-team.ts.todo）；#4 接力条款延迟跨批次到 ~05-03 单独验证。本报告只覆盖 **#5**。

### 1.1 acceptance 措辞修订（用户 2026-04-28 BJ 15:10 lock）

原 spec：

> staging 一次手动 sync 验证（≥ 30 KOL 真入库 + log 完整）

修订为：

> staging 一次手动 sync 验证：**(a) 链路无 error**；**(b) ≥ 30 条 KOL 记录被本次 sync 触达（insert OR update，以 last_synced_at ≥ 本次 sync started_at 为准）**；**(c) structured log 含 level/discoverCount/estimatedQuotaConsumed 字段且 level ≠ ALERT**。

修订原因：staging DB 已有同源历史数据（昨日 Generator 测试沉淀 400 条）使得 daily matrix（6×3×10）的 dedupe 命中率高，"新插入"与"链路写入"是两个概念。后者更能反映 prod cron 的真实行为。详细分析见 §4.

---

## 2. 执行环境

| 项 | 值 |
|---|---|
| VM | `instance-20260403-154049` (`34.180.93.185`) |
| 应用目录 | `/opt/kolmatrix-staging` |
| staging git SHA | `f740caf`（含 sync 脚本） |
| DB | `kolmatrix_staging` Postgres，与 prod 同实例 |
| YouTube API key | 共用（staging + prod 同 key） |
| log 路径 | `/tmp/kolmatrix-kol-sync-staging-2026-04-28.log`（覆盖默认 `/var/log/...`，避开 sudo 写入需求） |
| quota 窗口 | PT-day（00:00 PDT = 07:00 UTC = 15:00 BJ） |
| 本次 sync 起点 | `2026-04-28T07:01:40.857Z`（quota reset 后 10s）|

---

## 3. 实测

### 3.1 命令

```bash
ssh tripplezhou@34.180.93.185 "cd /opt/kolmatrix-staging && \
  KOL_SYNC_LOG_PATH=/tmp/kolmatrix-kol-sync-staging-2026-04-28.log \
  NODE_OPTIONS='--max-old-space-size=2048' \
  npm run kol-sync:daily"
```

### 3.2 stdout

```
> kolmatrix@0.1.0 kol-sync:daily
> tsx scripts/kol-sync-daily.ts

[kol-sync-daily] starting (dryRun=false refreshBatch=200 noRefresh=false)
[kol-sync-daily] DONE — report: /opt/kolmatrix-staging/docs/test-reports/kol-sync-daily-2026-04-28.md
[kol-sync-daily] level=INFO summary: discover=73 refresh=200 inserted=8 updated=265 errors=0 quota_est=1805
```

### 3.3 structured log（最后一条 JSON）

```json
{
  "timestamp": "2026-04-28T07:01:40.857Z",
  "endedAt": "2026-04-28T07:01:55.285Z",
  "adapters": [{"name": "youtube", "healthy": true}],
  "discoverCount": 73,
  "refreshCount": 200,
  "inserted": 8,
  "updated": 265,
  "skipped": 0,
  "dedupeSkipped": 0,
  "estimatedQuotaConsumed": 1805,
  "estimatedQuotaRemaining": 8195,
  "errors": [],
  "zeroDiscoverStreakBefore": 2,
  "durationMs": 14428,
  "level": "INFO",
  "alerts": []
}
```

### 3.4 staging daily markdown report（自动写入）

`/opt/kolmatrix-staging/docs/test-reports/kol-sync-daily-2026-04-28.md`：

```markdown
# kol-sync daily report — 2026-04-28

- Started: 2026-04-28T07:01:40.857Z
- Ended:   2026-04-28T07:01:55.285Z
- Estimated quota consumed: 1805 units

## Adapter health
- youtube: healthy { probeChannelId: UCBR8-60-B28hp2BmDPdntcQ, ..., quotaCostThisProbe: 1 }

## Discover
- Total raw rows: 73
- Failed adapters: 0
- Imported: inserted=8 updated=65 skipped=0

## Refresh
- Total raw rows: 200
- Imported: inserted=0 updated=200 skipped=0
```

### 3.5 DB 入库前后对比（DATABASE_ADMIN_URL 直连，绕 RLS）

| 指标 | sync 前 | sync 后 | 增量 |
|---|---|---|---|
| `total_kol`（全库） | 3,295 | 3,303 | +8 |
| `yt_kol`（platform=youtube） | 3,289 | 3,297 | +8 |
| `metadata.source='youtube-api-daily'` 总数 | 400 | 643 | +243（含 8 新插入 + 235 旧记录因 upsert 改 source） |
| **last_synced_at ≥ 07:01 UTC（本次 sync 触达）** | — | **273** | — |
| `country_code IN ('CN','HK','TW')` | 105 | 待 day-5 单独统计 | 跨批次 |

> sync 前基线读取时间：2026-04-28 06:23:50 UTC（发现 quota 耗尽前的 baseline）
> sync 后基线读取时间：2026-04-28 07:02:30 UTC（sync 完成后 35s）

### 3.6 quota 消耗

- 健康检查：1u（probe `UCBR8-60-B28hp2BmDPdntcQ`）
- discover 全矩阵：~1,800u（6 region × 3 keyword × 10 results × 100u/search）
- refresh：4u（200 staleIds / 50 ≈ 4 batch × 1u）
- 实测合计：**1,805u**（与 spec §F002 lock "~1800-2000 units/day" 一致）
- 本 PT-day 剩余：8,195u（足够明日 prod cron 自动跑）

---

## 4. 判定（按修订后 acceptance）

- [x] **(a) 链路无 error** — `errors=[]`、`level=INFO`、stderr 静默
- [x] **(b) ≥ 30 条 KOL 记录被本次 sync 触达** — 273 条 `last_synced_at ≥ 07:01 UTC`（远超 30 阈值）
- [x] **(c) structured log 含必要字段且 level ≠ ALERT** — 含 `level=INFO / discoverCount=73 / estimatedQuotaConsumed=1805 / errors=[]`，无 ALERT

**PASS** ✅

---

## 5. 解读：为何"新插入" 8 < 30 不视为 acceptance 失败

| 维度 | 解读 |
|---|---|
| 真新插入 | 8（discover 73 中 65 已 dedupe 命中昨日同源 400 条） |
| 写入触达 | 273（修订后 acceptance 主指标） |
| spec 原文意图 | "≥ 30 KOL 真入库" — 制定时未考虑 staging 已存在大量同源历史记录的 dedupe 行为 |
| 真实 prod cron 行为 | 同样会 dedupe，不会重复消耗 quota；新插入数随 KOL 池稳态化而递减是健康的 |
| 总体目标（PRD §12） | 每日 +30-50 真新 KOL — 这是 **生产环境长期统计指标**，非"单次 staging 验证"指标 |
| Day-5 接力条款 | 由 `B6-kol-seed-redo-handoff-validation-2026-05-03.md` 单独验证（CN+HK+TW ≥ 150）|

**结论：** 修订 acceptance 措辞使其反映 prod cron 真实行为，避免把"早期 ramp-up 期 dedupe 命中"误判为 sync 链路失败。

---

## 6. 备注

- 本次 sync 仅验证 **staging 链路**，**不**代表 prod cron 已就位。prod cron 部署被 prod redeploy（用户行动项）阻塞 — 见 `progress.json` session_notes 与 `B6-kol-seed-redo-handoff-validation-2026-05-03.md` §6。
- 同一 YouTube API key 在 PT-day 内 staging + prod 共享 10K quota；本次安排在 PT 00:00 = UTC 07:00 = BJ 15:00 quota reset 后立即跑（07:01:40Z），8,195u 余量留给后续 prod cron。
- F006 整体进度：1-3 + 5 done（本批次签收 4/5）；#4 接力条款延迟到 ~05-03 单独验证（不阻塞 B6 done）。

---

## 7. 修订记录

| 日期 | 操作 | 操作人 |
|---|---|---|
| 2026-04-28 14:30 BJ | 报告骨架创建 | Generator (cli=Kimi 本会话固定身份) |
| 2026-04-28 15:01 BJ | quota reset 后跑 staging sync，回填实测 | Generator |
| 2026-04-28 15:10 BJ | 用户裁决 Ⅱ+Ⅲ 组合：宽松读 PASS + 修订 acceptance 措辞 | Planner（用户行使）|
| 2026-04-28+ | Reviewer 复验签收 | Evaluator (Reviewer) |
