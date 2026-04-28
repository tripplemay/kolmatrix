# B6 ↔ MVP-kol-seed-redo F002 接力条款验证（占位 · 待 day-5 填充）

> **状态：占位，未签收。** 本报告由 B6-F006 在 building 阶段（2026-04-28 day-2）起草框架；接力条款的真实验证必须发生在 B6 启动后第 5 天（~2026-05-03，prod cron 第 5 次自动跑完之后），由 Generator 跑数据 + Evaluator 在 reverifying 阶段确认。
>
> **不要把这份占位当作 PASS 报告。** F006 不能在 ~05-03 数据回填之前签收。

---

## 1. 接力条款来源

来自 `MVP-kol-seed-redo` F002 fix-round 1（2026-04-27 16:00 用户决议）：

> 接受 F002 现状（total=760 / CN+HK+TW=83 / quota=8077），由 B6 daily-sync 接力补缺口。
> **B6 启动后第 5 天（~2026-05-03）验证 staging 累计：**
>
> - `total ≥ 1000`（kol-seed-redo F002 原 spec 是 ≥1000；760 + B6 第 1-5 天 ~150-250 增量 → 应 ≥ 1000）
> - `CN+HK+TW ≥ 150`（kol-seed-redo F002 原 spec 是 ≥200；接力补缺口的硬保证；83 + B6 第 1-5 天 CN/HK/TW keyword 倾向 ~70-100 → 应 ≥ 150）
>
> 如未达标，B6 F006 标 FAIL → 进入 fixing：F002 `DAILY_KEYWORDS_BY_REGION` 调中文区 keyword 倾向，5-10 天补完。

签收口径见 `docs/test-reports/MVP-kol-seed-redo-signoff-2026-04-27.md` §"上轮阻断闭环 §1 F002"。

---

## 2. B6 cron 时间线（验证日的前置条件）

| 北京时间 | 事件 | quota 估算（每次） |
|---|---|---|
| 2026-04-27 ~16:30 | B6 building 启动 | — |
| 2026-04-28 08:30 | prod cron 首跑（day-1） | 1,800u |
| 2026-04-29 08:30 | prod cron day-2 | 1,800u |
| 2026-04-30 08:30 | prod cron day-3 | 1,800u |
| 2026-05-01 08:30 | prod cron day-4 | 1,800u |
| 2026-05-02 08:30 | prod cron day-5 | 1,800u |
| 2026-05-03 ~10:00 | **本报告填充窗口**：所有 5 次 cron 已跑 + Generator 拉 staging 数据 | — |

> **prod cron 与 staging 同读一个 API key**（10K/day 共享）。spec §F003 已 lock：staging 仅手动跑，prod 每日自动；本验证读 staging DB 是因为 demo seed 留在 staging 而非 prod。

---

## 3. 验证步骤（~2026-05-03 Generator 执行）

1. SSH staging：`ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix-staging && pm2 logs kolmatrix-staging --lines 0 --nostream'` 确认 app 在线。
2. 拉 staging DB metadata（Read-Only psql）：

   ```sql
   SELECT
     COUNT(*) FILTER (WHERE platform = 'youtube' AND metadata->>'is_demo' IS NOT NULL) AS yt_total,
     COUNT(*) FILTER (WHERE platform = 'youtube' AND country = ANY (ARRAY['CN','HK','TW'])) AS yt_cn_hk_tw,
     COUNT(*) FILTER (WHERE platform = 'youtube' AND metadata->>'source' = 'youtube-api-daily') AS b6_added,
     COUNT(*) FILTER (WHERE platform = 'youtube' AND metadata->>'is_demo' = 'true') AS seed_baseline
   FROM "Kol";
   ```

3. 把结果填到 §4 表格，并把 `b6_added` 拆到日级粒度（5 行）：读 `/var/log/kolmatrix-kol-sync.log` 5 个 INFO 行的 `discoverCount`/`inserted`。
4. 把 prod 的 cron 日志 `/var/log/kolmatrix-kol-sync.log` 同步取一份留存到 `docs/test-reports/kol-sync-daily-{2026-04-28..2026-05-02}.md` 5 份日报（F003 spec 已要求 cron 自写，这里只确认存在）。
5. 判定接力条款 PASS/FAIL，按下方 §5 决策树。

---

## 4. 数据采集（待填充）

| 指标 | 阈值 | day-5 staging 实测 | 结论 |
|---|---|---|---|
| `total`（YouTube 平台总条数）| `≥ 1000` | TBD | TBD |
| `CN+HK+TW`（country 字段）| `≥ 150` | TBD | TBD |
| `b6_added`（metadata.source='youtube-api-daily'）| 期望 ≥ 200（5 天 × 30-50/day）| TBD | TBD |
| 5 次 cron 全 INFO（无 WARN/ALERT）| 5/5 INFO | TBD | TBD |
| 5 天累计 quota_consumed | `≤ 9,500u`（5 × 1,800 + 余量）| TBD | TBD |

### 4.1 prod cron 日志摘要（待填充）

```
2026-04-28 ... discoverCount=?? refreshCount=?? inserted=?? quota=??
2026-04-29 ... discoverCount=?? refreshCount=?? inserted=?? quota=??
2026-04-30 ... discoverCount=?? refreshCount=?? inserted=?? quota=??
2026-05-01 ... discoverCount=?? refreshCount=?? inserted=?? quota=??
2026-05-02 ... discoverCount=?? refreshCount=?? inserted=?? quota=??
```

### 4.2 region 分布对比（待填充）

| country | seed 基线（2026-04-27） | day-5 staging | 增量 |
|---|---|---|---|
| CN | 91 | TBD | TBD |
| HK | 24 | TBD | TBD |
| TW | 10 | TBD | TBD |
| US | 206 | TBD | TBD |
| GB | 99 | TBD | TBD |
| JP | 176 | TBD | TBD |
| KR | 85 | TBD | TBD |
| ES | 69 | TBD | TBD |
| 其他 | 0 | TBD | TBD |
| **合计** | **760** | TBD | TBD |

---

## 5. 决策树

- **PASS（双指标都达标）：** F006 接力条款 sub-acceptance ✅；B6 进入 reverifying 收尾。
- **PARTIAL（仅 total ≥ 1000，CN+HK+TW < 150）：** 进入 fixing，仅调 `src/lib/kol-sync/adapters/youtube.ts` 的 `DAILY_KEYWORDS_BY_REGION` 给 CN/HK/TW 加 1-2 个 keyword（不动 dispatcher / quality / cron），下一周末（~2026-05-10）再读一次 staging 数据复验。
- **FAIL（total < 1000）：** 进入 fixing，分析 prod cron 日志找根因（quota / dedupe rate / region 分布异常）；fix_rounds += 1。
- **PROD 故障（cron 5 天有 ≥ 2 天 ALERT）：** 暂停接力条款判定，先按 `docs/dev/kol-sync-runbook.md` §故障处理走 runbook。

---

## 6. 备注（占位阶段）

- 占位创建于 `2026-04-28`（B6 day-2，F006 building 阶段）。
- 接力条款验证依赖 5 天 cron 自动跑完，**今天无法签收 F006**。
- F006 其他 sub-acceptance（spec 链 grep + crawler-team.ts.todo 占位 + tests + load test）已在 day-1 / day-2 交付，见 commit chain。
- **2026-04-28 14:30 BJ A 方案 lock（用户裁决）：** staging 手动 sync 验证（acceptance #5）今日独立跑，**不与本 day-5 接力条款验证合并**；F006 拆分为本批次 done（#1-3 + #5）+ 跨批次延迟（#4 即本报告）两段。
- **prod cron deploy 缺口（2026-04-28 发现）：** `infrastructure/cron/kolmatrix-kol-sync` 入 git ✅，但 VM `/etc/cron.d/` 未拷贝；prod git SHA 仍在旧版（不含 sync script），需用户先触发 prod redeploy 再 deploy cron，否则 cron 跑会报 `Missing script "kol-sync:daily"`。**本 day-5 接力条款验证依赖 prod cron 在 5 天内每日自动跑**；如 cron 未及时部署，day-5 数据会全部依赖 staging 手动跑 → 接力条款判定改用 staging 数据为准（该报告 §3 已写明）。

---

## 7. 修订记录

| 日期 | 操作 | 操作人 |
|---|---|---|
| 2026-04-28 | 占位骨架创建 | Generator (johnsong/Kimi) |
| ~2026-05-03 | 数据回填 + 判定 | Generator |
| ~2026-05-03 | 复验签收 | Evaluator (Reviewer) |
