# BL-059 YouTube Data API 链路 deprecate + apify-kol engagement_rate derive Spec

> KOLMatrix KOL 数据源从双源（B6 youtube-api-daily + apify-kol）切换到单源（apify-kol），
> 同时 apify-kol mapper 加 engagement_rate derive 计算补偿 BL-023 真信号丢失。
>
> - **Spec 起草日期：** 2026-05-09
> - **Spec 作者：** Planner johnsong
> - **批次类型：** mixed batch（mapper feature + 数据 ops + 删除清理 + 文档）
> - **状态：** Locked → Building（features.json F001-F007）

---

## 1. 背景与目标

### 1.1 业务背景

BL-012 v5 完成（5/9 00:43 signoff PASS @ commit `b61ac4f`）后 KOLMatrix Kol 表呈双源状态：
- `youtube-api-daily`: **2584 KOL**（B6 daily sync 主力，含 141 真 engagement_rate 信号 — BL-023 5/7 全量 recompute 资产）
- `apify-kol`: **237 KOL**（5/9 00:30 dispatcher 一次性 sync 入库，全 NULL engagement_rate）
- `<null>`: 12 KOL（早期 mock seed）

用户 5/9 决议**简化数据源 + 切换爬虫团队全权负责**：
- 删除 KOLMatrix 端 B6 YouTube Data API daily sync 链路
- soft delete 既有 2584 youtube-api-daily KOL（保留 30 天可恢复 + audit_log 留 trail）
- apify-kol mapper 加 engagement_rate derive 计算补偿 141 真信号丢失

### 1.2 用户决议（5/9 brainstorming Q1-Q3 + Approach A lock）

| # | 决议项 | 选择 | 理由 |
|---|---|---|---|
| Q1 | 删除粒度 | C — 链路删 + soft delete + audit_log | 可逆 / FK 不破 / 沿用 BL-051a 模式 |
| Q2 | 时间线 | A — 立即（5/9 当天）执行 | 用户接受 5/13 上线 KOL 锐减风险 |
| Q3 | 例外保留 | 立即同时 derive engagement + 全部 soft delete | apify-kol mapper derive 提供 engagement proxy 替代 141 真信号 |
| Approach | 实施形式 | A — 单批次 BL-059 | 干净 audit trail / 立即执行 / 单批次回滚易 |

### 1.3 业务目标

1. **简化数据源** — 单源依赖 apify-kol-service（爬虫团队全权负责）
2. **业务面 KOL 数量过渡** — 5/9 当天 prod 立即从 ~2800 → ~250；5/13 上线对外含完整 apify-kol 累积数据（cron 5/9-5/13 累积预期 ~500-1000）
3. **engagement_rate 数据连续性** — apify-kol mapper derive 提供 engagement proxy，KOL valueScore 排序信号保留
4. **可逆机制** — soft delete 30 天内可恢复（应急容灾）+ audit_log 留 trail + youtube.ts git revert 可

### 1.4 范围边界

**本批次包含：**
- mapper 加 engagement_rate derive（F001）
- 全量 recompute apify-kol 既有 237 KOL engagement_rate（F002 SQL ops）
- soft delete 2584 youtube-api-daily KOL + audit_log（F003 SQL ops）
- 删除 youtube.ts adapter + engagement-batch.ts + engagement-batch-client.ts（F004）
- dispatcher / scripts / quality.ts / refresh-selector.ts 移除 youtube 注入 + source 分支（F005）
- 文档清理（B6 spec archive + runbook 改单 adapter + environment.md + env vars，F006）
- L1 全套验证 + staging smoke（F007）

**本批次不包含：**
- 硬删（DELETE）youtube-api-daily 数据 — 30 天 soft delete 窗口后另起评估批次
- fork apify-kol-service 端代码改动（爬虫团队负责）
- 主流程 UI 调整（discovery / database 自动按 deleted_at IS NULL filter，无需 UI 改）
- 新增 fork 端 comments 字段（fork 端待实装，BL-058 sub-feature 跟踪）
- B6 历史数据归档 / export（30 天可恢复路径已足）

---

## 2. 关键设计决策

### 2.1 删除粒度 = soft delete（决议 Q1=C）

**为什么 soft delete 不硬删：**
- 30 天可恢复窗口（应急容灾，BL-058 跟踪 fork 数据质量 + 4 维度迭代如不达标可恢复双源）
- FK 不破（既有 schema query 已含 `WHERE deleted_at IS NULL`，BL-051a 实装）
- audit_log 留 trail — `action='kol.bulk_soft_delete'` 含 payload 完整记录每条 KOL FK 关联 + engagement_rate + value_score
- 30 天后评估：硬删（DELETE）vs 永久 soft delete 保留

**为什么不 A.3 例外保留 ~200-400 KOL（用户决议放弃）：**
- 用户决议 Q3 + 立即 derive 子 feature → engagement proxy 替代 141 真信号
- 例外保留 SQL 复杂（kol_campaign DISTINCT UNION email_log DISTINCT UNION engagement_rate IS NOT NULL）+ 维护成本
- 30 天 soft delete 窗口已是 fail-safe

### 2.2 engagement_rate derive 简化公式（决议 Q3 子 feature）

```ts
engagement_rate = (totalLikes / postsCount) / followers * 100
```

**简化原因：** fork GET /kol response 不含 `totalComments` 字段（仅 `totalLikes` + `totalViews` + `postsCount` + `followers`）。完整公式应为 `(likes + comments) / posts / followers`。当前简化为 likes-only 作 engagement proxy。

**与 BL-023 youtube engagement_rate 公式对比：**
| 维度 | BL-023 (youtube-api-daily) | BL-059 (apify-kol derive) |
|---|---|---|
| 数据源 | YouTube Data API 单视频 stats（viewCount / likeCount / commentCount） | fork GET /kol 累计字段（totalLikes / postsCount / followers） |
| 公式 | 单视频 (likes + comments) / views *  100 → 取最近 N 视频均值 | 累计 totalLikes / postsCount / followers * 100 |
| 语义 | per-post engagement rate | 平均 like-per-follower per post |
| 准确度 | 高（含 comments） | 中（仅 likes，无 comments） |

⚠️ **数值范围差异：** 简化公式产出值可能比 BL-023 偏小（缺 comments 部分），后续如 fork 端补 comments 字段可升级公式（BL-058 sub-feature 跟踪）。

### 2.3 单源依赖 apify-kol（决议 Q1+Q2+Approach A）

**接受单源风险：**
- apify-kol-service 故障 → KOLMatrix daily-sync 无法获取新 KOL
- 30 天 soft delete 窗口可恢复双源（紧急回滚）
- BL-058 长期跟踪 fork 数据质量 4 维度迭代

**爬虫团队责任划分：**
- KOLMatrix 端不再维护 YouTube Data API key / quota / 抓取逻辑
- 全部委托爬虫团队负责（apify-kol-service 端）
- KOLMatrix 端仅消费 fork GET /kol HTTP API（数据流隔离铁律 §2.2 严格遵守）

### 2.4 acceptance 边界（v0.9.16 P5.2 应用）

本批次 acceptance **不含**全套 `npm run test:integration` 普遍绿门槛。`pre-commit-hook.test.ts` flaky 已 BL-054 治理。Reviewer 验收只看 BL-059 引入测试 + spec acceptance 表逐项 + staging smoke。

---

## 3. 数据 SQL 策略

### 3.1 F002 — 全量 recompute apify-kol engagement_rate

```sql
-- 受影响：237 apify-kol KOL（fork 端 follower_count + raw.totalLikes + raw.postsCount 完整）
-- 不影响：null follower_count 或 postsCount 的 KOL → engagement_rate 设 NULL
UPDATE kol SET 
  engagement_rate = CASE 
    WHEN follower_count > 0 
      AND (raw->>'postsCount')::int > 0 
      AND (raw->>'totalLikes')::bigint IS NOT NULL
    THEN ((raw->>'totalLikes')::bigint::float / (raw->>'postsCount')::int) / follower_count * 100
    ELSE NULL
  END,
  updated_at = now()
WHERE metadata->>'source' = 'apify-kol' AND deleted_at IS NULL;
```

**验证：** F002 done 后 query `SELECT COUNT(*) WHERE metadata.source='apify-kol' AND engagement_rate IS NOT NULL` 应 ≥ 200（大部分 derive 成功；少量 follower_count=0 / postsCount=0 NULL OK）。

### 3.2 F003 — soft delete youtube-api-daily 2584 KOL

```sql
BEGIN;

-- audit_log 先落（每条 KOL 一行 audit）
INSERT INTO audit_log (tenant_id, user_id, action, resource_type, resource_id, payload, created_at)
SELECT k.tenant_id, NULL, 'kol.bulk_soft_delete', 'kol', k.id::text,
  jsonb_build_object(
    'source', 'youtube-api-daily',
    'reason', 'BL-059 deprecate B6 youtube-api-daily, switch to apify-kol single source',
    'kol_campaign_count', (SELECT COUNT(*) FROM kol_campaign WHERE kol_id = k.id),
    'email_log_count', (SELECT COUNT(*) FROM email_log WHERE kol_id = k.id),
    'engagement_rate', k.engagement_rate,
    'value_score', k.value_score,
    'follower_count', k.follower_count,
    'platform', k.platform,
    'handle', k.handle
  ),
  now()
FROM kol k
WHERE k.metadata->>'source' = 'youtube-api-daily' AND k.deleted_at IS NULL;

-- soft delete
UPDATE kol SET 
  deleted_at = now(), 
  updated_at = now()
WHERE metadata->>'source' = 'youtube-api-daily' AND deleted_at IS NULL;

COMMIT;
```

**预期受影响：** 2584 行 audit_log + 2584 KOL `deleted_at = now()`。

**验证：** F003 done 后两 query：
- `SELECT COUNT(*) FROM kol WHERE metadata.source='youtube-api-daily' AND deleted_at IS NOT NULL` = 2584
- `SELECT COUNT(*) FROM audit_log WHERE action='kol.bulk_soft_delete' AND created_at >= '2026-05-09'` = 2584

### 3.3 30 天回滚机制

```sql
-- 应急回滚：恢复 youtube-api-daily KOL（30 天内可执行）
UPDATE kol SET 
  deleted_at = NULL,
  updated_at = now()
WHERE metadata->>'source' = 'youtube-api-daily' 
  AND deleted_at >= '2026-05-09 00:00:00' 
  AND deleted_at <= '2026-05-09 23:59:59';

-- audit_log 留 trail（不删 audit），加新 audit 记录恢复
INSERT INTO audit_log (tenant_id, user_id, action, resource_type, resource_id, payload, created_at)
SELECT tenant_id, NULL, 'kol.bulk_restore', 'kol', id::text,
  jsonb_build_object('reason', 'BL-059 emergency rollback')
FROM kol WHERE metadata->>'source' = 'youtube-api-daily' AND deleted_at IS NULL;  -- 已恢复的
```

---

## 4. mapper derive engagement_rate 实装（F001）

### 4.1 修改文件

`src/lib/kol-sync/adapters/apify-kol.ts` 内 `mapApifyKolItemToRawKolData()` 函数。

### 4.2 derive 公式实装

```ts
function mapApifyKolItemToRawKolData(item: ApifyKolItem): RawKolData {
  // ... 既有字段映射

  // BL-059 F001: derive engagement_rate
  // 简化公式（fork GET /kol 不含 totalComments，仅 totalLikes 作 proxy）
  const followers = item.followers ?? 0;
  const postsCount = item.postsCount ?? 0;
  const totalLikes = item.totalLikes ?? 0;
  const engagementRate = followers > 0 && postsCount > 0
    ? (totalLikes / postsCount) / followers * 100
    : null;

  return {
    // ... 既有字段
    engagement_rate: engagementRate,
    raw: { ... item },  // 保留 fork 全部 raw 数据
  };
}
```

### 4.3 单测 ≥ 3 case

- Case 1: 完整数据（followers=100K, postsCount=50, totalLikes=500K）→ engagement_rate ≈ 10
- Case 2: followers=0 或 postsCount=0 → engagement_rate=null
- Case 3: totalLikes=null → engagement_rate=null

### 4.4 类型 / null 处理

- `RawKolData.engagement_rate: number | null`（既有类型，与 BL-023 模式一致）
- 边界 case：followers > 0 但 postsCount=0 → null（不应除 0）
- 边界 case：postsCount > 0 但 totalLikes=null → null（不假设 0 likes）

---

## 5. 删除清单（F004 + F005 + F006）

### 5.1 F004 — 删除文件

| 文件 | 大小 | 内容 |
|---|---|---|
| `src/lib/kol-sync/adapters/youtube.ts` | ~21KB | YouTube Data API adapter (B6 实装) |
| `src/lib/kol-sync/engagement-batch.ts` | ~7.5KB | YouTube engagement batch enricher |
| `src/lib/kol-sync/engagement-batch-client.ts` | ~3KB | YouTube API engagement batch client |
| `src/lib/kol-sync/adapters/__tests__/youtube*.test.ts`（如有） | — | YouTube adapter 单测 |
| `src/lib/kol-sync/__tests__/engagement-batch*.test.ts`（如有） | — | engagement batch 单测 |
| `tests/integration/import-kol-from-youtube.test.ts` | — | YouTube import 集成测试 |

### 5.2 F005 — 修改文件（移除 youtube 引用）

| 文件 | 修改 |
|---|---|
| `src/lib/kol-sync/dispatcher.ts` | 移除 `YouTubeKolSyncAdapter` import + 数组注入 |
| `scripts/kol-sync-daily.ts` | 移除 `new YouTubeKolSyncAdapter(...)` 注入 |
| `src/lib/kol-sync/quality.ts` | 移除 `'youtube-api-daily'` source 分支（如有专属 quality 规则）|
| `src/lib/kol-sync/refresh-selector.ts` | 移除 youtube 平台特殊逻辑（如有）|

### 5.3 F006 — 文档清理

| 文件 | 操作 |
|---|---|
| `docs/specs/B6-kol-daily-sync-spec.md` | 移到 `docs/archive/B6-kol-daily-sync-spec.md` + 加 deprecation header（"BL-059 deprecate 5/9，单源切 apify-kol"）|
| `docs/dev/kol-sync-runbook.md` | §"双 adapter 双源容灾" → §"apify-kol 单源 + cron schedules + 30 天 soft delete 回滚机制" |
| `.auto-memory/environment.md` | secrets 表 / sync 段移除 YouTube Data API key 引用 |
| `.env.production` + `.env.staging`（VM ops）| 移除 `YOUTUBE_DATA_API_KEY` env var（SSH ops）|

---

## 6. features 拆分

详 features.json F001-F007。每条 acceptance Reviewer 逐项验收 PASS。

---

## 7. 实施流程 + 时间线

```
5/9 当天   spec lock + features.json + progress.json 切 building
5/9       Generator 接力 building (F001-F007 ~2-3h)
  ├─ F001 mapper derive engagement_rate + 单测
  ├─ F002 SQL ops 全量 recompute apify-kol engagement_rate (Generator/Planner SSH)
  ├─ F003 SQL ops soft delete youtube-api-daily 2584 + audit_log (Generator/Planner SSH)
  ├─ F004 删除 youtube.ts + engagement-batch* 文件
  ├─ F005 dispatcher / scripts / quality / refresh-selector 移除 youtube
  ├─ F006 文档清理 + env vars
  └─ F007 L1 + staging smoke
5/9 ~晚   building done → verifying → Reviewer signoff
5/9 当晚  prod redeploy 含 BL-059
5/13 ⭐   上线对外（含 apify-kol 单源 + cron schedules 累积 ~500-1000 KOL）
6/8       30 天 soft delete 窗口结束 — 评估硬删 vs 永久 soft delete
```

---

## 8. 测试策略

### 8.1 单测（F001 同 commit）

`src/lib/kol-sync/adapters/__tests__/apify-kol.test.ts` 加 ≥3 case：
- 完整数据 derive engagement_rate
- followers=0 / postsCount=0 → null
- totalLikes=null → null

### 8.2 SQL ops 验证（F002 + F003）

- F002: `npx vitest run` 跑 mapper 单测前先在 staging DB 跑 recompute SQL 验证 query 正确（dry-run + count check）
- F003: staging DB 先跑 soft delete + audit_log SQL（事务回滚验证）→ verify count 后再 prod

### 8.3 集成测试

- 既有 `tests/integration/apify-kol-adapter.test.ts` 5 case 仍 PASS
- 删 `tests/integration/import-kol-from-youtube.test.ts`（如有）

### 8.4 L1 全套（F007）

`npm run lint` 0 / `npx tsc --noEmit` 0 / `npm test` 159 files / 1131+ tests PASS（含新 mapper 单测 + 删除 YouTube 测试后调整数）/ `npm run test:integration` apify-kol-adapter PASS（pre-commit-hook flaky 按 v0.9.16 P5.2 不计入）

### 8.5 Staging + Prod 验证

- staging deploy + smoke：`/zh/admin/apify-preview` 渲染正常 + 4 维度 stats / `/zh/discovery` + `/zh/database` KOL 数量 ~250
- prod redeploy + smoke：同 staging
- prod DB query：3 关键 count 验证（详 §10 DoD）

---

## 9. 风险与缓解 + 回滚

| 风险 | 影响 | 缓解 |
|---|---|---|
| soft delete 后业务面 KOL ~2800 → ~250 锐减 | UI 体验差 | 用户已决议接受（Q2=A）+ 5/9-5/13 cron 累积 ~500-1000 |
| 11 kol_campaign + 292 email_log FK 显示破 | UI 灰显 "(已删除 KOL)" | BL-051a soft delete UI 模式已实装；既有 query 含 deleted_at IS NULL |
| 141 真 engagement 信号丢失 | KOL valueScore 排序信号缺一维 | F001/F002 derive engagement proxy 替代；30 天可恢复 |
| apify-kol 单源故障无备份 | 单点故障风险 | 30 天 soft delete 可恢复双源（应急回滚 SQL §3.3）+ BL-058 跟踪 |
| derive 简化公式偏差（仅 likes 无 comments） | engagement_rate 数值偏小 | 提供 engagement proxy；BL-058 sub-feature 跟踪 fork 端补 comments 字段后改进 |
| valueScore 全网漂移 | top KOL 排序变化 | F002 全量 recompute apify-kol → valueScore 自然平衡（与 BL-023 全量 recompute 模式一致） |
| F003 SQL 事务失败（部分 audit_log 落了 update 没跑等）| 数据不一致 | SQL 用 BEGIN/COMMIT 事务保护 + staging 先跑 dry-run 验证 |
| YouTube Data API key 删除后 5/9-5/13 期间偶发依赖 | 隐藏 dependency | F005 grep 全仓 `process.env.YOUTUBE` 确认无残留依赖；F006 env vars 清理 |

### 9.1 回滚机制

| 层 | 回滚方法 |
|---|---|
| soft delete | SQL §3.3 30 天内可执行 `UPDATE deleted_at = NULL` 恢复 |
| youtube.ts 删除 | git revert BL-059 commit 恢复代码 |
| dispatcher 注入 | git revert + npm run build + pm2 reload |
| 全部回滚 | git revert + SQL §3.3 + redeploy |

### 9.2 应急判断

如 5/9-5/13 期间出现：
- prod /zh/discovery 业务方反馈 KOL 数量太少不可用
- apify-kol cron 故障导致 KOL 累积停止
- valueScore 全网严重漂移影响 marketers 排序

**立即应急回滚（铁律 #9 hotfix 流程）：**
1. Planner 分析根因 → 报告
2. 用户书面授权 → SSH SQL §3.3 恢复 + git revert + redeploy
3. BL-059 状态切 hotfix 处理

---

## 10. 完成判定（DoD）

### 10.1 features 全 done

- [ ] F001-F007 全 status=completed
- [ ] L1: lint 0 / tsc 0 / npm test 全 PASS

### 10.2 数据状态验证

- [ ] `SELECT COUNT(*) FROM kol WHERE metadata->>'source'='youtube-api-daily' AND deleted_at IS NOT NULL` = **2584**
- [ ] `SELECT COUNT(*) FROM kol WHERE metadata->>'source'='apify-kol' AND engagement_rate IS NOT NULL` ≥ **200**
- [ ] `SELECT COUNT(*) FROM audit_log WHERE action='kol.bulk_soft_delete' AND created_at >= '2026-05-09'` = **2584**
- [ ] prod /zh/discovery + /database 实地验证 KOL 数量 ~250（仅 apify-kol 数据）

### 10.3 代码状态验证

- [ ] `src/lib/kol-sync/adapters/youtube.ts` 不存在
- [ ] `src/lib/kol-sync/engagement-batch*.ts` 不存在
- [ ] `grep -rn "YouTubeKolSyncAdapter" src/` 0 结果
- [ ] `grep -rn "process.env.YOUTUBE" src/` 0 结果

### 10.4 Reviewer signoff

- [ ] Reviewer signoff PASS（A- 以上 / Ready）
- [ ] `progress.json.docs.signoff` 已填入新 signoff 报告路径

### 10.5 prod redeploy

- [ ] prod /api/health 健康
- [ ] prod 部署 sha 含 BL-059 final commit

---

## 11. 不在本批次（Out of Scope）

- 硬删（DELETE）youtube-api-daily 数据 — 30 天 soft delete 窗口后另起评估批次（BL-XXX 6 月初）
- fork apify-kol-service 端代码改动（爬虫团队负责，含补 totalComments 字段）
- 主流程 UI 调整（既有 query 含 deleted_at IS NULL 自动 filter）
- B6 历史数据归档 / export（30 天 soft delete + audit_log 已是 trail）
- BL-058-apify-data-quality 跟踪范围（4 维度迭代 + UI 默认过滤选项 + SQL 清理选项 + X 平台接入）

---

## 12. 与既有 spec / framework cross-reference

| 关联 | 内容 |
|---|---|
| BL-051a F003 | product soft delete + audit_log 模式（本批次 KOL soft delete 沿用同模式）|
| BL-012 v2 §2.2 数据流隔离铁律 | 数据流仍严格走 fork GET /kol HTTP API，KOLMatrix 端不直接 import fork SDK |
| BL-023 F008 | engagement_rate + valueScore 全量 recompute 范式（本批次 F002 apify-kol recompute 同模式）|
| v0.9.16 P5.2 | acceptance 边界 ≠ 全套测试普遍绿（pre-commit-hook flaky 按 BL-054 划走）|
| v0.9.18 | auth role enum 实物核查（本批次 SQL ops 用 `metadata->>'source'` 精确过滤，不依赖字面假设）|
| v0.9.19 | external API zod schema 实物 sample 验证（fork totalComments 字段缺 — 已 grep verify simpler-公式）|

---

## 13. 长期跟踪

- **6/8 后**：30 天 soft delete 窗口结束，评估硬删（DELETE）vs 永久 soft delete 保留
- **BL-058**：跟踪 fork 数据质量 4 维度迭代 + 主流程 UI 默认过滤选项 + X 平台接入
- **fork 端 totalComments 字段补充后**：mapper engagement_rate 公式升级（含 comments 完整版）
