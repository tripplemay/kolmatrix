---
name: MVP-visual-fidelity-hotfix
description: 跨 BM1 + BM2 的 UI 还原度修复 + 公共组件库抽取 hotfix 批次（C 档 pixel perfect）
status: draft
created_by: johnsong (Planner)
created_at: 2026-04-24
---

# MVP-visual-fidelity — UI 还原度 + 组件库 Hotfix

## 1. 背景与目标

BM1 签收后用户发现 `/discovery` `/database` 与 Stitch 原型差异大（Planner 审计 6/10 还原度），Planner spot audit 确认 BM2 F003/F005 已重演。根因：

1. Generator 把"装饰性 UI"（KPI 卡 / Insights Panel / AI CTA / Bulk Action Bar 等）当 MVP 可删除项，**不是**可 CRUD 核心
2. 大量手写 className 抄 Stitch HTML，不复用 `@/components/common/*` 或 `@/components/ui/*`
3. 签收流程漏洞让 visual regression baseline PNG 缺失也判 PASS

本批次目标：**一次性修完 BM1 + BM2 已实现的 5 页，顺便抽公共组件库，为 MVP 上线做视觉基线完整性保障。**

完整调查：`docs/test-reports/BM1-BM2-ui-fidelity-audit-2026-04-24.md`
Guardrail 源：`framework/harness/ui-fidelity-guardrail.md`

## 2. 范围

### In Scope

1. **F001** — 公共组件库抽取：`<Button>` / `<Input>` / `<Select>` / `<Dialog>` / `<Table>` / `<StatCard>` / `<ChipButton>` / `<StatusBadge>`（基于 Stitch 通用视觉）
2. **F002** — `/discovery` 重写 + 原型元素恢复（主搜索区 / AI Smart Match CTA / Active Filter chips / Grid/List toggle / 列数 4 回归）
3. **F003** — `/database` 重写 + 原型元素恢复（Insights Panel / Quick Stats / Bulk Action Bar 接真功能 / 7 维过滤）
4. **F004** — `/campaigns` 列表重写 + KPI strip / filter 维度补齐 / AI Suggestions panel
5. **F005** — `/campaigns/:id` 详情重写 + 2-column layout 右侧 Insights 窄列 / Email Performance chart / AI Suggestions / Activity Timeline
6. **F006** — `/kols/[id]` 画像页轻度改写（手写 className → 公共组件，TabKey 枚举保留）
7. **F007** — Visual regression baselines 统一生成 + 入 git（6 页 × en locale = 6 PNG）+ CI integration

### Out of Scope

- `/knowledge-base` 重写（F003 本批次审计未深入，沿用当前实现）
- `/` dashboard 重写（F007 已是对照组做对了）
- `/campaigns/new`（F004 小表单 🟢 OK）
- BM2 F006-F010 尚未实现的页面（已通过 BM2 §2.5 guardrail 前置约束，开工即按新规）
- Stitch 原型自身的 bug / 设计漂移修复（若发现 Stitch bug 登记到 backlog 另起）
- 图标、色板、字体族的全局更新（属设计系统 polish，独立批次）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 抽取公共组件的粒度 | **中粒度**：原子组件（Button/Input）+ 组合组件（Dialog/Table/StatCard）；不做页面级组合（如 `<KolSearchBar>` 保留页内）| 页面级组合跨页复用少；原子 + 小组合覆盖 80% 场景 |
| 组件命名空间 | `src/components/ui/` = 无业务语义原子（Button/Input/Dialog/Table...）；`src/components/common/` = 含业务语义组合（KolCard/StatCard/CampaignStatusBadge...） | 对齐 shadcn/ui 惯例 + B0 现有 |
| 原型"装饰性元素"的基线 | **全部实现**（不再允许 MVP 简化）| 用户反馈明确：客户看的是"像不像成熟产品"，不是 MVP scope |
| 幽灵控件处理 | 全部 disabled + tooltip `Coming soon`（BM2 阶段才接功能的元素）或完全隐藏 | 不得保留 active 但无 handler 的控件 |
| 重写 vs diff 修 | F002-F006 采取 **重写** 而非 incremental patch | incremental 会留历史 className 债；重写一次到位 |
| 代码风格 | 所有 UI 文件 `className="..."` 硬编码 ≤ 20 处/文件；超过考虑抽组件 | guardrail §4.3 阈值 |
| Baseline PNG 生成环境 | VPS 或 CI（Linux + Playwright system libs 就绪）| BM1 F009 踩坑：本地 WSL 无 sudo 不能装 deps |
| Stitch 参考时序 | Generator 开工前必须并排打开 Stitch HTML + 当前实现 + 组件库清单 | 避免凭印象还原 |
| 测试覆盖 | 每页 E2E + unit（已被 guardrail 的 F009/F011 教训覆盖，本批次重用 BM1 + BM2 已有 E2E 不重写）| 节省时间；重写的是 UI，交互逻辑不动 |
| i18n | 本批次不扩语言，仅改视觉；现有 en/zh/ja/ko/es 字段保持 | 纯 UI 修，无新文案（如需新字段单独登记）|
| 回归风险 | 所有 UI 行为保持不变（Server Actions / API / 路由均不改）；只改 RSC 渲染 + 组件结构 | 降低 regression 面，Reviewer L2 主要对视觉 |

## 4. 功能列表（7 项，全 executor:generator）

### F001 — 公共组件库抽取

**⚠️ 状态更新（2026-04-24）：本 feature 已提前完成于 BM2 F006 前置工作。**
- Generator 2026-04-24 在 BM2 F005 完成后、F006 开工前越界提前做了本批次 F001 范围（7 新原子组件 + 2 业务组件），Planner 事后裁决同意（详见 `docs/specs/hotfix-f001-component-library-preimpl-audit.md` §8）
- 归属 BM2 F006 前置依赖，**不计入本 hotfix 的 completed_features**（本 hotfix 开工时 F001 仍标 "pending" 作为 placeholder，Generator 简短确认组件库存在即完成）
- F001 本批次剩余工时降至 ~30min（barrel exports 微调 / README.md 文档）

**实现（原计划，已落地参考）：**

新建 `src/components/ui/` 下 7 个原子组件 + `src/components/common/` 补 2 个业务组件：

```
src/components/ui/
├── Button.tsx         — variants: primary-gradient / secondary / ghost / danger / chip
├── Input.tsx          — 统一 h-10 rounded-lg border，含 Label + FieldError helpers
├── Select.tsx         — 同 style 的 native select 封装
├── Dialog.tsx         — 基于 Headless UI 或 Radix，含 Portal / Overlay / Content / Close
├── Table.tsx          — <Table> <THead> <TBody> <TRow> <TCell> 复合；支持 stickyHeader
├── Checkbox.tsx       — 含 indeterminate 状态（Bulk Action 要用）
└── index.ts           — re-export
```

```
src/components/common/
├── StatCard.tsx       — KPI 卡（title + value + delta + icon），Dashboard F007 已有原型，提升为公共
├── ChipButton.tsx     — filter chip（on/off 可切换）
├── StatusBadge.tsx    — 状态 badge（Campaign status / KOL relationshipStatus / EmailLog status 通用）
└── index.ts
```

**关键实现点：**
- `<Button variant="primary-gradient">` 对应 `.gradient-cta` class；其他 variant 对应 Stitch 通用按钮色
- `<Dialog>` API：`<Dialog open onOpenChange={...}><DialogHeader><DialogContent><DialogFooter></Dialog>`
- `<Table stickyHeader>` 让表头滚动时粘顶
- `<StatCard>` 接受 `delta={ value: "+12.4k", trend: "up" }` 自动渲染增长指标

**迁移 shim**：保留现有 `src/components/common/` 其他组件（KolCard / GlassPanel / SectionHeader / GhostButton 等）不动，F002-F006 继续 import 它们。

**Acceptance：**
- `src/components/ui/*.tsx` 7 文件全部存在 + 导出
- Each component has variants tested in `tests/unit/ui-components.test.tsx`（render snapshot）
- Storybook 或 MDX 文档可选（如无则 README.md 描述每个组件 props）
- `import { Button } from '@/components/ui'` 可用

### F002 — `/discovery` 重写（恢复原型元素 + 用新组件库）

**实现：**

重写 `src/app/[locale]/(app)/discovery/page.tsx` + `FilterSidebar.tsx` + `KolResultCard.tsx`，对照 Stitch `kol-discovery.html` 逐元素还原。

**原型参考：** `design-draft/stitch-references/kol-discovery.html`（浏览器打开为主；同目录 .png 仅 512px 缩略索引，不做像素对比）

**必用公共组件：**
- `<GlassPanel>` for 所有容器
- `<Button variant="primary-gradient">` for AI Smart Match CTA
- `<Button variant="secondary">` for Save all / view toggle
- `<Input>` + `<Select>` for filter form
- `<ChipButton>` for filter chips + Active Filter chips
- `<SectionHeader>` for section titles
- `<KolResultCard>`（本页专用组件，保留在 page 目录）

**不得简化的元素**（恢复清单）：
- [x] 主搜索区：顶部 glass-panel 含 platform selector + search input + AI Chips 轮转示例
- [x] AI Smart Match gradient CTA 按钮（右上角）
- [x] Active Filter chips（结果区顶部，可点击清除单个 filter）
- [x] Grid/List 视图 toggle（结果区右上，2 icon buttons）
- [x] 结果卡片列数：`xl:grid-cols-4`（回归，不是 3）
- [x] Avatar 尺寸：回归小号（`w-10 h-10` 或原型尺寸）

**幽灵控件**：无（原型的每个控件都有功能或明示 disabled）

**Visual baseline：** `tests/screenshots/baseline/en-discovery.png` 入 git（F007 统一跑）

**Acceptance：**
- 所有"不得简化的元素"清单项勾选（Reviewer 两浏览器窗口并排：左 `kol-discovery.html` / 右 staging `/en/discovery`；**不用 PNG**，PNG 是 512px 缩略图看不清细节，per `framework/harness/ui-fidelity-guardrail.md` §1.1）
- 15 维 filter 功能保持（沿用现有 FilterSidebar.tsx 搬到新 Input/Select/ChipButton 组件；不破坏 URL-driven GET form）
- cursor pagination 不变（沿用现有 runDiscoverySearch）
- L2 staging 登录后 `/en/discovery` 对照 Stitch HTML（浏览器渲染）还原度 ≥ 9/10
- `tests/e2e/discovery-fidelity.spec.ts` 新增 case：prototype 标志元素 visible（AI Smart Match button / 主搜索区 / Active Filter chip）

### F003 — `/database` 重写

**实现：**

重写 `src/app/[locale]/(app)/database/page.tsx` + `DatabaseFilterBar.tsx`，对照 Stitch `kol-database.html`。

**原型参考：** `design-draft/stitch-references/kol-database.html`（浏览器打开为主；同目录 .png 仅 512px 缩略索引，不做像素对比）

**必用公共组件：**
- `<Table stickyHeader>` + `<TRow>` + `<TCell>`（替代手写 Th/Td inline 函数）
- `<Checkbox>` for 行选择 + header 全选（支持 indeterminate）
- `<StatCard>` × 4 for Quick Stats
- `<StatusBadge>` for KOL relationshipStatus
- `<Button variant="danger|primary">` for Bulk Action Bar 按钮
- `<Select>` for filter bar dropdowns
- `<Dialog>` for "Add to Campaign" modal（Bulk Action 用）

**不得简化的元素**：
- [x] Quick Stats 4 KPI strip（Total KOLs / Active Collabs / Avg AI Score / Follower Reach）顶部
- [x] Right-side Insights Panel 320px 固定列：
  - AI Intelligence Card（含相关度评分建议）
  - Coverage Gap Card（类目/地区覆盖缺口）
  - Engagement Trend Card（7 天互动率趋势）
- [x] Bulk Action Bar：选中行后底部浮动，3 actions（Add to Campaign / Email（disabled Coming soon in BM1）/ Delete with confirm）
- [x] 过滤维度补齐到 7：Search + Category + Region + Status + Tier + Game + Tags
- [x] 表格增长指标 `+12.4k`（followers 列内联显示）

**幽灵控件处理**：
- "Email" bulk action button → **disabled + tooltip "Coming with /outreach (BM2 F006)"**（因 BM2 F006 还没做，真功能未就绪）
- "Add to Campaign" bulk action → **真功能**（Dialog 选 Campaign + 批量 upsert KolCampaign）

**Acceptance：**
- 所有"不得简化"清单勾选
- Bulk Action Bar：选中 3 个 KOL → "Add to Campaign" → Dialog → 选 campaign → 批量写入 KolCampaign（status=pending）
- Insights Panel 3 卡 pure UI（数据计算可用 mock / MVP 阶段 Coverage Gap 可硬编"No data yet, coming in B6"）
- `tests/integration/database-bulk-action.test.ts` Add to Campaign 批量 + RLS 隔离
- `tests/e2e/database-fidelity.spec.ts` prototype 标志元素 visible

### F004 — `/campaigns` 列表重写

**实现：**

重写 `src/app/[locale]/(app)/campaigns/page.tsx` + `CampaignsFilterBar.tsx`。

**原型参考：** `design-draft/stitch-references/campaigns-list.html`（浏览器打开为主；同目录 .png 仅 512px 缩略索引，不做像素对比）

**必用公共组件：**
- `<StatCard>` × 4 for KPI strip
- `<Table>` + `<TRow>` + `<TCell>`
- `<ChipButton>` for status filter chips（多选）
- `<Select>` for Game / Region / Owner / Date dropdowns
- `<StatusBadge>` for Campaign.status
- `<Button>` for "新建 Campaign" 主 CTA

**不得简化的元素**：
- [x] Top KPI strip 4 cards（Active Campaigns / KOLs in Pipeline / Avg Reply Rate (hardcoded "—" MVP) / Reach Forecast (计算 Σ KolCampaign + KOL followers)）
- [x] Status filter chips：All / Active / Draft / Paused / Completed（多选 tab-like chips，不是单选 dropdown）
- [x] 附加 filter：Game / Region / Owner / Date range（4 dropdowns）
- [x] AI Suggestions panel（左下角小卡片，MVP 硬编"Suggest matching KOLs - Coming in /discovery"跳转）

**幽灵控件处理**：
- Owner filter（若无多用户 MVP）→ disabled tooltip "Solo tenant mode"
- Date range → 真功能

**Acceptance：**
- KPI strip 4 卡 render 正确（Active count 从 DB 真查，Reply Rate 硬编 "—" 直到 BM2 F006 done）
- 7 filter 维度全部工作（status chips multi-select + 4 dropdown）
- AI Suggestions 卡片可点跳 /discovery
- Visual baseline + E2E 同 F002

### F005 — `/campaigns/:id` 详情重写

**实现：**

重写 `src/app/[locale]/(app)/campaigns/[id]/page.tsx` + 5 子组件。

**原型参考：** `design-draft/stitch-references/campaign-detail.html`（浏览器打开为主；同目录 .png 仅 512px 缩略索引，不做像素对比）

**必用公共组件：**
- `<GlassPanel>` + `<SectionHeader>`
- `<StatCard>` × 4 for Header KPI
- `<Table>` + `<TRow>` for KOL Panel
- `<Dialog>` for "Add KOL" modal（替换 CampaignKolPanel 手写 modal）
- `<Button>` variants for all CTAs
- `<StatusBadge>` for Campaign / KolCampaign status
- `<Select>` for contactStatus dropdown per row

**布局**：
```
┌────────────────────────────────────────────────────┬──────────────┐
│  Section 1: Header (name + status + 4 KPI)         │              │
├────────────────────────────────────────────────────┤  Right       │
│  Section 2: KOL Panel (table + Add KOL Dialog)     │  Insights    │
├────────────────────────────────────────────────────┤  320px       │
│  Section 3: Email Performance chart (recharts)     │              │
├────────────────────────────────────────────────────┤              │
│  Section 4: Revenue Recorder + Status Controller   │              │
└────────────────────────────────────────────────────┴──────────────┘
```

**不得简化的元素**：
- [x] 2-column grid layout（主内容 + 右 320px 固定列）
- [x] Email Performance chart（recharts line chart，显示本 campaign 所有 KolCampaign 的 contactedAt 时序；MVP 无 webhook 所以只看 sent count）
- [x] 右侧 Insights 窄列三卡：
  - Campaign Health（spend rate / revenue vs budget / days to closeout 倒计时）
  - AI Suggestions（硬编 "Next steps: Send to 3 uncontacted KOLs" with link）
  - Recent Activity Timeline（audit_log 最近 10 条本 campaign 事件）
- [x] Add KOL Dialog 用公共 `<Dialog>`（替换 495 行手写 modal）

**幽灵控件处理**：
- AI Suggestions "Run AI match" 按钮 → disabled tooltip "B2 batch" （MVP 不做 AI 匹配）

**Acceptance：**
- 右侧 Insights 3 卡 render（Campaign Health 真数据 + AI Suggestions 静态文本 + Activity Timeline 从 audit_log）
- Email Performance chart 显示 contactedAt/repliedAt 时序（若无邮件发送则显示空态）
- Add KOL Dialog 用新 `<Dialog>` 组件，功能不变（从 Kol.isSaved=true 选）
- CampaignKolPanel.tsx 行数从 495 降至 ~200-250（抽走 modal + 表格到公共组件）
- Visual baseline + E2E

### F006 — `/kols/[id]` 画像页轻度改写

**实现：**

`src/app/[locale]/(app)/kols/[id]/page.tsx` 轻度改写：

- 手写 TabKey 枚举保留（tab 切换逻辑良好）
- 手写 className 密度 > 20 的部分改用 `<Button>` / `<StatusBadge>` / `<GlassPanel>`
- 4 tabs 中 Overview 真数据保持；Collabs / Contacts / AI 3 个 tab empty-state 补友好提示（不实现 MVP 外功能）

**原型参考：** `design-draft/stitch-references/kol-detail.html`（浏览器打开为主；同目录 .png 仅 512px 缩略索引，不做像素对比；F006 本次只处理公共组件替换不全量重写）

**必用公共组件：**
- `<Button>` / `<StatusBadge>` / `<GlassPanel>` / `<SectionHeader>`

**不得简化的元素**：（无新增，本页 BM1 已基本对齐，只抽组件）

**Acceptance：**
- className 硬编码密度降到 <20/file
- Tab 切换行为不变
- Visual baseline `en-kols-detail.png`（静态 URL kols/demo-kol-001）

### F007 — Visual regression baselines 统一生成 + CI

**实现：**

1. 在 VPS（staging 或 prod 都可，Linux + deps 就绪）跑：
   ```bash
   ssh tripplezhou@34.180.93.185
   cd /opt/kolmatrix-staging
   npx playwright test --update-snapshots tests/e2e/visual-regression.spec.ts
   git add tests/screenshots/baseline/*.png
   git commit -m "chore(visual): baseline PNG for BM1+BM2 6 UI pages"
   git push origin main
   ```

2. 6 张 baseline PNG：
   - `en-discovery.png`（F002 产出）
   - `en-database.png`（F003 产出）
   - `en-campaigns.png`（F004 产出）
   - `en-campaign-detail.png`（F005 产出；登录态 marketer 打开 demo campaign）
   - `en-kols-detail.png`（F006 产出）
   - `en-dashboard.png`（重捕，因 F001 抽 StatCard 影响 dashboard）

3. CI workflow `.github/workflows/ci.yml` 的 visual-regression job 启用（之前 BM1 F009 scaffold 存在但 skip）：
   - 在 PR 上跑 visual test，diff > 0.1 触发 fail
   - Baseline PNG 修改时 PR 标 `visual-baseline-update` label 要求 Reviewer 二次确认

**Acceptance：**
- `ls -la tests/screenshots/baseline/en-*.png` 至少 6 个 PNG
- `git ls-files tests/screenshots/baseline/*.png` 非空
- CI visual-regression job 不再 skip，在 PR 上真跑
- `tests/e2e/visual-regression.spec.ts` 取消所有 `.skip`
- `ssh vps 'cd /opt/kolmatrix && git ls-files tests/screenshots/baseline/*.png' | wc -l` ≥ 6

## 5. 依赖关系

```
F001 (公共组件库)
  │
  ├── F002 (/discovery 重写)
  ├── F003 (/database 重写)
  ├── F004 (/campaigns 重写)
  ├── F005 (/campaigns/:id 重写)
  └── F006 (/kols/[id] 改写)
       │
       └── F007 (baseline PNG 生成)
```

**强依赖：** F001 → all（组件库先就位才能重写 5 页）；F002-F006 并行可能（无相互依赖，但 Generator 单线程推进串行做）；F007 最后

**推荐顺序：** F001 → F002 → F003 → F004 → F005 → F006 → F007

## 6. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| F001 组件库 API 设计不当导致 F002-F006 返工 | 高 | F001 开工前 Generator 写组件 API 草案，Planner 批准后再写实现 |
| 重写中误改 Server Action / API 行为 | 中 | 每页重写前跑现有 E2E 一遍作对照（pass）；改完再跑（仍 pass）则视为无 regression |
| Playwright baseline 在不同 VPS 容器 CPU / 字体 render 产生 diff | 中 | Baseline 在固定 VPS 生成（staging），CI 用同镜像；固定 viewport + font |
| 组件抽得太细导致 props 膨胀 | 低 | F001 阶段每个组件 props ≤ 8 个；超过则合 variant 参数 |
| i18n 字段名与新组件冲突 | 低 | 本批次纯 UI 不动 i18n messages/*.json；若 F002-F006 有新字段必须显式加 |
| MVP 时间线压力 | 高 | 本批次 5-6 天 + BM2 剩余 8-10 天 = MVP 上线推迟 ~1 周（~2026-05-22）；用户已接受 |
| hotfix 与 BM2 同一 Generator 上下文切换 | 中 | 必须 BM2 done 后开工（不并行），Generator 不上下文切换 |

## 7. 验收方式（Evaluator 阶段）

### L1 自动化
- `npm run test:coverage` + `test:integration` + `test:e2e` 全绿
- `npm run lint` + `npx tsc --noEmit` 无错
- F001 组件 unit test 全绿
- Visual regression CI job 在 PR 触发真跑（不再 skip）

### L2 功能验证（staging，强制）

前置：`bash /opt/kolmatrix-staging/infrastructure/deploy-staging.sh`（若 BL-004 BI5 批次已完成）或手动 runbook §5 流程

按 5 页逐个验收：

**/discovery：**
- 登录 marketer@kolmatrix.local → `/en/discovery`
- 对比 Stitch `kol-discovery.png` 并排截图
- 清单核对：主搜索区 + AI Smart Match CTA + Active Filter chips + Grid/List toggle + 4 列网格 + Avatar 尺寸
- 15 维 filter 任选 3 组合查询正常返回

**/database：**
- `/en/database`
- Quick Stats 4 KPI 显示 + Insights Panel 3 卡 render + Bulk Action Bar（选 3 个 KOL → Add to Campaign → Dialog → 批量写入）
- Email bulk action 按钮 disabled + tooltip "Coming with /outreach"

**/campaigns：**
- `/en/campaigns`
- KPI strip 4 卡 + 7 filter 维度 + AI Suggestions 卡片跳 /discovery

**/campaigns/:id：**
- 登录后打开 demo campaign
- 2-column layout（主内容 + 右 320px Insights）
- Email Performance chart + Campaign Health + Recent Activity Timeline 3 卡
- Add KOL Dialog 弹层 + Kol.isSaved=true 下拉选 + 批量/单选写入

**/kols/[id]：**
- 打开 demo-kol-001
- Tab 切换正常
- className 密度降

### L3 视觉
- 6 张 baseline PNG 入 git
- `ssh vps 'git ls-files tests/screenshots/baseline/*.png' | wc -l` ≥ 6
- CI visual-regression job 绿（PR diff = 0）
- Stitch 原型还原度评级 ≥ 🟢 pixel-perfect 或 ≥ 🟡 可接受（Reviewer 两浏览器窗口并排：左 HTML 原型 / 右 staging 登录态，同分辨率对比；**不使用 PNG 做像素判断**）

### L4 埋点（本批次无新埋点）

### UI Fidelity Guardrail 硬要求核对

按 `framework/harness/ui-fidelity-guardrail.md` §4：
- [x] §4.1 baseline PNG in git（F007 产出后核）
- [x] §4.2 "不得简化"清单逐项（每页核）
- [x] §4.3 复用核查（`grep -rn 'className="' src/app/[locale]/\(app\)/{discovery,database,campaigns,kols}/` 单文件 < 20 处）
- [x] 幽灵控件检查（grep checkbox/select/button 手动核 handler 存在）

## 8. 引用文档

- `docs/test-reports/BM1-BM2-ui-fidelity-audit-2026-04-24.md`（审计原文）
- `framework/harness/ui-fidelity-guardrail.md`（硬要求源）
- `.auto-memory/role-context/evaluator.md` §UI Fidelity（签收条款）
- `design-draft/stitch-references/kol-discovery.html` `kol-database.html` `campaigns-list.html` `campaign-detail.html` `kol-detail.html`
- `docs/adr/ADR-003-pixel-perfect-visual-standard.md`（早期视觉标准，本批次实际落地兑现）
- `docs/adr/ADR-004-f010-component-library-lock.md`（组件库锁定 ADR，本批次扩展）

## 9. 启动检查清单（Generator 开工前）

- [ ] BM2 已 done 或 verifying PASS（不得并行）
- [ ] 读 `framework/harness/ui-fidelity-guardrail.md` 全文
- [ ] 读 `docs/test-reports/BM1-BM2-ui-fidelity-audit-2026-04-24.md` 五页 gap 清单
- [ ] F001 开工前 Generator 写组件 API 草案（`.d.ts` 或 README）给 Planner 批准再实现
- [ ] F002-F006 每页开工前跑现有 E2E 一遍作 regression baseline
- [ ] F007 在 VPS 跑 baseline 而非本地 WSL（避免 playwright deps 问题）

## 10. 估时

| 环节 | 预估 |
|---|---|
| F001 组件库（7+2=9 组件 + tests） | ~1.5 day |
| F002 /discovery 重写 | ~0.5-1 day |
| F003 /database 重写（bulk action 较重） | ~1 day |
| F004 /campaigns 列表 | ~0.5-1 day |
| F005 /campaigns/:id 详情（2-col + charts） | ~1-1.5 day |
| F006 /kols/[id] 轻度 | ~0.5 day |
| F007 baseline + CI | ~0.5 day |
| **总计** | **~5.5-6 day** |

## 11. 与 MVP 时间线关系

| 批次 | 估时 | 累计 |
|---|---|---|
| BM2（running） | 8-12 day | ~2026-05-05 |
| MVP-visual-fidelity（本批次） | 5-6 day | ~2026-05-11 |
| 种子用户 demo 准备（用户自测 + 手动 smoke） | 2-3 day | ~2026-05-14 |
| **MVP 正式可上线** | — | **~2026-05-14（比原估 2026-05-15 早 1 天）** |

实际略早于原计划，因为本批次把 BM1 polish 统一做掉，避免后续碎片返工。

---

**Spec 状态：** draft（2026-04-24 Planner 起草，BM2 done 后切 planning → building）
