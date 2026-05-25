# BL-072 Prod Hotfix Spec — /brief 宽度 + /insight i18n + Material Symbols + IA outbound stale links

> **Sprint：** BL-072-prod-hotfix
> **Type：** Prod hotfix（铁律 #9）— src/ 业务码修复 + CI/test 防御补强
> **预估工时：** ~20-25h ≈ 3 day Generator + 0.5 day Reviewer
> **关联：** docs/test-reports/BL-072-prod-hotfix-audit-2026-05-25.md（Phase A0 audit + A1 lock 273 LOC）
> **状态：** A0+A1 完成 → 待 building（F001 起点）
> **依赖：** BL-071 done @ commit 99c43fc / tag bl071-done（已满足）

---

## §1 背景与触发

### 1.1 触发

2026-05-25 17:30+ BJT 用户在 prod 实地报告 4 P1/P2 issue（BL-070 done 当日，对外上线 ready 状态）。Planner Kimi 5/25 本会话 grep 全量根因 + 总根因模式分析，写入 audit doc `docs/test-reports/BL-072-prod-hotfix-audit-2026-05-25.md`（273 LOC）。BL-071 framework cleanup 优先（5/25-5/26 完成），现 BL-071 done → BL-072 启 building。

### 1.2 4 Issues 汇总

| # | 症状 | 根因模式 | 文件数 | 严重度 |
|---|---|---|---|---|
| 1 | /brief 宽度 max-w-3xl (768px) vs 其他 3 路由 max-w-[1600px] 视觉不一致 | BL-069 起 /brief 时窄表单审美设计；BL-070 4 路由 IA 统一后**未同步对齐** | 1 | P2 |
| 2 | /insight 中文模式大量英文 | BL-070-F003 实装 /insight 漏 t() wiring（6 处硬编码 + InsightTabs labels prop 未传 + ReportsPanel/AnalyticsPanel zh.json keys 缺） | 3-5 | P1 |
| 3 | /match TABLE_RO 字面文字 | Material Symbols 子集 script Pattern 1-5 不能捕跨行 JSX 三元；BL-066/070 IA refactor 新增 `table_rows` ligature 未追 manifest | 2 | P1 |
| 4 | /insight QuickActions / GreetingBar 等按钮 404 | BL-070-F004 删 5 老路由 + 即停 redirect 但**未 grep 全仓更新 outbound 链接**（10 处残留） | 10 | P1 |

### 1.3 总根因模式（共性反思）

BL-070-F003/F004/F005 IA refactor 大范围结构改动后**缺乏 outbound 一致性扫描**：
- Issue #1 ↔ visual 宽度一致性（4 路由）
- Issue #2 ↔ i18n 消费侧 t() wiring（page.tsx 创建后）
- Issue #3 ↔ Material Symbols 子集 manifest（新增 ligature 时）
- Issue #4 ↔ 路由删除后 outbound 链接

**测试基建漏检共同点：** 4 个 bug 都有现成测试都不命中 —
- visual baseline test 不验跨 4 路由宽度一致性（spec checklist 漏项）
- i18n-locale-coverage test 不验 page-side 消费侧（仅 key parity + value ≠ en）
- material-symbols subset script 不验 woff2 glyph table ⊇ src 提及 ligature
- E2E IA refactor 测入站 redirect 不测 outbound link target

### 1.4 A1 用户 5/25 lock 4 项决策

| 决策 | Lock | 理由 |
|---|---|---|
| **顺序** | C: BL-071 先完后 BL-072 | BL-071 已 done @ bl071-done @ 99c43fc，依赖满足；BL-072 src/ 业务码与 BL-071 framework-only 不冲突域 |
| **范围** | A: 完整版 F001-F008 | 含 i18n 全 audit + Material Symbols Pattern 6 + CI 三向防御；长期收益最大 |
| **i18n 翻译策略** | A: brand kept-en | Insight/Dashboard/Reports/Analytics 全保英文 brand；sidebar.insight="洞察" 与 page heading 双层（nav 本地化 + brand 英文）；test 加 KEEP_AS_EN_PATHS allowlist |
| **stale link 目标** | A: CrmPipelineBars → /crm?status=, kols/[id] → /kols | 语义合理不混路由 |

### 1.5 角色分配

- role_assignments: null（按默认映射）— Claude CLI = planner + generator，Codex = evaluator (Reviewer)
- 用户 5/25 ack 不指定特定 Generator agent

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- /brief 宽度对齐 4 路由（F001）
- /insight i18n wiring 补全 + InsightTabs labels + KEEP_AS_EN_PATHS allowlist + ReportsPanel/AnalyticsPanel 缺 keys 补（F002）
- i18n 全面 audit 修复（/reach + 4 路由嵌入组件 hardcoded English sweep + 5 locale 完善度）（F003）
- Material Symbols `table_rows` manifest 补 + 重生 woff2（F004）
- script Pattern 6 JSX 三元 grep + manifest 维护惯例（F005）
- 10 处 outbound stale link 修复 + i18n key 标签同步（F006）
- CI 防御三件套（link-target audit + Material Symbols glyph 三向断言 + i18n page-side 探针）（F007）
- Reviewer L1+L2 抽样验证 + signoff（F008）

### 2.2 OUT-OF-SCOPE（明示）

- 业务逻辑功能新增 / 修改（仅 outbound 一致性 + i18n + Material Symbols 维度）
- 视觉重设计 / 大幅 UI 调整（仅 brief 宽度对齐 + 4 路由嵌入组件 hardcoded 文案改 i18n key）
- Phase 5 个性化学习 / Brief 模板库 / AI 学到偏好
- ADR 新增（如 F005/F007 防御模式可未来升 ADR-014 outbound 一致性 / CI 三向断言，本批次不做）
- BL-070 post-launch ops（24h audit + ≥5 marketer dogfood） — 已归用户手工待办

### 2.3 不变量 / 铁律

1. **0 业务逻辑改动：** 修 href 目标 / 改 i18n key 调用 / 加 manifest icon / 改 page max-w，**不改任何业务行为**（KOL 推荐算法 / 邮件个性化 / Campaign CRUD 等）
2. **i18n brand kept-en 策略 lock：** Insight / Dashboard / Reports / Analytics 全保英文 brand；新补 keys 加入 KEEP_AS_EN_PATHS allowlist；不与 sidebar 本地化中文冲突
3. **stale link 目标 lock：** CrmPipelineBars → /crm?status=, kols/[id] → /kols（其余 8 处按 audit §6.1 表硬性对应）
4. **5 locale 同步：** F002 + F006 涉及 i18n 改动 5 locale (zh/en/ja/ko/es) 同步翻译
5. **CI 防御不阻塞业务：** F007 三件套 test 作 advisory（warning 优先于 fail），避免 false-positive 拦截合法 PR；如确认稳定后转 strict
6. **Reviewer L1+L2 全 PASS 才 done：** 4 用户可见 bug 修完 + 防御 test 都跑通

---

## §3 实施 Phase 划分（~3 day）

| Phase | 范围 | 工时 | 谁做 | 状态 |
|---|---|---|---|---|
| **A0** | Audit doc + 4 issue 根因分析 | 1 day | Planner Kimi | ✅ done (5/25) |
| **A1** | 用户 lock 4 项决策 | 0.5h | Planner + 用户 | ✅ done (5/25) |
| **B** | F001-F002 user-visible bug 快修 (P1+P2) | 0.5 day | Generator | pending |
| **C** | F004-F005 Material Symbols 修 + script Pattern 6 | 0.5 day | Generator | pending |
| **D** | F006 10 处 outbound stale link + i18n 标签 | 0.5 day | Generator | pending |
| **E** | F003 i18n 全面 audit (4 路由 + 嵌入组件 hardcoded sweep + 5 locale) | 0.5-1 day | Generator | pending |
| **F** | F007 CI 防御三件套 | 0.5-1 day | Generator | pending |
| **G** | F008 Reviewer L1+L2 + signoff | 0.5 day | Codex (Reviewer) | pending |
| **总计** | | ~3 day Generator + 0.5 day Reviewer | | |

**建议 commit 分批：** F001 + F002 一个 commit（user-visible P1+P2 快修，可先 deploy 让用户验）；F004 + F005 + F006 一个 commit（基建 + outbound）；F003 一个 commit（i18n 全 audit 大改）；F007 一个 commit（CI 防御）。

---

## §4 Features 详细描述

### F001: /brief 宽度对齐 4 路由 max-w-[1600px] + form 行宽 spot check

**Why：** Issue #1（audit §3）— BL-069 起 /brief 时窄表单审美设计；BL-070 4 路由 IA 统一后未同步对齐 max-width。

**What：**
1. `src/app/[locale]/(app)/brief/page.tsx:75` 改 `max-w-3xl` → `max-w-[1600px]`，与 /match /reach /insight 对齐
2. 验证两 tab 内表单可读性：
   - `tab=campaign` 默认：CampaignForm 在 1600px 容器下行宽不能变得不可读（form 内部已有 `max-w-2xl` 等约束 — 复查 BriefPageClient/CampaignForm 是否保护宽度）
   - `tab=products`：ProductListPanel 列表，1600px 顺势变宽符合预期
3. 如 CampaignForm 内部无宽度约束，加 `max-w-2xl mx-auto` 给 form 子容器以保护

**Acceptance：**
- [ ] `src/app/[locale]/(app)/brief/page.tsx:75` 改为 `mx-auto max-w-[1600px] space-y-6 pb-16`
- [ ] /brief?tab=campaign 在宽屏 (1600+) 渲染时 CampaignForm 行宽保持可读（不超出 ~720-800px 单字段宽）
- [ ] /brief?tab=products ProductListPanel 在宽屏渲染时填满 1600px 容器
- [ ] 4 路由（brief/match/reach/insight）顶部 header 视觉宽度一致

---

### F002: /insight i18n wiring 补全（page + InsightTabs labels + 缺 keys + 5 locale）

**Why：** Issue #2（audit §4）— BL-070-F003 实装 /insight 漏 t() wiring（4 layer 根因详 audit §4.1-§4.4）。

**What：**
1. `src/app/[locale]/(app)/insight/page.tsx` 改 6 处硬编码英文走 t()：
   - L61 `<h1>Insight</h1>` → `<h1>{t("pageTitle")}</h1>`
   - L64 subtitle → `<p>{t("subtitle")}</p>`
   - L98 ReportsPanel `<h2>Reports</h2>` → `<h2>{t("reports.title")}</h2>`
   - L100 ReportsPanel body → `<p>{t("reports.body")}</p>`
   - L119 AnalyticsPanel `<h2>Analytics</h2>` → `<h2>{t("analytics.title")}</h2>`
   - L121 AnalyticsPanel body → `<p>{t("analytics.body")}</p>`
2. `<InsightTabs locale={locale} activeTab={tab} />` 调用加 labels prop：`labels={{dashboard: t("tabs.dashboard"), reports: t("tabs.reports"), analytics: t("tabs.analytics")}}`
3. `messages/{zh,en,ja,ko,es}.json` `insight` namespace 补 4 新 keys：
   ```json
   "insight": {
     "pageTitle": "Insight",
     "subtitle": "...",
     "tabs": { "dashboard": "...", "reports": "...", "analytics": "..." },
     "reports": {
       "title": "Reports",
       "body": "AI-generated weekly performance reports for your tenant."  // 5 locale 翻译
     },
     "analytics": {
       "title": "Analytics",
       "body": "Phase 5 — coming after the public launch. ..."  // 5 locale 翻译
     }
   }
   ```
4. `tests/unit/i18n-locale-coverage.test.ts` `KEEP_AS_EN_PATHS` allowlist 加 brand kept-en 路径：
   - `insight.pageTitle`
   - `insight.subtitle` (含 brand 词，半英半中可接受)
   - `insight.reports.title`
   - `insight.analytics.title`
   - 注意：tabs.{dashboard,reports,analytics} **不**加白名单（已真翻为"仪表盘/报告/分析"）
5. 5 locale 翻译：title 全保英文 brand；body 按各 locale 真翻

**Acceptance：**
- [ ] /insight page.tsx 6 处硬编码替换为 t() 调用
- [ ] InsightTabs 调用传 labels prop（5 locale 验中文模式下 tab 显"仪表盘/报告/分析"）
- [ ] 5 locale messages JSON 含完整 `insight.reports.{title,body}` + `insight.analytics.{title,body}`
- [ ] KEEP_AS_EN_PATHS allowlist 加 brand kept-en 路径，i18n-locale-coverage 8/8 PASS
- [ ] 中文模式访问 /insight 实测：title="Insight"（brand）、tabs="仪表盘/报告/分析"（中文）、body 段中文显示

---

### F003: i18n 全面 audit 修复（/reach + 4 路由嵌入组件 hardcoded English sweep）

**Why：** Issue #2 audit §4.5 — 4 路由 t() 使用频次 /insight=6 严重偏低，/reach=10 偏低待复查；嵌入组件（DashboardContent / KpiRow / WorkflowSteps 等）t() usage 高但可能仍有 raw English。

**What：**
1. `/reach/page.tsx` 全 grep raw English literal → 凡是用户可见文案的硬编码改 t()
2. /insight 嵌入组件 sweep（位置 src/features/dashboard/）：
   - DashboardContent.tsx
   - KpiRow.tsx
   - WorkflowSteps.tsx
   - QuickActions.tsx
   - GreetingBar.tsx
   - RecentActivityCard.tsx
   - ActiveCampaignsSection.tsx
   - 等
   - 每文件 grep raw English ≥4 char + 排除注释/data-testid/data-state/CSS variant/icon name → 用户可见硬编码 → 改 t()
3. /match 嵌入组件 sweep（src/app/[locale]/(app)/match/）— 复查除 page.tsx 外其他组件
4. /brief 嵌入组件 sweep（src/app/[locale]/(app)/brief/）— 复查
5. 5 locale 完善度 spot check：随机抽 10-15 个 keys 验 zh/ja/ko/es 翻译质量（不全 audit 所有 leaves，仅高频文案）
6. KEEP_AS_EN_PATHS allowlist 增量：每发现真正 brand kept-en 的 key 都加 allowlist

**Acceptance：**
- [ ] /reach + 4 路由嵌入组件 hardcoded English sweep 完成（grep + 改 t()）
- [ ] 中文模式访问 /reach + /insight + /match + /brief 实测：无明显英文露出（除 brand kept-en）
- [ ] 5 locale 翻译质量 spot check 10-15 keys 通过（无明显机器翻译瑕疵）
- [ ] KEEP_AS_EN_PATHS allowlist 完整记录 brand kept-en 路径（连同 F002 累计预期 ~10-15 条）
- [ ] i18n-locale-coverage test 仍 8/8 PASS

---

### F004: Material Symbols `table_rows` 加 manifest + 重生 woff2

**Why：** Issue #3（audit §5）— BL-066/070 IA refactor 新增 `table_rows` 仅出现在 MatchSummaryBar JSX 三元，script Pattern 1-5 漏 + manifest 未追加。

**What：**
1. `scripts/material-symbols-icons-manifest.txt` 追加 1 行：
   ```
   table_rows                  # match/MatchSummaryBar.tsx:98          | JSX ternary (BL-072-F004)
   ```
2. 运行 `bash scripts/regenerate-material-symbols-subset.sh`，重生 `src/app/fonts/material-symbols-outlined.woff2`
3. 验证 woff2 size 略增（预期 11008 → 11200-11500B 加 1 glyph）
4. commit 同时含 manifest 行 + woff2 文件

**Acceptance：**
- [ ] manifest 含 `table_rows` 行（含 path label 与 BL-066/070 IA refactor 后真实路径一致）
- [ ] woff2 重生后含 `table_rows` glyph（fc-list / fontTools 验或 prod 实测 /match view-toggle 显示 icon 而非字面文字）
- [ ] prod 中文/英文模式实测 /match 视图切换按钮 icon 正确渲染（grid_view + table_rows 两态都正常）

---

### F005: 改 regenerate script Pattern 6 JSX 三元 grep + manifest 维护惯例

**Why：** Issue #3 audit §5.5 — script `BL-025-F009 sweep retro` 已警告 Pattern 6/7 false-positive 高所以保 manifest，但 manifest 维护靠人记忆易漏。补 Pattern 6 精确 JSX 三元 grep（含 false-positive 词排除）。

**What：**
1. `scripts/regenerate-material-symbols-subset.sh` 加 Pattern 6:
   ```bash
   # Pattern 6: JSX ternary inside material-symbols-outlined span (新加)
   # 匹配 `material-symbols-outlined` span 上下文 ±5 行内的 quoted string,
   # 经 false-positive 词排除. 反复 review 后转 strict 模式.
   grep -rE 'material-symbols-outlined' src/ -B 2 -A 5 --no-filename \
     | grep -oE '"[a-z_][a-z_0-9]+"' \
     | tr -d '"' \
     | grep -vE '^(true|false|undefined|null|inherit|currentColor|cyan|purple|neutral|sm|md|lg|xl|left|right|top|bottom|center|start|end|grid|swap|email|body|cta|h2|title|truncate|invisible|normal|platforms|card|table|ai_generated|duplicate|offline)$' \
     | sort -u
   ```
   注意：false-positive 排除清单来自本批 F005 实测 audit
2. 文档化 manifest 维护惯例 — 在 `framework/harness/checklists/material-symbols-pattern.md`（BL-071 已移入 subdir）新增 §"manifest 增量维护"：
   - 何时需手工追 manifest：JSX 三元 / 对象 value (非 `icon:` key) / return 语句 / `??` fallback
   - 追 manifest 时必填 path label 含真实 file:line + JSX 三元 / return / etc 类型
   - IA refactor 改名时 manifest path label 同步更新
3. 跑改后的 script 验证：F004 已加的 `table_rows` 被 Pattern 6 自然捕（即便 manifest 不去掉，Pattern 6 也会重复发现）

**Acceptance：**
- [ ] regenerate-material-symbols-subset.sh 含 Pattern 6（注释清晰说明 + false-positive 排除清单）
- [ ] framework/harness/checklists/material-symbols-pattern.md 新增 §"manifest 增量维护" ≥30 LOC
- [ ] script 跑后 ICON_COUNT 至少与原值持平或略增（确认无 regression）
- [ ] Pattern 6 自然发现 `table_rows`（即使 manifest 暂时去掉该行也仍能命中）

---

### F006: 10 处 outbound stale link 修复 + i18n key 标签同步

**Why：** Issue #4（audit §6）— BL-070-F004 删 5 老路由 + 即停 redirect 未 grep 全仓 outbound 链接，10 处残留 404。

**What（按 audit §6.1 表）：**

| # | 文件:行 | 现 | 改 |
|---|---|---|---|
| 1 | `features/dashboard/QuickActions.tsx:22` | `/knowledge-base` | `/brief?tab=products` |
| 2 | `features/dashboard/QuickActions.tsx:23` | `/discovery` | `/match` |
| 3 | `features/dashboard/QuickActions.tsx:24` | `/database` | `/match?view=table` |
| 4 | `features/dashboard/GreetingBar.tsx:29` | `/campaigns/new` | `/brief` |
| 5 | `app/[locale]/(app)/crm/CrmPipelineBars.tsx:55` | `/database?status=` | **`/crm?status=`** (lock A) |
| 6 | `app/[locale]/(app)/insight/weekly-report/WeeklyReportHeader.tsx:100` | `/weekly-report?range=` | `/insight/weekly-report?range=` |
| 7 | `app/[locale]/(app)/insight/weekly-report/WeeklyReportNavSelectors.tsx:57` | `/weekly-report?` | `/insight/weekly-report?` |
| 8 | `app/[locale]/(app)/kols/[id]/page.tsx:157` | `/database` | **`/kols`** (lock A) |
| 9 | `app/[locale]/(app)/campaigns/page.tsx:69` | `/campaigns/new` | `/brief` |
| 10 | `app/[locale]/(app)/campaigns/AiSuggestionsCard.tsx:12` | `/discovery` (fallback) | `/match` |

**i18n 标签同步（QuickActions dashboard.quickActions namespace）：**

| key | 现 zh 值 (估) | 建议改（5 locale 同步） |
|---|---|---|
| `knowledgeBase` | "录入产品" | "管理产品" 或 "产品库" |
| `knowledgeBaseDescription` | (待查) | 对齐新 IA |
| `discovery` | "发现 KOL" | "匹配 KOL" 或保 "Match" brand |
| `discoveryDescription` | (待查) | 对齐 |
| `database` | "KOL 库"/"数据库" (待查) | "KOL 表视图" 或合并入 discovery |
| `databaseDescription` | (待查) | 对齐 |

Generator 实装前需读 `messages/{zh,en,ja,ko,es}.json` 实际值 + spot check sidebar.{brief,match,reach,insight} 已有翻译保持品牌词一致。

**Acceptance：**
- [ ] 10 处 outbound href 全部按 audit §6.1 表修正
- [ ] grep 全仓 active code（非 JSDoc/test/api）残留老路径：`grep -rEn "['\"\\\`]/(knowledge-base|discovery|database|outreach|emails|analytics|dashboard|reports|weekly-report|campaigns/new)" src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__\\|\\.test\\.\\|/api/"` 返 0 命中
- [ ] QuickActions 4 i18n key 标签 5 locale 同步更新（zh/en/ja/ko/es）
- [ ] 中文模式访问 /insight 实测：QuickActions 4 按钮点击全部到达新 IA 路由（不再 404）
- [ ] /campaigns 列表 / GreetingBar "新建活动" / CrmPipelineBars / kols/[id] Back / AiSuggestionsCard CTA 全部 click 不 404

---

### F007: CI / test 防御三件套

**Why：** Issue #1-#4 共性根因（audit §2）— 4 个 bug 都有现成测试但都不命中。F007 补三向防御杜绝同类沉默 ship。

**What：**

#### 7a. Link-target audit test (`tests/unit/link-target-audit.test.ts`)

- 扫 `src/` 所有 `.tsx` `.ts` 文件，提取 `href` 字面字符串（含模板字符串 `\${locale}/...` pattern）
- 抽取 path prefix（去掉 query string + `${var}` 段）
- 比对 `src/app/[locale]/(app)/` 实际路由树 + middleware redirect map（IA_REDIRECT_RULES）
- 凡是不在路由树也不在 redirect map 的 path prefix → fail test 列出 file:line + path
- 第一版 advisory（warning 不 fail），稳定后转 strict

#### 7b. Material Symbols glyph 三向断言 (`tests/unit/material-symbols-coverage.test.ts`)

三向断言（修 audit §5.5 风险）：
- **断言 1：** `src/` 所有 `material-symbols-outlined` 上下文中的 ligature ⊆ manifest（含 Pattern 6 检测）
- **断言 2：** manifest 所有 icon ⊆ 当前 `src/app/fonts/material-symbols-outlined.woff2` 的 glyph 表
- **断言 3：** `src/` 检测到的 ligature ⊆ woff2 glyph 表（end-to-end 保护）
- 含 false-positive 排除清单（与 F005 Pattern 6 同步）
- woff2 glyph 表读取用 `fontkit` 或类似 npm 包

#### 7c. i18n page-side 消费侧探针 (`tests/unit/i18n-page-side-consumption.test.ts`)

- 扫 4 路由 (brief/match/reach/insight) `page.tsx` + 主组件 (`*Client.tsx`, `*Panel.tsx`, `*Bar.tsx` 等)
- grep raw English literal strings ≥4 char 在 JSX text content / attribute value
- 排除：data-testid / data-state / className / icon name / CSS variant / 注释 / metadata title
- 凡命中且不在 KEEP_AS_EN_PATHS allowlist → fail test 列出 file:line + literal
- 第一版 advisory（仅 4 路由 page.tsx），稳定后扩展到嵌入组件

**Acceptance：**
- [ ] 3 个 test 文件创建并通过（advisory 模式跑 PASS）
- [ ] link-target-audit test 跑后报 0 fail（F006 修复全部 10 处后）
- [ ] material-symbols-coverage 三向断言 PASS（F004 加 table_rows 后）
- [ ] i18n-page-side-consumption test 跑后 0 fail（F002 + F003 修复后）
- [ ] CI workflow (`.github/workflows/ci.yml`) 加这 3 个 test job（与现有 vitest 共跑）
- [ ] 后续 PR 触发 3 个 test 防御性运行验证

---

### F008: Reviewer L1+L2 抽样验证 + signoff（executor:codex）

**Why：** 大规模 src/ 修改的最后验证。

**What（Reviewer Codex 执行）：**

**L1 自动化（必跑）：**
1. `npm run lint` PASS
2. `npx tsc --noEmit` PASS
3. `npm test` PASS（含 F007 新增 3 个 test）
4. `grep -rEn "['\"\\\`]/(knowledge-base|discovery|database|outreach|emails|analytics|dashboard|reports|weekly-report|campaigns/new)" src/ --include="*.tsx" --include="*.ts" | grep -v "__tests__\\|\\.test\\.\\|/api/"` 返 0 命中
4. 4 路由 (brief/match/reach/insight) 顶部 header 视觉宽度 inspect：page.tsx 都用 `max-w-[1600px]`
5. Material Symbols subset 含 `table_rows`：`bash scripts/regenerate-material-symbols-subset.sh` 输出含此 icon
6. messages/zh.json 含完整 `insight.reports.{title,body}` + `insight.analytics.{title,body}`

**L2 抽样选读（必跑，6 项）：**
1. 抽 staging /insight 实测：中文模式下 page heading "Insight"（brand kept-en）+ subtitle 含中文描述 + tabs "仪表盘/报告/分析"
2. 抽 staging /match 实测：view-toggle icon 正确渲染（grid_view + table_rows 两态）
3. 抽 staging /brief 实测：宽度与其他 3 路由对齐
4. 抽 staging /insight 实测：QuickActions 4 按钮点击全部到达新 IA 路由不 404
5. 抽 staging /crm 实测：CrmPipelineBars click 到达 `/crm?status=*`
6. 抽 staging /kols/<id> 实测：Back link 到达 `/kols`

**Acceptance（Reviewer 出 signoff doc）：**
- [ ] L1 6 项 / L2 6 项全 PASS
- [ ] 0 broken cross-reference / 0 hardcoded English 在 4 路由 page.tsx / 0 stale link / 0 Material Symbols 字面文字
- [ ] signoff doc `docs/test-reports/BL-072-signoff-2026-05-XX.md` 完整含 L1/L2 结果 + sample 引用 + 终签

---

## §5 风险 / 应对

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| F003 i18n 全 audit sweep 漏组件 / 误改 false-positive | 中 | 中 | grep + 手 review 双重；CI F007c advisory 跑兜底；先 staging dogfood 再 prod deploy |
| F006 修 href 时遗漏其他 stale link（audit 之外） | 低 | 中 | F007a link-target test 强制全仓扫描，audit 之外的也会捕 |
| F007 CI 三件套 false-positive 高拦截合法 PR | 中 | 低 | 第一版 advisory（warning 不 fail）；稳定 1-2 周后转 strict |
| F002 KEEP_AS_EN_PATHS allowlist 加错导致 brand 词意外通过 | 低 | 低 | F008 L2 抽样实测人眼 + 5 locale spot check |
| F004 woff2 重生不通过 CI font diff check | 低 | 低 | manifest commit + woff2 commit 同时入；如 CI 有 font hash check 一并更新 |
| Reviewer 报内容丢失 / 改错路由目标 | 低 | 中 | F008 L2 6 项 staging 实测兜底；audit doc §6.1 表 ↔ F006 acceptance 1-to-1 |

---

## §6 Out-of-Scope（明示）

- Phase 5 个性化学习 / Brief 模板库 / AI 学到偏好 — 后续批次
- BL-062 KOL data coverage gap 治理 — 后续批次
- 真客户 onboarding 准备（db:seed / tenant cleanup / 监控仪表板）— 后续批次
- BL-070 post-launch ops（24h audit + ≥5 marketer dogfood）— 用户手工待办
- ADR-014 outbound 一致性扫描 / CI 三向断言模式 — F005/F007 沉淀够用后未来评估 ADR

---

## §7 Done Definition

- [ ] F001-F008 全部 acceptance PASS
- [ ] Reviewer L1+L2 全 PASS（signoff doc 终签）
- [ ] progress.json status = done, fix_rounds 记录（预期 0-1 轮）
- [ ] 4 用户报告 issue 在 staging dogfood + prod 复测全部解除
- [ ] CI 3 个新 test 跑通且不阻塞合法 PR
- [ ] backlog.json BL-072 entry 移除
- [ ] .auto-memory/project-status.md BL-072 DONE marker 覆盖写
- [ ] 4 条沉淀候选追加到 framework/proposed-learnings.md（done 阶段或后续 sediment batch 处理）：
  1. IA refactor outbound 一致性扫描清单（4 维度合并）
  2. subset script Pattern 6 JSX 三元 grep 模板
  3. i18n 消费侧 test 探针缺失 + 修复模式
  4. 删路由前必须 grep 全仓 outbound 链接（与 BL-070 #19 i18n callers 同主题合并）

---

## §8 后续批次预告（信息性）

- Phase 5（个性化学习）：Brief 模板库 / comparative query / skip-replace 写 DB / AI 学到偏好
- BL-062：KOL data coverage gap 治理
- 真客户 onboarding 准备
- 框架沉淀 v0.9.24：BL-072 4 条候选 inline-merge（与未来批次 sediment 合并）
