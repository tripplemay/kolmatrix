# BL-023 KOL 评分体系升级 — Spec（含 X1 BL-045 顺手清）

> **状态：** Planner 起草 @ 2026-05-06 21:00（BL-043 building 期间并行）；BL-043 done 后立即切 building
> **作者：** Planner johnsong
> **触发：** 用户 5/6 19:50 决议 X1 + 用户 5/6 20:50 笔误纠正「BL-044 done 后立即启动 BL-023 不是 BL-043」+ 实地核查 prod BIx F004 batch 已 cron 自动跑且 137 KOL 已就绪
> **预估：** 6-7h Generator + 0.5h Reviewer
> **批次类型：** 普通批次（7 features 全 `executor:generator`，含 F007 X1 顺手清 BL-045）

---

## 1. 背景与目标

### 1.1 现状审计（Planner 5/6 实地 grep + prod psql）

**`src/lib/kol/value-score.ts` 当前公式（46 行）：**
```typescript
followerScore = min(50, log10(max(followerCount, 100)) * 15)
engagementScore = 15  // ← 🔴 完全 PLACEHOLDER 不是真信号
categoryScore = min(20, categories.length * 8)  // ← 🟡 纯计数无质量信号
total = round((follower + engagement + category) * 100 / 85)
```

3 个核心问题：
- 🔴 **engagementScore 固定 15** — 注释明示「real YouTube-API number will replace this once B6 lands」— 但 B6/BIx F004 已 done，公式未升级
- 🟡 **categoryScore 仅看 categories 长度** — 1 cat = 8 / 2 cat = 16 / 3+ cat = 20 满分；不区分主营 vs 边缘 categories
- 🟡 **engagement_authenticity 字段未参与计分** — 字段已存在 schema（line 178）但 `computeKolValueScore` 不用

**`src/lib/discovery/smart-match.ts` similarityToScore 映射（line 100-104）：**
```typescript
similarityToScore(sim) = round((clamped(sim, -1, 1) + 1) / 2 * 100)
// sim=0   → 50  ← 🟡 cosine 0 不应是 50
// sim=0.4 → 70
// sim=0.85→ 92.5
// sim=1   → 100
```

问题：
- 🟡 **cosine sim ≥ 0 实际场景下，[0.3, 0.85] 区间被压到 [65, 92]** — 区分度窄
- 🟡 **sim=0 → 50 误导用户**（"无匹配" 应是 0 而非 50）

**Prod 实际数据状态（5/6 实测）：**
- 137 KOL `engagement_rate > 0`（5/1-5/6 6 天 cron 累积）
- 0 KOL `engagement_authenticity > 0`（字段全空 — 待本批次升级时计算或后续 cron）
- 2430 KOL `value_score > 0`（公式化算术，含 placeholder 15）
- BIx F004 cron `kolmatrix-kol-sync` 已部署 daily 自动跑（每天累积 ~25-30 KOL with engagement）

### 1.2 升级目标

1. **valueScore 用真 engagement_rate 替代 placeholder** — 当前 137 KOL 已就绪，每天累积更多
2. **Smart Match 映射区分度优化** — sim 直接映射到 0-100，不再 +1/2 偏移
3. **valueScore 重算 trigger** — kol-sync-daily.ts 跑完 engagement batch 后自动重算 top 100 KOL 的 valueScore
4. **dead code 顺手清**（X1）— F007 删 email-generator.ts:74 + video-script-generator.ts:80 `?? 'Not specified'`（BL-040 retroactive；同 commit-tag）

### 1.3 Definition of Done

- 7 features 全 PASS by Reviewer L1+L2
- prod top 100 KOL 用真 engagement_rate 计算 valueScore（不再 placeholder 15）
- Smart Match 映射 sim=0 → 0 / sim=1 → 100（直接缩放，无 +1/2 偏移）
- kol-sync-daily.ts engagement batch phase 后自动 trigger valueScore 重算 top 100
- email-generator.ts:74 + video-script-generator.ts:80 dead code 清
- 单测 ≥6 case + 集成测试 ≥2 case 全 PASS

---

## 2. 功能清单（7 features 全 generator）

### F001 · `computeKolValueScore` 升级（用真 engagement_rate）

**Executor:** generator
**Priority:** high
**预估工时:** 1.5h

**改动：** `src/lib/kol/value-score.ts`

新增 input field `engagementRate?: number | null`（来自 KOL.engagement_rate）：

```typescript
export interface KolValueScoreInput {
  followerCount: number;
  categories: string[];
  engagementRate?: number | null;  // NEW — KOL.engagement_rate (% Decimal 5,2)
  engagementAuthenticity?: number | null;  // NEW — KOL.engagement_authenticity (Int 0-100)
}

const ENGAGEMENT_PLACEHOLDER = 12;  // 当 engagementRate=null 时退化（之前 15 偏高）

function engagementScoreFromRate(rate: number | null | undefined): number {
  // engagement_rate 是百分比（如 5.30 = 5.3%）
  // 行业 baseline：< 1% 低 / 1-3% 平均 / 3-6% 优秀 / > 6% 顶级
  if (rate == null) return ENGAGEMENT_PLACEHOLDER;
  if (rate < 1) return 5;
  if (rate < 3) return 10;
  if (rate < 6) return 15;
  if (rate < 10) return 18;
  return 20;  // > 10% 极高 engagement
}
```

**Acceptance：**
- [ ] `KolValueScoreInput` 加 `engagementRate?: number | null` + `engagementAuthenticity?: number | null`
- [ ] `engagementScoreFromRate()` 阶梯映射 0/1/3/6/10 → 5/10/15/18/20 分（5 段位）
- [ ] `null` engagement 退化到 placeholder 12（比原 15 略低，反映"未知"非"假定优秀"）
- [ ] 公式总分仍 0-100（max raw = 50 + 20 + 20 = 90，新归一化 100/90）
- [ ] 既有 KOL 数据 valueScore 浮动 ≤±15（防止全网 valueScore 重排序大改）

---

### F002 · `computeKolValueScore` 加 engagement_authenticity 加权

**Executor:** generator
**Priority:** medium
**预估工时:** 30 min

**改动：** `src/lib/kol/value-score.ts` 加 authenticityModifier：

```typescript
function authenticityModifier(authenticity: number | null | undefined): number {
  // engagement_authenticity 0-100；80+ 真实，60-80 一般，<60 可疑
  if (authenticity == null) return 1.0;  // 未知，中性
  if (authenticity >= 80) return 1.05;  // 5% 加成
  if (authenticity >= 60) return 1.0;   // 中性
  return 0.85;  // 15% 惩罚（疑似买粉/刷量）
}

// 用法：total = round(raw * authenticityModifier(authenticity) * 100 / 90)
```

**Acceptance：**
- [ ] `authenticityModifier()` 阶梯：null=1.0 / >=80=1.05 / >=60=1.0 / <60=0.85
- [ ] 当前 prod 0 KOL with authenticity → 全部 modifier=1.0（无影响），仅未来 batch 算出 authenticity 后才生效
- [ ] 测试覆盖 4 segment（null / 80+ / 60-80 / <60）

---

### F003 · `value-score.ts` 单测扩充

**Executor:** generator
**Priority:** high
**预估工时:** 30 min

**改动：** `tests/unit/value-score.test.ts`（已存在则扩，否则新建）

测试 case ≥6：
1. `engagementRate=null` → engagement segment = 12（placeholder）
2. `engagementRate=0.5` → engagement segment = 5（< 1%）
3. `engagementRate=4.2` → engagement segment = 15（3-6%）
4. `engagementRate=12.5` → engagement segment = 20（> 10%）
5. `authenticity=null` modifier = 1.0
6. `authenticity=85` modifier = 1.05；`authenticity=45` modifier = 0.85
7. （可选）regression test：用 BL-040 真 KOL 数据计算 valueScore 浮动 ≤±15

**Acceptance：**
- [ ] ≥6 cases 全 PASS
- [ ] regression case 用真 KOL fixtures（如有）

---

### F004 · `similarityToScore` 重新映射

**Executor:** generator
**Priority:** high
**预估工时:** 30 min

**改动：** `src/lib/discovery/smart-match.ts:100-104`

```typescript
// 当前：score = round((clamped(sim, -1, 1) + 1) / 2 * 100)
//   sim=0   → 50（误导）
//   sim=0.4 → 70
//   sim=0.85→ 92.5

// 新：score = round(max(0, min(1, sim)) * 100)
// 直接缩放，cosine sim ≥ 0 实际场景：
//   sim=0   → 0  ✓ "无匹配"
//   sim=0.4 → 40  ✓
//   sim=0.85→ 85
//   sim=1   → 100
//
// UI 上对 BL-044 semantic search 的 cosine 0.37-0.46 实测分数 = 37-46
// 对 SmartMatch 的 0.4-0.85 → 40-85，区分度从 22.5 范围扩到 45 范围（2x 区分度）
```

**Acceptance：**
- [ ] `similarityToScore(sim)` 改为 `round(max(0, min(1, sim)) * 100)`
- [ ] 注释更新（删 [70, 92] "good match" 旧描述，改为 [0, 100] 直接映射）
- [ ] BL-044 spec §1.2 cosine 0.37-0.46 提及（"BL-044 实测后已校对"）
- [ ] backwards compatible：负数 cosine → 0（同 max(0, ...)）

---

### F005 · `similarityToScore` + `runSmartMatch` 测试

**Executor:** generator
**Priority:** medium
**预估工时:** 30 min

**改动：** `tests/unit/smart-match-similarity.test.ts`（已存在）

测试 case ≥4：
1. `sim=0.95` → score=95（旧版会 97.5；新版直接 95）
2. `sim=0.40` → score=40（旧版 70；新版 40 — 重要回归测试）
3. `sim=0` → score=0（旧版 50；新版 0）
4. `sim=-0.1` → score=0（边界 clamp）
5. （可选）integration test：runSmartMatch with mock embedding sim → 验证返回 score 范围

**Acceptance：**
- [ ] ≥4 cases 全 PASS
- [ ] 旧测试 fixture 如断言 sim=0.4 → 70 等需更新（grep `expectScore.*70` 改）

---

### F006 · `kol-sync-daily.ts` engagement batch 后 trigger valueScore 重算

**Executor:** generator
**Priority:** medium
**预估工时:** 1h

**改动：** `scripts/kol-sync-daily.ts` engagement batch phase 后追加 valueScore 重算 top 100：

```typescript
// 现状：runEngagementBatch → persist engagementRate + metadata.latestVideos
// 新加：runEngagementBatch 完成后 → recomputeValueScore for top 100 KOLs

import { computeKolValueScore } from "@/lib/kol/value-score";

// 在 runDaily() 中 engagementBatch phase 后：
if (engagementBatchResult.engagementUpdated > 0) {
  const top100 = await prisma.kol.findMany({
    where: { tenantId: deps.tenantId, deletedAt: null },
    orderBy: { valueScore: 'desc' },
    take: 100,
    select: { id: true, followerCount: true, categories: true, engagementRate: true, engagementAuthenticity: true },
  });
  for (const kol of top100) {
    const score = computeKolValueScore({
      followerCount: kol.followerCount ?? 0,
      categories: kol.categories ?? [],
      engagementRate: kol.engagementRate?.toNumber() ?? null,
      engagementAuthenticity: kol.engagementAuthenticity ?? null,
    });
    await prisma.kol.update({
      where: { id: kol.id },
      data: { valueScore: score.total },
    });
  }
  // log result count
}
```

**Acceptance：**
- [ ] kol-sync-daily.ts engagement batch phase 后 recompute valueScore top 100
- [ ] DailyRunReport.valueScoreRecomputed 字段记录（数量）
- [ ] per-row soft-fail（与 engagement batch 同模式）
- [ ] 不阻塞 daily run（即使 valueScore 重算 fail，daily 整体 PASS）

---

### F007 · BL-045 顺手清（X1 合并）

**Executor:** generator
**Priority:** low
**预估工时:** 10 min

**改动：**
- `src/lib/assets/generators/email-generator.ts:74` 删 `?? 'Not specified'` fallback
- `src/lib/assets/generators/video-script-generator.ts:80` 同删

**理由：** BL-040 已收紧 `targetAudience` 为 NOT NULL（DB schema + TS type），这 2 处 fallback 永不触发，是 dead code。

**commit-tag：** `feat(BL-023-F007): clean BL-040 retroactive dead-code (BL-045 X1)`

**Acceptance：**
- [ ] grep `'Not specified'` src/ → 0 hits（除 test fixtures）
- [ ] tsc + lint 全绿
- [ ] 不影响现有 email/video-script 生成逻辑（type 已收紧，运行时无变化）

---

## 3. 变更文件清单

```
src/lib/kol/value-score.ts                        F001+F002 EDIT (~50 行 新公式 + authenticity)
tests/unit/value-score.test.ts                    F003 EDIT/NEW (≥6 case)

src/lib/discovery/smart-match.ts                  F004 EDIT (line 100-104 映射)
tests/unit/smart-match-similarity.test.ts         F005 EDIT (≥4 case + 旧 fixture 更新)

scripts/kol-sync-daily.ts                          F006 EDIT (engagement phase 后 recompute valueScore)

src/lib/assets/generators/email-generator.ts       F007 EDIT (line 74 删 ?? 'Not specified')
src/lib/assets/generators/video-script-generator.ts F007 EDIT (line 80 同)
```

---

## 4. 关键设计决策

### D1 · engagement segment 阶梯而非线性
- 行业 baseline：< 1% 低 / 1-3% 平均 / 3-6% 优秀 / > 6% 顶级 — 阶梯映射符合 marketer 直觉
- 线性映射（如 score = rate * 4）会让 0.5% 也得 2 分，1% 得 4 分 — 区分度太细

### D2 · authenticity modifier 设 1.05/1.0/0.85（不是 1.2/1.0/0.7）
- 当前 prod 0 KOL with authenticity > 0 → modifier=1.0 全部 — 改动不影响存量 valueScore
- 未来真实 authenticity 算出后，5% 加成 / 15% 惩罚是合理范围（不会 disrupt valueScore 排序）

### D3 · valueScore 重算只覆盖 top 100
- daily cron 跑后只 top 100 KOL 重算 — 与 engagement batch 范围一致
- 全网 2442 KOL 重算成本太高（DB UPDATE 2400+ rows）— 用阶段性 cron 渐进
- 未来如发现 valueScore 整体偏移，加专用重算 script `recompute-all-value-scores.ts`

### D4 · similarityToScore 不再 +1/2 偏移
- cosine sim ≥ 0 实际场景下 +1/2 偏移误导（sim=0 不该是 50）
- 直接缩放符合「100% 完全匹配 / 0% 无匹配」直觉
- BL-044 spec §1.2 实测 cosine 0.37-0.46 → 新映射下 score=37-46 反映"中等相关"，旧映射下 68-73 高估

### D5 · F007 BL-045 dead code 顺手清（X1 合并）
- BL-040 schema 收紧后 fallback 永不触发，dead code
- 同 commit-tag `feat(BL-023-F007)` 满足铁律 #10 spec 归属
- v0.9.14 §planner.md 铁律 1 完整 pattern grep dogfood 实战收益

---

## 5. v0.9.x 框架 dogfood

| 新规 | 应用位置 |
|---|---|
| v0.9.14 §planner.md 铁律 1 完整 pattern grep | Planner 起 spec 前 grep value-score.ts + smart-match.ts + kol-sync-daily.ts + email-generator.ts → 发现 ENG_PLACEHOLDER + similarityToScore +1/2 偏移 + BL-045 dead code 同根；本批次 X1 合并 |
| v0.9.12 §pre-impl-adjudication §11 | building 中段如发现良性偏差按变种规范处理（如 BL-040 NOT NULL 收紧后 type 实际 string 而非 string\|null，dead code 边界） |
| v0.9.11 §database-patterns §8 RLS | F006 valueScore 重算用 withTenant + 标准 prisma client（已 RLS aware）；不新增表 |

---

## 6. 实装顺序（Generator 接手参考）

```
1. F001 src/lib/kol/value-score.ts 改 KolValueScoreInput + engagementScoreFromRate
2. F002 同文件加 authenticityModifier
3. F003 tests/unit/value-score.test.ts ≥6 case
4. F004 src/lib/discovery/smart-match.ts:100-104 重新映射
5. F005 tests/unit/smart-match-similarity.test.ts ≥4 case + 更新旧 fixture（grep `expectScore.*70` 等）
6. F006 scripts/kol-sync-daily.ts engagement phase 后 recompute valueScore top 100
7. F007 删 email-generator.ts:74 + video-script-generator.ts:80 dead code（同 commit-tag）
8. lint + tsc + test 守门
9. push commit
```

---

## 7. Definition of Done

### 7.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | prod redeploy 后等 1-2 day kol-sync-daily cron 跑过 → 验证 prod top 100 KOL valueScore 已用真 engagement_rate 计算 | 上线后持续观察 |

### 7.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（含新增 ≥10 测试 case）+ CI 全绿
- **L2：** staging git_sha 对齐 + (a) /discovery Smart Match 任意 product 命中 KOL 分数显示 [0, 100] 全 range（不再 [50, 100]）+ (b) /database 个别 KOL valueScore 字段值合理（手工 spot check 5-10 KOL）

### 7.3 Soft-watch（不阻塞 done）

- 全网 valueScore 渐进重算（每天 top 100，~25 天覆盖全 2442 KOL）
- engagement_authenticity 字段后续 cron 算出后 modifier 自动生效
- BL-044 prod redeploy 后 chip click + 自由文本测试不变（cosine 不变，仅 score 显示数字变化）

---

> **Spec lock：** Planner johnsong @ 2026-05-06 21:00。BL-043 done 后 Generator 接手；如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit；如 building 中段良性偏差按 §11 处理。
