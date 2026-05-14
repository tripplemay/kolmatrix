# ADR-014: KOL valueScore 公式 v2 — followerScore cap 80 / engagement 顶段细分 / categoryScore 降权

## Status

**Accepted**

- 日期：2026-05-15
- 作者：Planner johnsong + 用户（联合决策；BL-066 决策点 #C "BL-048 合入 Phase 2 第二批" 用户 2026-05-14 ack）
- 相关批次：BL-066-F007（落地 commit）；BL-048 backlog 提案（5/7 发现）；ADR-013 AI Native pivot（前置）

## Context（背景）

### 触发事件

2026-05-07 BL-023 全量 recompute 完成后，用户实地查看 prod top-15 valueScore=100 KOL 发现 12.6M 粉的 `@gameseduuu` 与 2.08K 粉的 `@morrov8721` 同分 100。Generator 调查根因 = BL-023 没动的 BM1 原设计副作用（非 BL-023 引入回归），区分度严重失真。

### Prod top-15 valueScore=100 实测数据（2026-05-07，14 行）

```
@gameseduuu             12.6M  粉 / 13.0% engagement / 5 cats
@zangadoreview           4.19M 粉 / 10.0% / 5
pixelpao                 1.91M 粉 / 10.9% / 3
neonhaze                 1.64M 粉 / 11.4% / 3
kaibytes                 512K  粉 / 14.8% / 3
aisha.streams            264K  粉 / 12.2% / 3
forgefalcon              196K  粉 / 15.6% / 3
@brksedumobile           129K  粉 / 11.0% / 7
@valkiosrpg              128K  粉 / 10.0% / 6
@faria-mobile            14.5K 粉 / 10.0% / 5
@jogadorindie            9.7K  粉 / 12.0% / 6
@golmobilegames          6.85K 粉 / 11.0% / 5
@luvstarletsplays        4.93K 粉 / 16.0% / 5
@memoriasyvideojuegos    3.63K 粉 / 15.0% / 5
@morrov8721              2.08K 粉 / 12.0% / 5
```

### v1 公式三处天花板太低

`src/lib/kol/value-score.ts`（BL-023）：

| 子项 | 公式 | 天花板触发 |
|---|---|---|
| followerScore | `min(50, log10(followerCount) × 15)` | log10(2154)×15=50 — 任何 >2K 粉饱和 |
| engagementScore | 阶梯 5/10/15/18/20 at <1/1-3/3-6/6-10/≥10% | 任何 ≥10% engagement 饱和 |
| categoryScore | `min(20, length × 8)` | 3+ cats 饱和 |
| RAW_MAX | 90 | total = round(raw × mod × 100 / 90) |

→ 任何 >2K 粉 + ≥10% engagement + ≥3 cats 的 KOL 都拿满 90/90 raw → total=100；nano 12% engagement + 5 cats 的 KOL 与 mega 同分。

### 不决策的后果

- /campaigns/[id] BL-066-F003 AI 推荐主面板 用 valueScore desc 排序时 nano/mega 混排 → marketer 必须手动二次过滤
- /discovery + /database 仍然遵循 valueScore，AI 推荐质量受限
- 现 138 KOL real engagement signal（BIx F004 cron 累积）信号被公式天花板浪费
- BL-067 C3 explainability 起步前如不解决，"为什么这个 KOL 排前"无法用 valueScore 自圆其说

### 触发时机

BL-066 决策点 #C（用户 5/14 ack）："BL-048 合入本 batch — atomic 发布避免 staging valueScore + AI 推荐 quality 双源不同步"。F007 是承载 commit。

## Decision（决策）

**改 `src/lib/kol/value-score.ts` 三处参数 + RAW_MAX，并附 TS 脚本对 staging + prod 现存数据全量 recompute。**

### 公式参数（BL-066-F007 audit Planner 裁决 #1 / #2 / #3 锁）

| 子项 | v1 | v2 |
|---|---|---|
| followerScore | `min(50, log10(max(followers, 100)) × 15)` | `min(80, log10(max(followers, 100)) × 10)` |
| engagementScoreFromRate | null→12 / <1%→5 / 1-3%→10 / 3-6%→15 / 6-10%→18 / ≥10%→20 | null→12 / <5% real→8 / ≥5%→12 / ≥8%→16 / ≥12%→20 / ≥16%→25 |
| categoryScore | `min(20, length × 8)` | `min(15, length × 8)` |
| RAW_MAX | 90 | 95 |

### 设计直觉

- **followerScore cap 80 reached at 100M**：mega-tier 进入区分区间（1M→60 / 10M→70 / 100M→80）；nano 区分度回来（2K→33 / 200→23）
- **engagement 顶段细分**：≥16% 拿 25 分而非 v1 顶档 20，让真正 viral 创作者拉开档；<5% real 拿 8 分而非 v1 的 5/10/15 三档 — 数据驱动证据不足时（138 样本）粗粒度更稳
- **null placeholder=12 保持**：absence of signal ≠ confirmed low engagement，placeholder 落在 5-8% 工作楼层
- **categoryScore 降 cap 20 → 15**：把权重让给 follower+engagement 主轴；2+ cats 即饱和（KOL 普遍 3-5 cats，差异无价值）
- **RAW_MAX 95 vs sub-sum max 120**：故意"超 1" 归一化分母，让 mega + 高 engagement + 多 cats 同时满足才接近 100；普通 mega 落 90+ 区间

### 数学影响（modifier=1.0）

| 案例 | v1 raw / total | v2 raw / total | Δ total |
|---|---|---|---|
| @gameseduuu (12.6M / 13% / 5) | 50 + 20 + 20 = 90 / **100** | 71 + 20 + 15 = 106 / **100** (clamp) | 0 (顶档) |
| @morrov8721 (2.08K / 12% / 5) | 50 + 20 + 20 = 90 / **100** | 33 + 20 + 15 = 68 / **72** | **-28** |
| @neonhaze (1.64M / 11.4% / 3) | 50 + 20 + 20 = 90 / **100** | 62 + 16 + 15 = 93 / **98** | -2 |
| @kaibytes (512K / 14.8% / 3) | 50 + 20 + 20 = 90 / **100** | 57 + 20 + 15 = 92 / **97** | -3 |
| @faria-mobile (14.5K / 10% / 5) | 50 + 20 + 20 = 90 / **100** | 42 + 16 + 15 = 73 / **77** | **-23** |
| 1-cat / 100K / null engagement | 50 + 12 + 8 = 70 / **78** | 50 + 12 + 8 = 70 / **74** | -4 |
| 1M / 12% / 3 (典型 mid-tier 顶档) | 50 + 20 + 20 = 90 / **100** | 60 + 20 + 15 = 95 / **100** | 0 |

**核心交付**：
- @gameseduuu (mega) vs @morrov8721 (nano) 差距 v1=0 → v2=28（≥20 per Planner 裁决 #7 量化标准）
- top-15 不再 14 行同分 100；mega 仍然登顶
- nano 仅在「真正 viral + 多 cats」的极端情况下接近 mega（如 @luvstarletsplays 4.93K / 16% / 5 在 v2 是 37+25+15=77 → 81，仍显著低于 mega）

## Consequences（后果）

### 正面

- **AI 推荐排序差异化**：BL-066-F003 AI 主面板按 valueScore desc 排序时 mega-tier 不再被 nano 干扰
- **公式单源**：recompute 脚本调 `computeKolValueScore()` 同函数 = 公式只在 `value-score.ts` 一处；未来升级零 SQL drift 风险
- **engagement 数据信号充分利用**：BIx F004 cron 累积的 real engagement signal 现在分辨 5/8/12/16% 四阈值（v1 只在 1/3/6/10% 分辨，且顶档饱和）
- **placeholder 语义清晰**：null=12 ↔ <5% real=8 让"不知道"和"知道低"区分
- **future-proof 顶档**：≥16% engagement 拿 25 分，留出空间区分极端 viral KOL（v1 顶档 20 已饱和）

### 负面

- **全量 recompute ops 一次性投入**：staging + prod 各 ~3700 行 UPDATE，约 3-5 分钟脚本运行
- **BL-023 单测 baseline 不再适用**：v1 vs v0 兼容 ±15 测试已删；v2 单测重写 24 case 覆盖新公式
- **既有 valueScore 数据全部刷新**：v2 落地前的所有 valueScore 历史值与 v2 不可比；如未来做 KPI 时间序列分析需要 audit_log marker 隔代
- **现 138 KOL real engagement 样本不够分辨 v2 内部 <5% 细分**：决议 #2 选 B 单档 <5% 而非 6 档 <2% / 2-5% — 数据驱动不足

### 中性

- **kol.value_score 字段类型不变**（Int 0-100）— 公式重写 in-place，无 migration
- **scripts/import-kol-from-youtube.ts + seed-kol-from-enriched.ts + enrich-kol-from-youtube.ts 自动跟随**：所有调用方调 `computeKolValueScore()`，新公式立即生效
- **下游 KPI snapshot 表 `avg_value_score` 字段**（schema:664）会在下次 kpi-snapshot-daily 跑时反映新分布 — 与 BL-066 整体 staging/prod 切换同步

## Alternatives Considered（备选方案）

### 方案 A（已选择 — 见 Decision）

三参数 v2 + RAW_MAX 95，公式单源（TS 函数）+ TS 脚本 recompute。

### 方案 B（已拒绝）：纯 SQL recompute UPDATE 内嵌 CASE WHEN ladder

```sql
UPDATE kol SET value_score =
  ROUND(LEAST(80, LOG(follower_count) * 10)
        + CASE WHEN engagement_rate >= 16 THEN 25 WHEN engagement_rate >= 12 THEN 20 ... END
        + LEAST(15, COALESCE(array_length(categories, 1), 0) * 8))
  * (CASE WHEN engagement_authenticity >= 80 THEN 1.05 ... END)
  * 100 / 95;
```

**拒绝理由：**
- 公式 dual-source — value-score.ts 与 SQL CASE 两处必须同步；任何未来公式调整（如 BL-067 explainability 引入新维度）必须改两处，drift 风险高
- SQL 难以保证 `Math.max(followers, 100)` floor + Math.round + clamp [0,100] 与 TS 完全位级一致
- 3700 行 UPDATE 性能优势在 dataset 规模下不显著（TS 脚本 3 分钟 vs 纯 SQL 30 秒）

### 方案 C（已拒绝）：保留 v1 公式但加 valueScore_v2 列双轨过渡

在 schema 加 `value_score_v2 Int?` 列，AI 推荐排序用 v2 作 secondary key，UI 仍显 v1。

**拒绝理由：**
- ADR-013 AI Native pivot 已确认 valueScore 是 AI 推荐的核心 input —— 双轨意味着两套排序逻辑共存
- 数据迁移 + 移除阶段（BL-070+）额外开销
- 用户决策 5/14 #C 已 ack "atomic 发布"，反对双源过渡

### 方案 D（已拒绝）：6 档 engagement ladder（<2% / 2-5% 细分）

```
null→12 / <2%→4 / 2-5%→8 / 5-8%→12 / 8-12%→16 / 12-16%→20 / ≥16%→25
```

**拒绝理由：**
- 现 138 KOL real engagement 数据不够分辨 <2% vs 2-5%（信号噪音 > 真实差异）
- 越界 spec §F007 字面（只列 4 档 ≥5%）
- 增加 ladder 复杂度但分辨力可疑

## Migration / Rollout

### 步骤

1. F007 commit（本 ADR + value-score.ts + value-score.test.ts + recompute script atomic）push main → CI
2. SSH staging 完整 deploy（含本 commit）→ `tsx scripts/bl066-f007-recompute-value-score.ts --env staging` 执行 → 收 stdout 嵌入 commit message metadata
3. staging top-15 量化验证：
   - (a) `@gameseduuu` (12.6M) value_score ≥ `@morrov8721` (2.08K) value_score
   - (b) top-15 内 max(value_score) - min(value_score) ≥ 5
4. F008-F009 顺序推进
5. F009 prod redeploy 时机 + 用户 ack 时间窗后 `tsx scripts/bl066-f007-recompute-value-score.ts --env prod` 执行
6. audit_log 单 event 写入 `value_score.recompute_v2` 含 row_count + sample_diffs ≤200

### Rollback

如 staging top-15 验证失败（Planner #7=B 任一条不满足）：
1. `git revert <F007 commit>` push main → staging 再次 deploy
2. staging 上再跑一次 recompute（用 git HEAD 时的 v1 公式）恢复 v1 分布
3. 重新审议公式（追加新 audit + Planner 新裁决）

prod 端 rollback 同理（F009 阶段 prod recompute 失败时）。

## 关联文档

- `src/lib/kol/value-score.ts`（实施位置）
- `tests/unit/value-score.test.ts`（v2 单测 24 case）
- `scripts/bl066-f007-recompute-value-score.ts`（recompute ops）
- `docs/specs/BL-066-F007-value-score-v2-audit.md`（8 决议点 + Planner 裁决）
- `docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md` §F007 + §F009
- `backlog.json` BL-048 entry（trigger + 3 候选方向）
- ADR-013 AI native pivot（前置决策）
