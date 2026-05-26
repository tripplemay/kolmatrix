# BL-074 IA v2 Spec — 加第 5 一级 nav "活动" (campaigns) + ADR-015 修订

> **Sprint：** BL-074-ia-v2
> **Type：** 架构级 IA 调整（非 hotfix）— NAV_ITEMS + ADR + 5 locale i18n + e2e nav 测试 + visual baseline regen
> **预估工时：** ~11h ≈ 2 day Generator + 0.5 day Reviewer
> **关联：** docs/test-reports/BL-073-prod-hotfix-audit-2026-05-26.md §1 #3 + §7（用户反馈源头 + IA 现状审计）
> **状态：** A0+A1 完成 → 待 building
> **依赖：** BL-073 done @ tag bl073-done @ 433047d（已满足）

---

## §1 背景与触发

### 1.1 触发

5/26 用户报 BL-073 issue #3：
> "为活动匹配 KOL 功能，在一级菜单上没有入口，需要在洞察→新建活动→点击一个活动 才可以完成匹配"

BL-073 Phase A1 用户 lock 方案 **B（加第 5 一级 nav "活动"）**，但子决策（顺序 / icon / i18n 标签 / ADR / CTA 模式）留 BL-074 spec phase 时 lock。BL-074 本批次完成所有 sub-decisions + 实施。

### 1.2 现状审计（详 BL-073 audit doc）

- 一级 nav 4 条：brief / match / reach / insight（4 动词路由 IA）
- `/campaigns` 路由 alive 但**不在 nav**，sidebar 高亮假装为 match（nav-config.ts:99 path-rewrite）
- 用户主流程认知断层：营销人员认知中"活动"是核心实体，但被藏成二级
- 现有进入 `/campaigns` 列表的入口：`/insight` QuickActions 第 4 按钮（路径 `/campaigns`，icon `rocket_launch`）— 冗余但唯一

### 1.3 A1 用户 5/26 lock（4 项子决策）

| 决策 | Lock |
|---|---|
| **Nav 顺序** | B: `brief / campaigns / match / reach / insight`（创建后看列表，逻辑流：先 brief 创建 → campaigns 看列表 → match 匹配 KOL）|
| **Material Symbols icon** | A: `campaign`（字面对应"营销活动"，名词性质，与 4 动词 icon 区分）|
| **i18n nav.campaigns + Description** | A: zh="活动" / en="Campaigns" + desc="管理营销活动与项目"（与现有 nav.* 同顶格 sidebar.* 命名）|
| **ADR-015 + 列表行 CTA** | A: **ADR-015 新建** supersedes ADR-013（不原地改）+ `/campaigns` **每行**右侧加"Match KOL"按钮 → `/match?campaignId=:id`（多行 CTA，独立追溯）|

### 1.4 角色分配

role_assignments = null（默认映射）

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- F001 NAV_ITEMS 4 → 5（顺序 B）+ icon + i18n 5 locale + nav-config path-rewrite
- F002 `/campaigns` CampaignsTable.tsx 每行 "Match KOL" 快捷按钮
- F003 `/insight` QuickActions 去冗余 "活动" 按钮（4 → 3 按钮，grid 调）
- F004 ADR-015 起草 supersedes ADR-013（不修 ADR-013 内容仅顶部加 marker）
- F005 e2e nav-bar 测试更新 + visual baseline regen
- F006 Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE（明示）

- `/campaigns` 列表页本身的功能（filter / sort / pagination）— 已 alive 不动
- `/campaigns/[id]` 详情页 AiRecommendationPanel — 已 alive 不动
- 5 locale 翻译完善度 audit — 仅本批次 4 个新 key（nav.campaigns + desc + campaigns.matchKolAction + 可能 1-2 个辅助）
- BL-075（KOL data coverage）独立批次
- Phase 5 个性化学习

### 2.3 不变量

1. **0 业务逻辑改动**：仅 nav + i18n + UI CTA + ADR docs，不改任何 API / server action / DB
2. **NAV_ITEMS 顺序固定**: brief / campaigns / match / reach / insight（顺序 B lock，不得改）
3. **Sidebar 高亮 path-rewrite 调整**: `if path.startsWith("/campaigns") return "campaigns"`（删原 `return "match"`）
4. **ADR-013 内容不动**：仅顶部加 "Superseded by ADR-015 (5 一级 nav IA)" marker 一行；body 内容保历史完整
5. **5 locale 同步**：F001 + F002 i18n key 在 zh/en/ja/ko/es 全 5 locale 同时加

---

## §3 实施 Phase 划分

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | Audit （BL-073 audit §1 #3 + §7） | ✅ done |
| **A1** | 4 子决策 lock | ✅ done |
| **B** | F001 NAV_ITEMS + path-rewrite + i18n + icon | 2.5h | Generator |
| **C** | F002 列表行 Match CTA + F003 QuickActions 去冗余 | 1.5h | Generator |
| **D** | F004 ADR-015 起草 | 2.5h | Generator |
| **E** | F005 e2e nav + visual baseline regen | 1.5h | Generator |
| **F** | F006 Reviewer L1+L2 + signoff | 2h | Codex |
| **总** | | **~11h ≈ 2 day Generator + 0.5 day Reviewer** | |

**建议 commit 分批：** F001 一 commit（nav 核心） / F002+F003 一 commit（UI CTA 调整） / F004 一 commit（ADR） / F005 一 commit（test + visual baseline） / F006 Reviewer。

---

## §4 Features 详细描述

### F001: NAV_ITEMS 加 campaigns（顺序 B）+ icon + i18n 5 locale + path-rewrite

**Why：** 用户认知断层根因 — campaigns 不在 nav。Lock 顺序 B + icon `campaign` + i18n 标签。

**What：**

1. `src/components/layout/nav-config.ts` NAV_ITEMS 从 4 → 5（顺序 B）：

```ts
export const NAV_ITEMS: NavItem[] = [
  { id: "brief",     href: "/brief",     i18nKey: "nav.brief",     descriptionKey: "nav.briefDescription",     icon: "edit_note" },
  { id: "campaigns", href: "/campaigns", i18nKey: "nav.campaigns", descriptionKey: "nav.campaignsDescription", icon: "campaign" },   // BL-074 新加
  { id: "match",     href: "/match",     i18nKey: "nav.match",     descriptionKey: "nav.matchDescription",     icon: "auto_awesome" },
  { id: "reach",     href: "/reach",     i18nKey: "nav.reach",     descriptionKey: "nav.reachDescription",     icon: "send" },
  { id: "insight",   href: "/insight",   i18nKey: "nav.insight",   descriptionKey: "nav.insightDescription",   icon: "insights" },
];
```

2. `nav-config.ts:99` path-rewrite 改：

```ts
- if (path.startsWith("/campaigns")) return "match"; // campaigns list + [id] live in match
+ if (path.startsWith("/campaigns")) return "campaigns"; // BL-074 — campaigns now top-level nav
```

3. `messages/{zh,en,ja,ko,es}.json` `sidebar` namespace 加 2 keys：

| locale | nav.campaigns | nav.campaignsDescription |
|---|---|---|
| zh | "活动" | "管理营销活动与项目" |
| en | "Campaigns" | "Manage marketing campaigns and projects" |
| ja | "キャンペーン" | "マーケティングキャンペーンとプロジェクトの管理" |
| ko | "캠페인" | "마케팅 캠페인 및 프로젝트 관리" |
| es | "Campañas" | "Administra campañas de marketing y proyectos" |

4. `scripts/material-symbols-icons-manifest.txt` 加 `campaign` icon（如未在 — 实际已在 manifest，验证）

5. 跑 `bash scripts/regenerate-material-symbols-subset.sh` 验 woff2 含 `campaign` glyph

**Acceptance：**
- [ ] NAV_ITEMS 5 条，顺序 brief / campaigns / match / reach / insight
- [ ] icon 配置 `campaign`，woff2 glyph 含此 icon
- [ ] nav-config.ts:99 path-rewrite 改为 "campaigns"
- [ ] 5 locale messages 含完整 `nav.campaigns` + `nav.campaignsDescription`
- [ ] tests/unit/i18n-locale-coverage.test.ts 8/8 PASS
- [ ] staging /zh + /en + /ja + /ko + /es 浏览器 sidebar 5 nav 顺序 + label 正确
- [ ] 进入 /campaigns 或 /campaigns/[id]，sidebar 高亮 "campaigns" nav

---

### F002: /campaigns 列表行 "Match KOL" 快捷 CTA

**Why：** A1 lock A — 每行加 Match 按钮，让 campaigns 列表直接进入 match flow。

**What：**

1. `src/app/[locale]/(app)/campaigns/CampaignsTable.tsx` 每行加新 TCell（右侧）含 Match Link：

```tsx
<TCell align="right">
  <Link
    href={`/${locale}/match?campaignId=${row.id}`}
    aria-label={t("matchKolAction.aria", { name: row.name })}
    data-testid="campaign-row-match-kol"
    className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-1.5 text-xs font-semibold text-cyan-fixed transition-colors hover:bg-cyan/20"
  >
    <span className="material-symbols-outlined text-[14px]" aria-hidden>
      auto_awesome
    </span>
    {t("matchKolAction.label")}
  </Link>
</TCell>
```

2. 表头加对应 `<TH>` "操作"列

3. `messages/{zh,en,ja,ko,es}.json` `campaigns` namespace 加：

```json
"matchKolAction": {
  "label": "匹配 KOL",      // zh; en="Match KOL"; ja="KOLマッチ"; ko="KOL 매칭"; es="Match KOL" (brand kept-en)
  "aria": "为活动 {name} 匹配 KOL"   // 5 locale 翻译
}
```

4. `scripts/material-symbols-icons-manifest.txt` 确认 `auto_awesome` 已在（match nav 同 icon 复用，应已有）

**Acceptance：**
- [ ] CampaignsTable 每行右侧含 Match KOL 按钮
- [ ] 点击跳转 `/zh/match?campaignId={uuid}` 触发 AiSuggestionsSidebar mount（沿用 BL-065-F005 逻辑）
- [ ] 表头列与按钮对齐
- [ ] 5 locale 标签翻译完整
- [ ] aria-label 含活动名（无障碍）
- [ ] L1 PASS（lint + tsc + vitest）
- [ ] staging 实测：/zh/campaigns 列表行点 Match 按钮 → /match?campaignId 工作台

---

### F003: /insight QuickActions 去冗余 "活动" 按钮

**Why：** 现 QuickActions 第 4 按钮 `campaigns → /campaigns`。BL-074 nav 已加 campaigns 一级，QuickActions 再放冗余。

**What：**

1. `src/features/dashboard/QuickActions.tsx` ACTIONS 数组从 4 → 3：

```ts
const ACTIONS: QuickAction[] = [
  { key: "knowledgeBase", href: "/brief?tab=products", icon: "inventory_2", tone: "cyan" },
  { key: "discovery",     href: "/match",              icon: "travel_explore", tone: "cyan-soft" },
  { key: "database",      href: "/match?view=table",   icon: "groups", tone: "purple" },
  // BL-074: removed 'campaigns' QuickAction (now top-level nav)
];
```

2. UI grid: `grid-cols-2 sm:grid-cols-4` → `grid-cols-1 sm:grid-cols-3`

3. `messages/{zh,en,ja,ko,es}.json` `dashboard.quickActions.campaigns` + `campaignsDescription` 保留（不删，避免 i18n test 报漂移；归 deprecated 但兼容；F005 长期可清理）

4. `QuickActions.tsx` TypeScript type `key: "knowledgeBase" | "discovery" | "database"`（删 "campaigns"）

**Acceptance：**
- [ ] QuickActions 渲染 3 按钮（删 campaigns）
- [ ] grid 自适应 1-3 列
- [ ] 类型定义同步缩窄
- [ ] visual baseline regen（/insight dashboard tab 3 按钮）
- [ ] staging 中文模式实测 /zh/insight 默认 tab 显 3 QuickActions

---

### F004: ADR-015 起草 supersedes ADR-013

**Why：** A1 lock A — ADR-015 新建（不原地改 ADR-013），独立追溯。

**What：**

1. 新建 `docs/adr/ADR-015-5-route-ia-add-campaigns-nav.md`：

```markdown
# ADR-015: 5 路由 IA — 加 Campaigns 顶级 Nav

> Supersedes: ADR-013 (AI Native Product Pivot)
> Date: 2026-05-26
> Status: Accepted

## Context
ADR-013 lock 了 4 动词路由 IA（brief / match / reach / insight）作为 ADR-013 AI Native 转向的核心信息架构。BL-073 prod 上线后用户反馈：
> "为活动匹配 KOL 功能，在一级菜单上没有入口，需要在洞察→新建活动→点击一个活动 才可以完成匹配"

营销人员认知中 Campaign 是核心实体，但被 ADR-013 设计藏成二级（sidebar 高亮 path-rewrite 让 /campaigns 假装 match）。

## Decision
NAV_ITEMS 从 4 → 5，加 campaigns 顶级 nav。顺序：brief / campaigns / match / reach / insight（创建后看列表逻辑流）。

## Rationale
- Campaign 是核心实体（用户认知中）
- 4 动词路由 IA 维持主流程线（brief→match→reach→insight）
- campaigns 插 brief 后 match 前 = 自然过渡：brief 创建 → campaigns 列表 → match 匹配
- 不破坏 ADR-013 4 动词路由设计意图，仅加 1 名词实体入口

## Alternatives Considered
- A: /match 顶级加"选活动"picker — 改动小但 UI 重设计复杂
- B（本 ADR 选）: 加第 5 一级 nav campaigns
- C: /campaigns 仅列表行加"Match"快捷不动 nav — 间接，不解决根本问题

## Consequences
- 正面：用户认知直观，campaigns 一级可发现
- 中性：5 nav 比 4 nav 多 1 个 nav 项，但仍小数
- 负面：违反 ADR-013 简洁理念，但加 1 nav 不致命

## Implementation
- NAV_ITEMS 5 条（详 BL-074 F001）
- /campaigns 列表行加 Match KOL 快捷（详 BL-074 F002）
- /insight QuickActions 去冗余（详 BL-074 F003）

## References
- BL-073 issue #3（用户 5/26 反馈）
- BL-073 audit doc §1 #3 + §7
- BL-074 spec / Audit doc
- ADR-013（原 4 动词 IA，被本 ADR superseded）
```

2. `docs/adr/ADR-013-ai-native-product-pivot.md` 顶部加 1 行 marker（不改 body）：

```markdown
# ADR-013: AI Native 产品转向 / Phase 1-4 路线图

> **⚠️ Superseded by ADR-015** (2026-05-26): 加 campaigns 顶级 nav 形成 5 路由 IA。原 4 动词路由设计意图保留，仅在 IA 表面扩展。

[原内容不动 ...]
```

3. `docs/adr/README.md` 索引加 ADR-015 entry + 标 supersedes 关系

**Acceptance：**
- [ ] docs/adr/ADR-015-5-route-ia-add-campaigns-nav.md 新建（≥80 LOC，含 Context/Decision/Rationale/Alternatives/Consequences/References 6 段标准 ADR 格式）
- [ ] ADR-013 顶部加 superseded marker 1 行
- [ ] docs/adr/README.md 索引含 ADR-015 + supersedes 链接
- [ ] grep "ADR-013" 全仓 review 无现行规则与 ADR-015 冲突

---

### F005: e2e nav-bar 测试 + visual baseline regen

**Why：** NAV_ITEMS 4 → 5 影响所有路由 sidebar 渲染，需 e2e 全 nav 测试 + visual baseline 同步 regen。

**What：**

1. `tests/e2e/sidebar-nav.spec.ts`（或现有类似）更新：

```ts
test("sidebar displays 5 top-level nav items in correct order", async ({ page }) => {
  await page.goto("/zh/brief");
  const navItems = page.locator('[data-testid="sidebar-nav-item"]');
  await expect(navItems).toHaveCount(5);
  const labels = await navItems.allTextContents();
  expect(labels[0]).toContain("概要");      // brief
  expect(labels[1]).toContain("活动");      // campaigns NEW
  expect(labels[2]).toContain("匹配");      // match
  expect(labels[3]).toContain("触达");      // reach
  expect(labels[4]).toContain("洞察");      // insight
});

test("clicking campaigns nav navigates to /campaigns", async ({ page }) => { ... });
test("/campaigns/[id] highlights campaigns nav (not match)", async ({ page }) => { ... });
```

2. Visual baseline regen 触发 GitHub Actions `update-visual-baselines.yml` workflow：
   - 4 viewport (Desktop 1920 / Tablet 768 / Mobile 375 / Wide 2560)
   - 5 nav 都 capture
   - 5 locale spot check（zh + en + ja + ko + es）

3. CampaignsTable.tsx 行 Match 按钮 e2e：

```ts
test("/campaigns row Match button jumps to /match?campaignId", async ({ page }) => {
  await page.goto("/zh/campaigns");
  const firstRow = page.locator('[data-testid="campaign-row"]').first();
  const campaignId = await firstRow.getAttribute("data-campaign-id");
  await firstRow.locator('[data-testid="campaign-row-match-kol"]').click();
  await page.waitForURL(new RegExp(`/zh/match\\?campaignId=${campaignId}`));
});
```

**Acceptance：**
- [ ] sidebar-nav.spec.ts 5 nav 顺序测试 PASS
- [ ] campaigns nav 高亮测试 PASS（path-rewrite 改动验证）
- [ ] CampaignsTable Match button e2e PASS
- [ ] visual baseline regen 完成（含 4 viewport × 5 locale spot check sidebar）
- [ ] e2e suite 跑通无 regression

---

### F006: Reviewer L1+L2 抽样验证 + signoff（executor:codex）

**L1 自动化（必跑）：**
1. `npm run lint` PASS（0 error / warning ≤3）
2. `npx tsc --noEmit` PASS
3. `npm test` PASS（含 F005 新增 e2e）
4. NAV_ITEMS 长度 = 5（grep / TypeScript）
5. nav-config.ts:99 path-rewrite 含 `return "campaigns"`
6. messages/zh.json 含 nav.campaigns + nav.campaignsDescription
7. docs/adr/ADR-015 文件 exist + body ≥80 LOC

**L2 staging 抽样实测：**
1. /zh sidebar 5 nav 顺序 + label 正确显示
2. /en + /ja + /ko + /es sidebar 5 nav i18n 显示正确
3. /campaigns 进入时 sidebar 高亮 campaigns nav（不再假装 match）
4. /campaigns/[id] 进入时 sidebar 高亮 campaigns nav
5. /campaigns 列表每行 Match KOL 按钮 click 跳转 /match?campaignId
6. /insight QuickActions 3 按钮（不再 4），无 campaigns 冗余
7. ADR-015 markdown 渲染 OK + ADR-013 superseded marker OK
8. visual baseline 同步无视觉回归

**Acceptance（Reviewer 出 signoff doc）：**
- [ ] L1 7 项 / L2 8 项全 PASS
- [ ] 0 broken cross-reference / 0 visual regression
- [ ] signoff doc `docs/test-reports/BL-074-signoff-2026-05-XX.md`

---

## §5 风险 / 应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| visual baseline regen 大改 5 nav 影响每个 page 截图 | 高 | 中 | F005 单独 commit + 用 update-visual-baselines.yml workflow 一次性 regen 所有 PNG |
| 5 locale 翻译 brand vs literal 不一致（如 es "Campaigns" 复数 brand vs "Campañas" literal） | 中 | 低 | A1 lock A 已定（zh 中文 / en+es 复数 brand 实际 5 locale 看主要 KOL 营销人员理解力） |
| ADR-015 起草耗时超估 | 中 | 低 | ≥80 LOC 6 段标准 ADR 模板已定，参考 ADR-013 / ADR-014 结构（已落地）|
| /campaigns 列表行加按钮影响表头宽度 / 响应式 | 中 | 低 | F002 acceptance 含表头列对齐 + staging 实测 4 viewport |
| e2e nav 测试与现有 sidebar 测试 conflict | 低 | 中 | 复用现有 testid pattern，不新建 |

---

## §6 Done Definition

- [ ] F001-F006 全 acceptance PASS
- [ ] Reviewer L1+L2 全 PASS（signoff doc 终签）
- [ ] progress.json status = done, fix_rounds 记录
- [ ] backlog.json BL-074 entry 移除
- [ ] .auto-memory/project-status.md BL-074 DONE marker

---

## §7 后续批次预告

- **BL-075-kol-data-coverage**: country/language 字段填充（BL-062 起 batch）— 与 BL-074 不冲突域可并行
- **v0.9.24 framework sediment batch**: 9 条积压（BL-072 4 + BL-073 5）inline-merge
