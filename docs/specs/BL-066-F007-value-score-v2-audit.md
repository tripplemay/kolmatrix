# BL-066 F007 · valueScore 公式 v2 + ADR-014 + recompute ops pre-impl 审计

> **发起者：** Generator（本会话 .agent-id=johnsong 本机临时代理 Kimi 身份，per F002 / F005 / F006 同模式 — 用户 5/15 明确「本会话身份固定为 generator」承接 F007 起工）
> **日期：** 2026-05-15
> **触发：** F007 是本批次最大单 feature（spec 估 20h，含公式调整 + ADR + recompute SQL ops + 单测扩充 + staging+prod 双段 deploy），且 spec §F007 文字与 features.json 简表在三处字面口径上有歧义；docs/handoff/BL-066-F007-startup.md §4 明确建议起 audit
> **状态：** 等待 Planner johnsong 明确回复，**未收到前不开工**

## 1. 背景 & 目标

F007 acceptance（features.json + spec §F007）：

- 修改 `src/lib/kol/value-score.ts` 三处：
  - **followerScore：** `log10×10` + cap 80（spec §F007 字面 `min(50, log10×10) + cap 80`；features.json 简表 `log10×10 cap 80`）
  - **categoryScore：** normalize max 15
  - **engagementScoreFromRate：** 阶梯 `>=5%→12 / >=8%→16 / >=12%→20 / >=16%→25`
  - **RAW_MAX：** 95
- 新建 ADR-014 `docs/adr/ADR-014-value-score-formula-v2.md`
- 单测 ≥6 case 覆盖新公式
- Recompute SQL ops：staging → prod（用户 ack 时间窗）+ `audit_log` event `value_score_recompute_v2` with row_count
- 验证 top-15 不再 2K vs 12.6M 同分；mega-tier 重登顶
- L1 PASS + staging git_sha 与本 commit 一致

## 2. 现状核查

### 2.1 现公式（`src/lib/kol/value-score.ts:18-92`）

```ts
const RAW_MAX = 90; // followerScore 50 + engagementScore 20 + categoryScore 20
const ENGAGEMENT_PLACEHOLDER = 12;

followerScore   = Math.min(50, Math.log10(max(followers, 100)) × 15);  // cap @ ~2154 粉
engagementScore = engagementScoreFromRate(rate):
  null/NaN → 12; <1 → 5; 1-3 → 10; 3-6 → 15; 6-10 → 18; >=10 → 20;
categoryScore   = Math.min(20, categories.length × 8);                  // 3+ cats cap

raw      = followerScore + engagementScore + categoryScore;
modifier = authenticityModifier(...)  // [0.85, 1.05]
total    = round(raw × modifier × 100 / RAW_MAX);   clamp [0, 100]
```

### 2.2 现有调用方（5 个，全部使用 `computeKolValueScore()`）

- `src/lib/kol-sync/import.ts:135` — apify-kol 单源 daily sync 入库时算
- `scripts/import-kol-from-youtube.ts:138` — YouTube 旧 sync 路径（BL-059 后 deprecate，但脚本仍存）
- `scripts/seed-kol-from-enriched.ts:140` — local seed
- `scripts/enrich-kol-from-youtube.ts` — local enrich
- `tests/unit/value-score.test.ts`（≥10 case 含 5-segment ladder 字面 + ranking 不变量）

### 2.3 数据 surface

- `kol.value_score` Decimal column（schema.prisma），Nullable
- `audit_log` 表通过 `src/lib/audit/log.ts:logAudit(...)` 写入；platform-level 事件用 `tenantId=null`（fall-back 到 raw prisma，policy `tenant_id IS NULL` 分支 + console.warn）
- prod top-15 valueScore=100 当前 14 行（含 2K-12.6M 双峰；@gameseduuu 12.6M / @morrov8721 2.08K 同分 100 — 区分度失真，spec §1.1 + BL-048 backlog 描述的核心问题）

### 2.4 spec §F007 vs features.json 字面对照

| 字段 | spec §F007 字面 | features.json F007 简表 |
|---|---|---|
| followerScore | `min(50, log10(followerCount) × 10) + cap 80` | `log10×10 cap 80` |
| categoryScore | `normalize 范围调到 max 15` | `normalize max 15` |
| engagement | `>= 5% → 12, >= 8% → 16, >= 12% → 20, >= 16% → 25` | `5%→12, 8%→16, 12%→20, 16%→25` |
| RAW_MAX | `RAW_MAX 改 95（normalize 总分）` | `RAW_MAX 95` |

**spec §F007 字面 `min(50, log10×10) + cap 80` 在 followerScore 单子项上同时出现 50 cap 与 80 cap，数学上无解**（min 后的值 ≤ 50，再加 cap 80 没有改变上界）。features.json 简表 `log10×10 cap 80` 与 BL-048 backlog 描述「让 1M+ 才接近满分」一致，最自然解读 = `min(80, log10(followers) × 10)`，但需 Planner 确认（决议 #1）。

### 2.5 子项和 vs RAW_MAX 数学校验

| 解读 | followerScore max | engagementScore max | categoryScore max | sub-sum max | RAW_MAX | 顶档 total（modifier=1.0）|
|---|---|---|---|---|---|---|
| A | **80** | 25 | 15 | **120** | 95 | round(120 × 100 / 95) = 126 → clamp 100 ✓ |
| B | 50 | 25 | 15 | 90 | 95 | round(90 × 100 / 95) = 95（顶档拿不到 100，仅 1.05 modifier 才到 100） |
| C | 80 | 25 | 20 | 125 | 95 | clamp 100 — 但 spec 明示 categoryScore max 15 |

**解读 A** 与 BL-048 backlog 描述 + 数学自洽（顶档可达 100 + 普通 1M KOL 落 94-96 区间），是最可能的设计意图。决议 #1 选 A 时 sub-sum 120 vs RAW_MAX 95 故意"超 1"是为了让真正 mega + 高 engagement + 多 cats 同时满足才到 100，普通 mega 在 90+ 区间形成区分。

### 2.6 engagement 阶梯字面只覆盖 4 档（≥5%/≥8%/≥12%/≥16%），缺 `<5%` 实测值 + null 占位行为

现 `engagementScoreFromRate` 6 个分支（含 null placeholder = 12）。新阶梯 spec 只列 4 档 ≥5%，**未规定**：

- (a) `<5%` 但 finite real rate（如 0.5% / 2% / 4.9%）→ 什么分？
- (b) `null / NaN` placeholder 应保持 12 还是调整？

决议 #2 需要 Planner 显式给完整 ladder + placeholder 值。

### 2.7 categoryScore `normalize max 15` 多种合理解读

- α: `Math.min(15, length × 8)` — 保 8 分/cat 斜率，仅改 cap → 1 cat=8, 2+ cats=15 (饱和)
- β: `Math.min(15, length × 5)` — 重新 weight，斜率降到 5 → 1=5, 2=10, 3+=15
- γ: `Math.min(15, length × 4)` — 4 cats 才 cap → 1=4, 2=8, 3=12, 4+=15

α 最符合「normalize max 15」字面（仅改 cap）；β/γ 是更细密的渐变。决议 #3。

## 3. 8 条决议请求

| # | 决议点 | A 方案 | B 方案 | C 方案 | 建议 |
|---|---|---|---|---|---|
| 1 | followerScore 公式字面 | `min(80, log10(max(followers,100)) × 10)` — cap 80 / 多倍 10 / 1M ≈ 60 / 100M ≈ 80 / 100 粉 ≈ 20（与 BL-048 backlog 「让 1M+ 才接近满分」一致） | `min(50, log10×10) + 后段加权` 复杂分段（不推荐 — spec 未列分段细节） | `min(50, log10(followers) × 10)` — cap 仍 50 但 multiplier 降 10（普通 KOL 普遍 followerScore < 50，"cap 80" 解读为下面归一化分母） | **A**（与 BL-048 backlog 文字 + 数学自洽 + sub-sum 120 vs RAW_MAX 95 拉档机制成立；spec §F007 第 1 行的 `min(50, ...) + cap 80` 字面应视为 spec 表达失误，由本审计纠正） |
| 2 | engagement 完整 ladder + placeholder 值 | **6 档**: null→12 (保持) / <2%→4 / 2-5%→8 / 5-8%→12 / 8-12%→16 / 12-16%→20 / ≥16%→25 — 全新设计，<5% 段更细 | **5 档**: null→12 / <5% real→8 / ≥5%→12 / ≥8%→16 / ≥12%→20 / ≥16%→25 — 仅在 spec 4 档外补一档 <5% real + 保 placeholder | **保旧档 + 替顶段**: null→12 / <1%→5 / 1-3%→10 / 3-5%→12 / 5-8%→16 / 8-12%→20 / 12-16%→22 / ≥16%→25 — 兼容旧测试 + 顶段细分 | **B**（spec 字面 only 锁 ≥5% 四档，B 最贴 spec；C 改动面过大且与 spec 阶梯字面冲突；A 单挑出 <2% 没有数据驱动证据 — 现 138 KOL real engagement 数据可能不够分辨 <2% vs 2-5%）|
| 3 | categoryScore 重算法则 | `Math.min(15, length × 8)` — 仅改 cap，斜率不变 (1=8, 2+=15) | `Math.min(15, length × 5)` — 重 weight (1=5, 2=10, 3+=15) — 更线性渐变 | `Math.min(15, length × 4)` — 更慢饱和 (1=4, 2=8, 3=12, 4+=15) | **A**（spec 字面 "normalize max 15" 最自然解读 = 仅改 cap；现 138 KOL 中位 3-5 cats，A vs B 实际差异仅在 1-cat KOL（少数），不值得改算法） |
| 4 | recompute 实现技术：纯 SQL 还是 TS 脚本 | 纯 SQL `UPDATE kol SET value_score = ...` — SQL 内嵌 CASE WHEN engagement ladder + CASE WHEN follower log，~30 行 | TS 脚本 `scripts/bl066-f007-recompute-value-score.ts` 调 `computeKolValueScore()` 循环 KOL 行 + `UPDATE` per row — 复用产线公式，零口径漂移 | TS 脚本 + 单次大 batch UPDATE（fetch all → bulk-write）— 在 staging 上一次性 ≤10s 完成 | **B**（生产公式存于 `value-score.ts`，TS 脚本调同函数 = 公式单源；纯 SQL 重写 ladder 在 SQL CASE 是 dual-source 风险 — 现 ~3700 KOL 行 单条 UPDATE 0.05s × 3700 ≈ 3 分钟可接受。脚本结构同 `scripts/kol-quality-weekly.ts` 模式 + audit_log 单 event 写在脚本末尾） |
| 5 | recompute audit_log event shape | 单 platform-level 事件 `action=value_score.recompute_v2` `resource_type=kol` `resource_id='__bulk_recompute__'` `payload={ formula_version: 'v2', row_count, env: 'staging'\|'prod', min_before, max_before, min_after, max_after, sample_diffs: [...] }` — 一行 audit | 每行 KOL audit (≥3700 行) `payload={ before, after, formula_version }` — 完整追溯但表暴增 | 单事件 + 每行短摘要（payload 含 ≤200 行 sample / 全量 sample 入 `docs/test-reports/BL-066-F007-recompute-{env}.json`）— 平衡详尽与噪音 | **A**（每行 audit 噪音过大 + 已有 audit_log 表 RLS 性能瓶颈；F009 staging deploy 阶段 sample 验证靠脚本 stdout + signoff doc 嵌结果，无需 audit_log 全量入。`logAudit({ actorId: <system uuid>, action, targetType: 'kol', targetId: '__bulk_recompute__', tenantId: null, after: payload })`） |
| 6 | F007 deploy 边界：F007 推 main 后是否立即 staging deploy + apply staging recompute？ 还是 F009 一并 deploy + apply？ | F007 单 commit 含 code + ADR + 脚本 — 推 main 后 SSH staging 走 `deploy-staging.sh` + apply staging recompute + 收 stdout 入 commit message。F009 时只 apply prod recompute | F007 单 commit 含 code + ADR + 脚本 — 推 main 后 SSH staging 走 `deploy-staging.sh` 部署代码 only（不 apply recompute）。F009 staging deploy 阶段 apply staging recompute → prod recompute | F007 单 commit 含 code + ADR + 脚本 但 **不 staging deploy** — 等 F009 一并 deploy + apply（破 generator.md §切 verifying 前 staging deploy 硬要求） | **A**（spec §F007 acceptance 末行 "staging git_sha 与本 commit 一致" 强 implies F007 推完即 deploy；同 commit apply staging recompute 让 staging 上线即看到新分布；F009 再 prod apply 等用户 ack 窗口。F006 实战已建 atomic-commit + staging-immediate-deploy 模式） |
| 7 | top-15 mega 重登顶 验证量化标准 | 静态阈值：top-15 valueScore=100 的 KOL **followerCount 最小值 ≥ 100K** | 排序顺位：@gameseduuu (12.6M) **排名 ≥** @morrov8721 (2.08K) + top-15 内最高 valueScore - 最低 ≥ 5（不再全 100） | 分布锁：top-15 valueScore=100 行数 **≤ 3**（避免 14-行同分 100 现状） + sample 显著区分 nano vs mega | **B**（A 阈值 100K 偏严 — 真实 KOL 池可能仍有 50K 粉 + 16% engagement + 5 cats 命中 100；C "≤ 3" 行数硬卡可能误伤合理结果。B 抓"排序 + 区间宽度"两维，最贴 spec §F007 "mega-tier 重登顶 + nano 区分度回来" 双语义） |
| 8 | staging → prod recompute 时间间隔 | 同 commit 后 SSH staging recompute 完毕 → 24h 监控 → 用户 ack 时间窗 prod recompute | 同 commit 后 SSH staging recompute → ≥2h 团队 spot check → 用户 ack prod recompute | 全部 prod recompute 推迟到 F009（与 prod redeploy 同步） | **C**（spec §F007 acceptance 字面 "prod 同步（用户 ack 时间窗）" + spec §F009 acceptance 第 1 行 "staging deploy via deploy-staging.yml（含 BL-048 valueScore recompute SQL）" 暗示 prod recompute 应捆 F009 batch finale。F007 commit 阶段仅 staging apply，prod apply 留 F009 audit 同窗运行 — 与 BL-063/064/065 prod redeploy 模式一致） |

### 裁决格式要求

请 Planner 就 8 条给出明确的 **A / B / C** 选择 + 简短理由（偏离建议时）。
用 `#1:A #2:B #3:A #4:B #5:A #6:A #7:B #8:C` 短格式回复即可。

## 4. 已知漂移 / 风险

### 4.1 决议 #1 选 A 隐含影响

`min(80, log10×10)` 拉伸后：
- 100 粉 KOL：followerScore 20（旧 30）— 略降
- 2K 粉 KOL：followerScore 33（旧 50 cap）— **降 17**（拉回区分度的核心）
- 100K 粉 KOL：followerScore 50（旧 50 cap）— 保持
- 1M 粉 KOL：followerScore 60（旧 50 cap）— **升 10**
- 12.6M 粉 KOL：followerScore 71（旧 50 cap）— **升 21**

意味着 prod 全量 ~3700 KOL recompute 后，所有 follower>100K 的 KOL 分数走向上、follower<2K 的走向下；中间段 2K-100K 局部走低（被 RAW_MAX 95 vs 90 反向少量补偿）。

### 4.2 决议 #4 选 B（TS 脚本）的并发风险

3700 KOL 单条 UPDATE 期间 daily sync (`scripts/kol-sync-daily.ts`) 如果同时跑会引入新行 — 这些新行用新公式 (value-score.ts 已升级) 计算 valueScore，与正在 recompute 的旧行不冲突。决议 #4 选 B 推荐脚本含 stdout `progress: N/total` 便于观察并发交叉时机；建议 staging recompute 在 cron 静默窗（北京时间 04:00-06:00）外手动跑。

### 4.3 决议 #6 选 A 后 ADR-014 锁公式 v2 单源

ADR-014 起草需在 commit 同时写完，避免「公式落地 + ADR 滞后」反模式（参考 ADR-013 模式 — 决议同 commit 落 ADR）。本审计建议 ADR-014 §Status=Accepted §Date=2026-05-15 §Authors=用户+Planner johnsong（联合决策，本批次 BL-048 合入决策已在 5/14 ack）。

### 4.4 现有测试兼容（tests/unit/value-score.test.ts 已存的 case）

| 现 case | 现 expectation | 新公式预期 | 处理 |
|---|---|---|---|
| `engagementScoreFromRate` 5-segment ladder 字面 | <1→5 / 1-3→10 / 3-6→15 / 6-10→18 / ≥10→20 | 全部失效 | **重写**该 describe 为新 ladder 字面（决议 #2 选定后） |
| `normalizes raw max (50 + 20 + 20 = 90) to 100` | 1M / 12% / 3 cats → total=100 | 1M / 12% / 3 cats 在新公式 = 60+20+15=95 → round(95×100/95)=100 ✓ | 改注释为新子项；total=100 仍成立 |
| `ranks larger follower counts higher while below the cap` | 200→<800→<2000 | log10 严格单调 / 200→23 < 800→29 < 2000→33 | 沿用 |
| `clamps follower contribution once followers exceed the cap` | 3000/1e7 → both raw.follower=50 | 新 cap=80 — 3000 → log10(3000)*10=34.8 ≠ 80 | **改测试** 用 followerCount=1e8 vs 1e9 验 cap 80 |
| `floors follower input at 100` | follower=0 → rawFollower=30 | 新公式 → log10(100)*10=20 | 改 expected 为 20 + total 重算 |
| `caps category bonus at 3+ categories` | 3 vs 5 cats → 同 20 | 决议 #3=A → 2 vs 5 cats 同 15 / 决议 #3=B → 3 vs 5 cats 同 15 | 按裁决调 expected |
| `BL-023 engagement signal — 4.2% → 15` | engagement=15 / total=90 | 决议 #2=B → 4.2% real → 8（<5% real）/ raw=50+8+16(=15 cap)=73 → round(73*100/95)=77 | 改 expected |
| `falls back to placeholder=12 when null` | placeholder=12 | 决议 #2=B → 保 12 ✓ | 保持 |
| `regression: prior ±15 vs BL-023 baseline` | abs(after - before) ≤ 15 | 现 公式 v1 vs 公式 v2 跨档差异可能 >15 — 此 regression case 在 v2 不再适用 | **删除**或改为 `prior BL-023 v1 baseline 不再约束 v2` 注释 |

### 4.5 audit_log RLS / actorId 来源

per `src/lib/audit/log.ts:logAudit()`：platform-level 事件 `tenantId=null` 落 `tenant_id IS NULL` policy 分支，但 `actorUserId` non-null required。 决议 #4 选 B 时脚本需指定 actorId — 建议复用 `seed.ts` 的 `admin@kolmatrix.local` user UUID（已 prod + staging 共存），从 env 读 / 脚本 fetch admin user by email 实时取 uuid。

## 5. 开工条件

收到 Planner 8 条决议 + 在本审计末尾追加 `## 6. Planner 裁决` 段 + 推 main 后，Generator 按下列顺序：

1. （决议 #1 / #2 / #3 / 所有公式参数）改 `src/lib/kol/value-score.ts`（含注释更新引 ADR-014）
2. （决议 #2 完整 ladder）重写 `tests/unit/value-score.test.ts` engagement describe 段
3. 改其它 ≥7 case expected 值（§4.4 表）
4. 加 ≥6 new case 覆盖 v2（per acceptance）— 例：
   - cap 80 followerScore（1e8 → 80, 1e9 → 80, 1e6 → 60）
   - new engagement ladder boundary（4.9% vs 5%, 7.9% vs 8%, 11.9% vs 12%, 15.9% vs 16%）
   - categoryScore cap 15 at length=N（依决议 #3 算）
   - normalize 顶档（max sub-sum × 1.05 modifier → clamp 100）
   - regression: v2 公式下 12.6M vs 2K 差 ≥20 total
5. 起草 ADR-014 `docs/adr/ADR-014-value-score-formula-v2.md`（§Context BL-048 backlog 复述 + §Decision 三参数 + §Consequences impact 表 + §Alternatives 简短）
6. （决议 #4 = B）`scripts/bl066-f007-recompute-value-score.ts` 起草：fetch all KOLs（含 followerCount / engagementRate / categories / engagementAuthenticity）→ loop call `computeKolValueScore()` → `UPDATE kol SET value_score = N WHERE id = $id`（chunked transaction 100/batch）→ end-of-run `logAudit()` 单 event（决议 #5 = A shape）
7. L1：`npm run lint` + `npx tsc --noEmit` + `npm test -- value-score`
8. commit atomic — feat(BL-066-F007): value-score formula v2 + ADR-014 + recompute script
9. push main，gh run list watch CI 1-2 轮自修预期（per generator.md §10）
10. （决议 #6 = A 时）SSH staging 完整 deploy（pull + npm ci + migrate deploy + NODE_OPTIONS build + pm2 reload）→ apply staging recompute → 收 stdout into commit message metadata → curl staging /api/health git_sha verify
11. （决议 #7 = B）staging top-15 量化验证（直接 SQL `SELECT id, handle, follower_count, value_score FROM kol ORDER BY value_score DESC LIMIT 15` — 检验 @gameseduuu 排名 vs @morrov8721 + top-15 valueScore range ≥ 5）
12. progress.json `session_notes` 追加 `[staging deployed @ {sha} @ {ts}, recompute @ row_count, top-15 verify pass]` + commit + push
13. features.json F007 pending → completed + project-status.md 更新 + commit
14. （决议 #8 = C）prod recompute 推迟至 F009

**未收到明确回复前不开工。**

## 6. 估算开工时长

| 环节 | 预估 |
|---|---|
| value-score.ts 公式 ts 改写 + 注释 | 1h |
| value-score.test.ts 7+ 现 case 改 expected + 6+ 新 case | 3h |
| ADR-014 起草（含 impact 表 + sample 推演） | 2h |
| recompute 脚本起草 + 本地测试（dev DB tiny dataset） | 3h |
| L1 全绿 lint+tsc+vitest（含 1-2 轮 CI 自修） | 1h |
| SSH staging deploy + apply recompute + verify top-15 | 2h |
| features.json + project-status + session_notes commits | 0.5h |
| 预留 — Planner 裁决回环 + ADR-014 evaluator 复议 | 2.5h |
| **合计** | **~15h**（在 spec 估 20h 范围内 / Reviewer 复议 1d 独立） |

## 7. 相关文档

- `docs/specs/BL-066-campaign-detail-ai-main-panel-spec.md` §F007
- `features.json` 条目 F007
- `docs/handoff/BL-066-F007-startup.md` §3 §4（本审计直接续接其 6 个候选歧义点 + 加 2 个新点）
- `src/lib/kol/value-score.ts`（现 BL-023 公式）
- `tests/unit/value-score.test.ts`（现 baseline）
- `src/lib/audit/log.ts`（audit_log 写入 surface）
- BL-048 backlog entry（`backlog.json`）「3 候选方向」+ prod top-15 实测数据
- `framework/harness/pre-impl-adjudication.md` §4.6 §4.7（本审计遵循之）
- `docs/specs/BL-066-F002-preimpl-audit.md` + `docs/specs/BL-066-F006-accepted-kols-panel-audit.md`（本批次同模式审计前例）
