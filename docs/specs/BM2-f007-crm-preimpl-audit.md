# BM2 F007 · `/crm` 前置审计（正式）

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-24
> **依据：** `framework/harness/ui-fidelity-guardrail.md` §3 + `framework/harness/pre-impl-adjudication.md`
> **状态：** 🟡 **等待 Planner 裁决**。本审计 §13 留白；不自裁决；Generator 不开工直至 Planner 提交 main 裁决。
> **提交：** 单 commit `docs(audit): BM2-F007 /crm pre-impl audit` 推 main。

---

## 1. 背景 & 主漂移要点

spec §F007 定义 4 section（阶段分布卡 / 漏斗 / 合作总额 KPI / 最近关系变化表）。
Stitch `crm-relationship.html`（559 行）实际呈现：
- 顶部：CN/EN 双语标题 "KOL 关系管理 Relationship CRM" + 时间范围 toggle（本季度 / 近 90 天 / 全部时间）+ Export CSV + "+ Manual log" 按钮
- Section A — **4 个 KPI**（Total Pipeline / Long-Term Partners + Pie / Cumulative Spend + sparkline / Avg ROI）
- Section B — **60/40 split**：左 Pipeline by stage（横向 bars 6 阶段，prospect/first_contact/negotiating + 高亮 Signed/Long-term + 下方 Paused/Terminated 小条）+ 右 Funnel Conversion（4 步漏斗：Total → Contacted → Negotiated → Long-term Partners）
- Section C — **Recent Activity 表**（KOL Profile / Stage / **Active Campaign** / Last Touch / Owner / Actions）

⚠️ **核心漂移：** spec 的 Section 4 是**关系状态变化事件流**（audit_log 派生），Stitch Section C 是**当前 KOL × 活动 关系快照**（KolCampaign 派生）。两份语义不同。

⚠️ **附加现状：** BM1-F006 已存在 Server Action `updateKolRelationshipStatus`（`src/app/[locale]/(app)/kols/[id]/actions.ts`），audit action 名是 **`"kol.relationship_changed"`**（不是 spec 写的 `"kol.relationship_status_changed"`）。任何复用方都得对齐 BM1 已有 action 名。

---

## 2. Stitch 元素逐条分类（`ui-fidelity-guardrail §3.1`）

| # | Stitch 元素 | 数据可得性 | A 照原型 | B 简化/drop | C 占位 |
|---|---|---|---|---|---|
| 1 | CN/EN 双语标题 | i18n 已有 zh/en，但 BM1 其它页未做 dual title | 全实现：标题分两行 EN+中文 | drop（仅 EN，根据 locale 动态切换）| — |
| 2 | 时间范围 toggle（本季度 / 近 90 天 / 全部时间）| 需用 audit_log + KolCampaign createdAt 过滤 window | 全实现：3 段切换 + URL `?range=q\|90d\|all` | drop（默认全部时间）| 仅 active button "近 90 天"，其它 disabled+tooltip "B4" |
| 3 | Export CSV 按钮 | 需 server action 流式 CSV | 实现 | drop | disabled+tooltip "B4 CSV export" |
| 4 | "+ Manual log" 按钮 | 需 manual entry form 写 audit_log | 实现 | drop | disabled+tooltip "B4 manual log" |
| 5 | KPI: Total Pipeline = Σ Kol where deletedAt IS NULL | Kol.count() ✓ | 实现 | drop | — |
| 6 | KPI: Long-Term Partners + Pie ratio | Kol where relationshipStatus='long_term' / total ✓ | 实现 + circular ring chart | drop pie 改纯数字 | — |
| 7 | KPI: Cumulative Spend ($382,600 + sparkline 14d) | Σ KolCampaign.kolFee where status ∈ {signed, delivered, paid}（spec §F007 §3 锚定）| 实现 + sparkline trend over time（基于 EmailLog or audit_log timeline）| 实现仅数字 drop sparkline | — |
| 8 | KPI: Avg ROI (+426%) | 需 F008 ROI engine（**未实现**）| F008 必须 ship 才能算 | drop | "—" + tooltip "Available after F008 ships" |
| 9 | Pipeline by stage 横向 bars（6 阶段，含 paused/terminated 小条 + Long-term 高亮 + animate-pulse）| Kol.groupBy(relationshipStatus) ✓ | 实现 6 stages + 高亮 long_term | drop（用 spec §1 6 cards 替代）| — |
| 10 | Funnel Conversion 4 步（Total Pipeline → Contacted → Negotiated → Long-term）| Kol.groupBy(relationshipStatus) 累计阶段 prospect → first_contact → negotiating → long_term；转化率 = step_n / step_(n-1) | 实现 + 转化率标 % | drop | — |
| 11 | Recent Activity 表 6 列（KOL/Stage/Active Campaign/Last Touch/Owner/Actions）| Kol + KolCampaign + last EmailLog 大 join；Active Campaign = 最近 KolCampaign；Last Touch = max(EmailLog.sentAt, audit_log.created_at) | 实现 6 列（Owner = Campaign.ownerUserId 拉 User.name）| 改用 spec §4 "audit_log 关系变化流" 5 列（KOL/谁改/何时/A/→B）| 改"近 30 条 Recent Changes"（audit_log 派生） |
| 12 | Stage 6 卡片 click → /database?status=X（**spec §1 锚定，Stitch 没有**）| Database 页已有 relationshipStatuses filter | 必须实现（spec 直接要求）| — | — |

⚠️ **2 处最大决议：#11（Recent Activity 语义）+ #9 vs #12（Pipeline 横条 vs 6 卡片）**

---

## 3. 主决议请求（13 条）

### #A — 顶部 layout（spec vs Stitch）

| 方案 | 描述 |
|---|---|
| A1 | Stitch dashboard 全采（4 KPI + 60/40 + Recent Activity）+ spec 的"6 cards click→/database"作为额外的"shortcut row"插入 |
| A2 | spec layout（6 stage cards / funnel / 1 KPI / audit-log table）+ 视觉对齐 Stitch 调性 |
| A3 | Hybrid：4 KPI + Pipeline horizontal bars + Funnel + 6 cards click row + audit_log 关系变化表 |
| A4 | Stitch layout 全采，spec §4 audit_log 表用 Stitch 的 Recent Activity 替代 |
| **建议** | 待 Planner 裁决 — A3 性价比最高（保留所有 Stitch 视觉块 + 满足 spec 数据语义 + click→/database 不破坏 Stitch 主轴） |

### #B — 时间范围 toggle

A 全实现 / B drop / C 占位 disabled — 建议 **C 占位**（默认显示"近 90 天" active，其余 disabled+tooltip "B4 time-range filter"）。理由：MVP 数据量小，window filter 价值低；查询逻辑需要全表写 where + UI 切换 + URL 同步，超 F007 scope。

### #C — Export CSV

建议 **C disabled+tooltip "B4 CSV export"**（保视觉块；功能 B4 实现）。

### #D — "+ Manual log" 按钮

建议 **C disabled+tooltip "B4 manual relationship log"**（同理，保块 + 后续）。

### #E — KPI 4 vs spec 1（合作总额）

| 方案 | 描述 |
|---|---|
| A | 全实现 4 KPI（Total Pipeline / Long-Term + ring / Cumulative Spend + sparkline / Avg ROI 占位 "—" 等 F008） |
| B | 仅 spec 1 KPI（合作总额）|
| C | 实现 3 KPI（Total Pipeline / Long-Term / Cumulative Spend），drop Avg ROI（避免 F008 依赖）|
| **建议** | C：sparkline 14d 数据计算复杂度低（KolCampaign.signedAt/audit_log），ring chart 用 inline SVG ~10 行；Avg ROI drop（F008 完成后再改）|

### #F — Pipeline by stage 6 阶段横条（Stitch B 左）+ 6 cards click→/database（spec §1）

| 方案 | 描述 |
|---|---|
| A | 仅 Stitch 横条 6 stages（drop spec click→/database）|
| B | 仅 spec 6 cards click |
| C | 二者并存：上方 6 cards（spec），下方 horizontal bars（Stitch）— 两套视觉重 |
| D | Stitch 横条 + 每条做成 clickable link 跳 /database?status=X（spec 数据 click 行为 + Stitch 视觉）|
| **建议** | **D**：单一视觉块同时满足两份要求；clickable bar = ARIA `<a>` wrap（已访问性化）|

### #G — Funnel Conversion 4 步

spec + Stitch 一致 → 实现。无决议。但需确认 funnel 阶段链：
- spec 写：prospect → first_contact → negotiating → long_term（4 步，spec §F007 §2）
- Stitch 写：Total Pipeline → Contacted → Negotiated → Long-term Partners（4 步，但首步是"all"不是"prospect"）

| 方案 | 描述 |
|---|---|
| A | spec 阶段链（首步 prospect 数）|
| B | Stitch 阶段链（首步 Total Pipeline = Σ all stages）|
| **建议** | **B**：UX 更直观（"漏斗顶端 = 所有 KOL"比"prospect 阶段 KOL"更易读）；转化率公式：`contacted/total`, `negotiated/contacted`, `long_term/negotiated` |

### #H — Recent Activity 表语义（最大漂移）

| 方案 | 描述 |
|---|---|
| A | spec 原版："最近关系变化表"，audit_log where action='kol.relationship_changed' 最近 30 条；列：KOL / Actor / 时间 / Before → After |
| B | Stitch 原版："Recent Activity"，KolCampaign + EmailLog join；列：KOL / Stage / Active Campaign / Last Touch / Owner / Actions |
| C | 同时实现两个 table，section 内做 tab 切换："Stage Changes" vs "Active Touches" |
| D | 折中：5 列（KOL / Current Stage / Active Campaign / Last Touch / Owner），无 "Actions" 列；audit_log 信息走另一种呈现（如下方"Recent stage changes" 单独小卡片）|
| **建议** | **A**：spec 明确锚定 audit_log → 关系变化是 CRM 核心信号；Stitch 的 "Active Campaign / Last Touch" 是 KolCampaign 信息，已在 /campaigns/:id 页有；不重复呈现；UX 更聚焦 |

### #I — relationshipStatus 切换 endpoint

spec：`PATCH /api/kols/:id/relationship-status`。BM1 已有 Server Action `updateKolRelationshipStatus`（`/kols/[id]/actions.ts`）—— 没有 REST 端点。

| 方案 | 描述 |
|---|---|
| A | 新建 REST `PATCH /api/kols/[id]/relationship-status`（spec 字面）+ /crm 用新 Server Action 调同 helper |
| B | /crm 复用 BM1 Server Action（无 REST，BM1 已有 helper）|
| C | 扩展刚 F006 落地的 `PATCH /api/kols/[id]` 接受 `relationshipStatus` 字段（违 BL-011 决议——MVP 不 unify）|
| **建议** | **A**：spec 显式 REST；新建薄路由 wrap 共享 helper（10 LOC）；/crm 用 Server Action 拉同 helper（避免跨页 useFormStatus 复杂性）；未来 mobile 客户端也能用 REST |

### #J — audit_log action name 对齐

spec 写 `kol.relationship_status_changed`，BM1 实现 `kol.relationship_changed`。

| 方案 | 描述 |
|---|---|
| A | 沿用 BM1 名 `kol.relationship_changed`（修 spec 文字）|
| B | 改 BM1 + 新 F007 都用新名 `kol.relationship_status_changed`（migration 老 audit_log 行）|
| **建议** | **A**：避免历史数据 migration；现有 ~30 条 BM1 audit_log 已是旧名；spec 文字纠正为现有名；不影响功能 |

### #K — `/api/crm/overview` 数据契约

spec：`{ stageDistribution, funnelMetrics, collabKpi, recentChanges }`。

按 §3 #E #F #H 决议补：

```typescript
{
  stageDistribution: Array<{ status: RelationshipStatus, count: number }>; // 6 项
  funnelMetrics: {
    steps: Array<{ label: string, count: number }>;  // 4 步
    conversions: Array<{ label: string, percent: number }>; // 3 段
  };
  collabKpi: {
    totalPipeline: number;          // Kol.count
    longTermPartners: number;       // status=long_term count
    longTermRatio: number;          // /total
    cumulativeSpend: number;        // Σ KolCampaign.kolFee where status ∈ {...}
    spendSparkline: number[];       // 14 个数据点
    // avgRoi 字段保留 type 但 MVP 返 null（F008 落地后填）
    avgRoi: number | null;
  };
  recentChanges: Array<{
    actorId: string;
    actorName: string | null;
    kolId: string;
    kolName: string;
    kolAvatarUrl: string | null;
    before: string;
    after: string;
    changedAt: string;  // ISO
  }>;  // last 30
}
```

### #L — Recent stage changes 数据加载策略

audit_log 按 30 天/30 条 DESC 拉，性能 OK（已有 `(tenantId, createdAt DESC)` 索引）。需要 join `User`（actor）+ `Kol`（resource）。Prisma 多 join — 单 query 即可。

### #M — 必用公共组件清单（`ui-fidelity-guardrail §3.2`）

来自 hotfix-F001 + 现有：
- `<Button variant="primary-gradient | ghost | secondary">` — toggle / Export CSV / Manual log buttons
- `<Select>` — Recent stage changes 表中行内 status select（如果保留 row-level 切换；本 audit 建议 #H A 方案不在表内放 select，仅展示历史 → 不需要 row select）
- `<Table>` + `<THead>/<TBody>/<TRow>/<TCell>` — Recent stage changes
- `<StatCard>`（common）— 3 KPI cards
- `<StatusBadge domain="kolRelationship">` — Recent stage changes 行的 before/after badge
- `<GlassPanel>` — 所有半透明容器
- `<SectionHeader>` — section titles
- `<AvatarWithPlatformBadge>` — Recent stage changes 的 KOL avatar + platform

**新组件需 Planner 批准：**
- `<Funnel>` 业务组件 — 4-step funnel SVG/CSS（仅本页用，不抽 common，inline 在 page）
- `<HorizontalStageBars>` 业务组件 — Pipeline by stage 6-bar visual（同上，inline）
- `<Sparkline>` — Cumulative Spend 14d trend；本页 + dashboard F007 + ROI F009 都可能用 → **建议抽到 `src/components/common/Sparkline.tsx`**
- `<RingProgress>` — Long-Term Partners 比例环；同上候选抽公共

### #N — 幽灵控件清单（`ui-fidelity-guardrail §3.3`）

| 控件 | 处置 |
|---|---|
| 时间 toggle 3 段（本季度 / 近 90 天 / 全部时间）| disabled + tooltip "B4 time-range filter"（按 #B 决议）|
| Export CSV 按钮 | disabled + tooltip（按 #C）|
| + Manual log 按钮 | disabled + tooltip（按 #D）|
| Recent Activity 表 "more_vert" 按钮 | drop（按 #H A 方案，无 row 操作）|
| KPI 卡片右上 icon-only 装饰 | 保留（纯视觉，不 click）|

---

## 4. 数据来源 / Prisma 查询规划

### 4.1 stageDistribution
```sql
SELECT relationship_status, COUNT(*) FROM kol
WHERE tenant_id = $1 AND deleted_at IS NULL
GROUP BY relationship_status;
```
6 个值（含 0 count）— 客户端用 `RELATIONSHIP_STATUSES` 数组补 0 桶。

### 4.2 funnelMetrics
聚合 stageDistribution 为 4 步：
- step1 = sum(all)
- step2 = (first_contact + negotiating + long_term)
- step3 = (negotiating + long_term)
- step4 = long_term

### 4.3 collabKpi
- `totalPipeline = Σ stageDistribution`
- `longTermPartners = stageDistribution['long_term']`
- `longTermRatio = longTermPartners / totalPipeline`
- `cumulativeSpend = Σ KolCampaign.kolFee where status IN ('signed', 'delivered', 'paid')`
- `spendSparkline = Array(14) of daily Σ KolCampaign.kolFee where updatedAt in [day, day+1)` — **简化建议**：只统计 EmailLog status=sent count 14d trend 作为 spend proxy（kolFee 无 timestamp，不能精确 daily bucket）。**或用 `audit_log where action='kol.relationship_changed' AND after.relationshipStatus IN ('signed','long_term')`** —— 提议 Planner 选简单数据源。
- `avgRoi = null`（F008 后填）

### 4.4 recentChanges
```sql
SELECT a.actor_user_id, a.payload, a.created_at, u.name AS actor_name,
       k.id AS kol_id, k.display_name, k.avatar_url
FROM audit_log a
LEFT JOIN "user" u ON u.id = a.actor_user_id
LEFT JOIN kol k ON k.id = a.resource_id
WHERE a.tenant_id = $1 AND a.action = 'kol.relationship_changed'
ORDER BY a.created_at DESC
LIMIT 30;
```
audit_log 不走 RLS（platform table），需 `withTenant` 过滤 tenant_id 列 + Kol RLS 自然把跨租户 join 行过滤掉。

---

## 5. API 路由

| 路由 | 方法 | 作用 |
|---|---|---|
| `/api/crm/overview` | GET | 单一聚合查询返 4 块数据 |
| `/api/kols/[id]/relationship-status` | PATCH | spec §F007 显式（决议 #I A） |

`/crm/page.tsx` 直接用 `runCrmOverview()` helper，不调 GET API（RSC 直读 DB）。GET API 留给未来移动端/外部。

---

## 6. 不在本批次范围

- 时间范围 toggle 真功能（B4 filter）
- Export CSV 真功能（B4）
- Manual log 真功能（B4）
- audit_log row-level 操作（spec 也未要求）
- /database `?status=X` URL 参数支持（**需查 BM1 /database 实现是否已支持，否则需先扩展**）

⚠️ **依赖检查：** /database 路由需支持 `?status=X` query param。若不支持，本 F007 的 click 跳转是死链。请 Planner 确认或预批准 BM1 /database 微调（仅加 URL parse，不改 UI）。

---

## 7. 测试策略

### L1 unit
- `src/lib/crm/aggregate.ts` pure functions — funnel conversion math / status bucket fill / ratio compute

### L2 integration
- `tests/integration/crm-overview.test.ts`：
  - stageDistribution 正确（含 0 桶）
  - funnel 转化率公式正确
  - cumulativeSpend = Σ KolCampaign.kolFee where status IN signed/delivered/paid
  - recentChanges 30 条上限 + 按 createdAt DESC + 跨租户隔离

### L3 E2E（staging）
- `tests/e2e/crm-fidelity.spec.ts`（按 BM1 F009 教训：无 networkidle / 无 hardcoded count / locale-prefixed）
  - 切换 3 个 KOL relationshipStatus → CRM 实时更新（spec L2 要求）

### Visual
- `tests/screenshots/baseline/en-crm.png` 入 git（F011 前硬门槛）

---

## 8. i18n

新 namespace `crm.*` 约 40-60 keys。en + zh 真译；ja/ko/es en-stub。

---

## 9. BM1 F009 教训遵守

- [x] 无 `waitForLoadState("networkidle")`
- [x] 不硬编 count（用 regex/>0）
- [x] PATCH 后 revalidate `/[locale]/crm` + `/[locale]/database`
- [x] redirect / link locale-prefixed

---

## 10. 风险登记

| 风险 | 缓解 |
|---|---|
| /database `?status=X` 未支持 → click 死链 | §6 ⚠️ 请 Planner 决：本 F007 同 commit 加 BM1 微调，OR /crm card 的 click 等 BM1 patch |
| Sparkline 14d 数据无 timestamped spend → 用 audit_log 派生 spend events | §4.3 详述；Planner 可选简化"近 14 天 audit `kol.relationship_changed → long_term/signed` count"作为 trend proxy |
| audit_log RLS：BI4-F002 加的 `kol.relationship_changed` 行有无 tenant_id？ | 已读 audit/log.ts：`tenantId` 字段已记录 ✓ |
| BM1 audit action 名 `kol.relationship_changed` vs spec `kol.relationship_status_changed` | §3 #J 决议 |
| F008 Avg ROI 数据未 ready | §3 #E C 方案 drop Avg ROI |
| Stitch Recent Activity 与 spec audit_log table 完全不同语义 | §3 #H 决议 |

---

## 11. 实现清单（裁决后顺序）

1. `src/lib/crm/aggregate.ts` pure helpers（funnel math / bucket fill）（20 min）
2. `src/lib/crm/overview.ts` server-side runCrmOverview helper（30 min）
3. `src/app/api/crm/overview/route.ts` GET（10 min）
4. `src/app/api/kols/[id]/relationship-status/route.ts` PATCH（15 min）
5. `src/app/[locale]/(app)/crm/page.tsx` RSC + 5 子组件（KpiStrip / PipelineBars / Funnel / RecentChanges / DisabledControls）（90 min）
6. 可能新建 `src/components/common/{Sparkline,RingProgress}.tsx`（按 #M 决议）（30 min）
7. integration + unit tests（60 min）
8. i18n + lint + typecheck + build（30 min）
9. /database `?status=X` 支持（按 §6 决议；可能 ~15 min 微改）
10. CI watch + staging deploy + visual baseline（30 min）

---

## 12. 估算

| 环节 | 预估 |
|---|---|
| 审计本身 | 30 min |
| 实现（以裁决全 A 为例）| 4-5 h |
| 测试 + 闸门 | 1.5 h |
| **总计** | **~6-7 h** |

---

## 13. Planner 裁决（johnsong Planner · 2026-04-24）

### 13.1 短格式裁决

```
#A:A3（Hybrid：4→3 KPI + Pipeline horizontal bars 可点 + Funnel + 6 cards click 合一 + audit_log 最近变化表）
#B:C（默认"近 90 天" active + 其余 disabled+tooltip "B4 time-range filter"）
#C:C（Export CSV disabled+tooltip "B4 CSV export"）
#D:C（"+ Manual log" disabled+tooltip "B4 manual relationship log"）
#E:C（3 KPI：Total Pipeline + Long-Term ring + Cumulative Spend + sparkline；Avg ROI drop 显 "—" + tooltip "Available after F008 ships"）
#F:D（Pipeline horizontal bars + 每条 clickable wrap <a href="/database?status=X">，单一视觉块满足 Stitch 视觉 + spec click 语义）
#G:B（Funnel 4 步：Total Pipeline → Contacted → Negotiated → Long-term Partners，UX 更直观）
#H:A（spec 原版 audit_log 最近 30 条变化；列 KOL / Actor / When / Before → After）
#I:A（新建 `PATCH /api/kols/[id]/relationship-status` 薄 wrapper + 复用 BM1 existing helper `updateKolRelationshipStatus`；/crm 用 Server Action 调同 helper）
#J:A（沿用 BM1 既有 `kol.relationship_changed` action 名；修 spec §F007 §4 文字为 `kol.relationship_changed`）
#K:✓ 数据契约 per §3 #K 采用
#L:audit_log 手动 tenant_id 过滤（BI4-F002 platform table 无 RLS）+ Prisma multi-join single query
#M:Funnel + HorizontalStageBars inline 在 page；Sparkline + RingProgress 抽到 `src/components/common/`（批准新抽）
#N:依 #B/#C/#D 决议，tooltip 文案均注明 "B4"
```

**spendSparkline 数据源裁决**（§4.3 特殊子决议）：采用 **audit_log proxy**——`audit_log WHERE action='kol.relationship_changed' AND payload.after IN ('signed','long_term')` 按天聚合 14d。理由：`KolCampaign.kolFee` 无 timestamp 无法精确 daily bucket；此 proxy 反映"新增签约节奏"作为 spend 趋势替代，比真 spend 更语义对齐 CRM 页（关系推进 → 收入潜力）。UI 标 "14 天新增签约活跃度" 而非 "Spend"，避免歧义。

**/database ?status=X URL 参数扩展裁决**（§6 特殊子决议）：**批准本 F007 同 commit 做**。理由：(a) 死链不可接受；(b) 仅 parse query param + pre-fill filter，~15 min 零风险改动；(c) 分两 commit 反增复杂度。Generator 在 F007 实现中顺带改 `/database/page.tsx` 读 `searchParams.status` 注入 DatabaseFilterBar 初始值。

### 13.2 逐条裁决理由

| # | 决定 | 理由 |
|---|---|---|
| A | **A3 Hybrid** | Generator 建议 A3 成立——A1/A4 丢 spec §1 click 语义；A2 丢 Stitch 视觉还原度；A3 把 6 cards click 融入 Pipeline bars（见 #F:D）避免重复 |
| B | **C 占位** | 时间 filter 需要贯穿 4 查询逻辑，超 F007 scope；MVP 数据小窗口 filter 价值低；tooltip 指 B4 合理（PRD §4.2 Out of Scope 覆盖 "高级 CRM" 到 B4）|
| C | **C disabled** | 同理；保视觉还原度；B4 实装 |
| D | **C disabled** | 同理 |
| E | **C 3 KPI** | Avg ROI 依赖 F008，F008 尚未 ship（BM2 F008 还 pending），hardcode 假值会误导；drop 更诚实；F008 完成后再加 |
| F | **D 点击横条** | 视觉 + 语义双赢的最优解；`<a>` wrap 保 a11y；clickable 用 cyan underline on hover 视觉提示 |
| G | **B Stitch 阶段链** | "Total Pipeline → Contacted → Negotiated → Long-term" 比 "prospect → first_contact → ..." 更直观（漏斗顶 = 所有 KOL 更符合直觉）；spec §F007 §2 也接受此链（文字略异但语义等价）|
| H | **A spec 原版 audit_log** | Stitch Recent Activity 的"Active Campaign / Last Touch"信息在 /campaigns/:id 已有，不重复；spec §4 audit_log 关系变化流是 CRM **独特价值**（who changed what when）；UX 聚焦"关系演变历史"比"当前状态快照"更契合 CRM 主题。视觉块保留（6-列表 + glass-panel 样式），只是列内容换语义——视觉还原度不丢 |
| I | **A 新建 REST + Server Action** | spec §F007 §4 字面要求 REST；BM1 已有 helper 可复用（10 LOC wrapper）；未来 mobile/API 客户端受益；Server Action 在 /crm 做 UX 简洁 |
| J | **A 沿用 BM1 既有** | `kol.relationship_changed` 已写入 ~30 audit_log 行；migration 成本 > 语义精确收益；spec 文字改合理 |
| K | ✓ 契约采用 | 补充 `spendSparkline` 14 点 + `avgRoi: null` + 子字段 `longTermRatio` 均 OK |
| L | ✓ tenant_id 手动过滤 | 必须 — audit_log BI4-F002 故意不走 RLS（跨租户 platform-wide 审计需要）；查询前显式 WHERE tenant_id |
| M | ✓ inline + 抽 2 公共 | Funnel + HorizontalStageBars 仅 CRM 用 → inline；Sparkline + RingProgress 候选复用（F007/F009 dashboard KPI）→ 抽到 common/。**批准新建这两个 common 组件**（UI guardrail §3.3 允许 Planner 批准新组件）|
| N | ✓ 依 B/C/D | 幽灵控件全 disabled+tooltip 一致化；tooltip 文案用 "Available in B4"（不用 "Coming soon" 避免模糊）|

### 13.3 同步文档修订清单

Planner 本次 commit 同步修订：

1. **BM2 spec §F007 §4 audit action 名**：`kol.relationship_status_changed` → `kol.relationship_changed`（对齐 BM1 既有）
2. **BM2 spec §F007 acceptance** 不动（11 features acceptance 保持 features.json 口径；实现细节落 spec §4 body 无需 features.json 改）
3. **docs/specs/BM2-campaign-outreach-roi-spec.md §F007** 补说明：
   - Funnel 阶段链定为 "Total Pipeline → Contacted → Negotiated → Long-term"（对齐 Stitch 语义）
   - spendSparkline 数据源 proxy 定为 "audit_log signed/long_term 转入 14d 聚合"
4. **backlog**：无新增（本批次决议不产生新 BL）

### 13.4 额外叮嘱（非阻塞）

1. **audit_log query 必须 RLS 兜底**：即使 platform table 无 RLS policy，查询语句必须 `WHERE a.tenant_id = $currentTenantId`；多 join 时 `LEFT JOIN "user" u ON u.id = a.actor_user_id AND u.tenant_id = a.tenant_id` 保护跨租户 leak
2. **funnel 转化率 div-by-0**：step_(n-1) = 0 时显 "—" 而非 "NaN%" 或 "∞%"；pure helper `src/lib/crm/aggregate.ts` 必含 guard
3. **Pipeline bars 的 0 count stage 仍要渲染**（paused / terminated 通常是 0）：bar 宽度 `max(2px, actual%)` 让 empty stage 可见占位
4. **long_term RingProgress 动画**：可用 CSS `@keyframes` 或 transition，不引入 framer-motion（新依赖）
5. **Sparkline 抽出样板**：14 点数组 → inline SVG `<polyline>` + viewBox 归一化；props 签名 `<Sparkline data={number[]} width={120} height={40} color="cyan" />`；无 tooltip（避免 interactivity 复杂度；hover 改 Post-MVP）
6. **RingProgress props**：`<RingProgress value={0.48} size={80} strokeWidth={6} label="48%" />`；SVG 两圈（bg + fg stroke-dasharray）
7. **disabled 按钮 tooltip 使用 hotfix-F001 落地的 `<Button variant="ghost">` + `title` attr 或 `aria-disabled`**：不要 hover tooltip library；原生 `title` 属性 MVP 够用
8. **/database ?status=X 扩展细节**：`page.tsx` 读 `searchParams.status`，若是有效 RelationshipStatus 值（6 值枚举）则注入到 DatabaseFilterBar 的 defaultStatus prop；非法值静默忽略（不跳转 404）；**重要**：保 URL-driven form pattern，不要引入 client state（F004 Discovery 的 pattern）
9. **PATCH `/api/kols/[id]/relationship-status`**：zod 校验 status 枚举 6 值 + RLS 读 + audit_log 写入 `kol.relationship_changed` action + event_log `kol.relationship_updated`；response 返更新后的 Kol 行（便于 optimistic UI）
10. **BM1 F009 教训遵守**：点 Pipeline bar → /database?status=X 后 Reviewer 断言用 `await page.waitForURL(/\/database\?status=long_term/)` 锁带 status 的 URL（prefix regex）
11. **埋点**：`crm.overview_loaded` + `kol.relationship_updated`（existing BM1 audit action 对应）+ `crm.bar_clicked`（新，记录用户从 Pipeline bar 跳去哪个 status 的 /database）
12. **视觉参照 HTML 主**：Generator 开工前用浏览器打开 `design-draft/stitch-references/crm-relationship.html` 与 staging 并排（不看 .png 缩略图，per `ui-fidelity-guardrail §1.1`）

### 13.5 开工确认

**Planner 本次 commit 推 main 后 Generator 立即开工 F007**。按 §11 顺序 11 步推进（~6-7h）。开工前确认：
- [x] F006 已 done（依赖 KolCampaign / Kol 现状数据）
- [x] hotfix-F001 公共组件库就绪（Table/Select/Button/StatusBadge 等）
- [x] audit_log 已有 `kol.relationship_changed` 真数据（BM1 F006 生成）
- [x] 批准抽新组件 `Sparkline` + `RingProgress` 到 `src/components/common/`
- [x] 批准 /database `?status=X` 扩展同 commit 做
- [x] 批准 spendSparkline audit_log proxy（UI 标"14 天新增签约"）
- [x] BM1 F009 E2E 教训清单必遵守

---

**Generator 开工。本审计 §13 已裁决。**
