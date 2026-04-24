# BM1 + BM2 UI Fidelity Audit — 2026-04-24

> **状态：** 调查报告（Planner 归档）
> **触发：** 用户 2026-04-24 反馈 prod 上 `/discovery` `/database` 与 Stitch 原型差异大
> **调查人：** johnsong (Planner)
> **范围：** BM1 已签收的 5 UI 页面（signoff `a8ca629`）+ BM2 已完成的 3 UI 页面（building 中）

## 执行摘要

**BM1 F004 (Discovery) / F005 (Database) 严重重演原型简化问题；BM2 F003 (Campaigns 列表) / F005 (Campaign 详情) 已重演。Generator 形成了"看到装饰性高级 UI 就简化/删除"的稳定模式，而非严格按原型实现。签收流程有漏洞（visual regression baseline PNG 未入库也被 Reviewer 放行）。**

| 页面 | 批次 | 原型还原度 | 公共组件复用 | 严重 gap 数 |
|---|---|---|---|---|
| `/discovery` | BM1 F004 | 🔴 6/10 | ~35% | 4（主搜索区 / AI Smart Match CTA / Active filters / Grid-List toggle） |
| `/database` | BM1 F005 | 🔴 5/10 | ~30% | 5（Insights panel / Quick Stats / Bulk Action Bar / 7→4 filter / checkbox 幽灵控件） |
| `/campaigns` | BM2 F003 | 🟡 7/10 | ~45% | 3（KPI strip / filter 6→2 / AI Suggestions panel） |
| `/campaigns/new` | BM2 F004 | 🟢 9/10 | n/a（小表单自包含） | 0 |
| `/campaigns/:id` | BM2 F005 | 🟡 7/10 | ~40% | 3（Email Performance chart / AI Suggestions / Activity Timeline 缺失 + 无右侧 insights 布局） |
| `/knowledge-base` | BM1 F003 | ~7/10（未深审） | ~50% | 未深入，dashboard 模板中等复用 |
| `/kols/[id]` | BM1 F006 | 🟡 6/10（未深审） | ~30% | 手写 TabKey 枚举 + className 硬编码 |
| `/` dashboard | BM1 F007 | 🟢 8/10 | ✅ 良好 | 0（对照组，做对了）|

## 1. BM1 Discovery (`/discovery`) 详细 gap

### 🔴 严重差异（影响 UX）

1. **主搜索区完全缺失**
   - 原型 `kol-discovery.html` 第 ~120-180 行：Platform 选择 + search input + AI Chips 轮转示例（3 个动态推荐查询）组成 `<div class="mb-8 glass-panel">`
   - 实现 `page.tsx` 第 43-85 行：仅 sort dropdown + disabled "Save all" 按钮
   - **用户无法在页面顶部进行主搜索**

2. **AI Smart Match CTA 缺失**
   - 原型：右上角 gradient button "AI Smart Match"（cyan gradient + icon + shadow）
   - 实现：完全删除，替换为 disabled "Save all"
   - **关键 AI 入口没了**

3. **Active Filter 可视化缺失**
   - 原型：结果区顶部 badge chips 展示已激活 filter，可点击清除
   - 实现：仅纯文本 "Count: N"
   - **用户看不到自己选了什么 filter**

4. **Grid/List 视图切换缺失**
   - 原型：结果区右上 toggle（两 icon button）
   - 实现：仅 grid 视图，无 toggle

### 🟡 中度差异

- 卡片列数 `xl:grid-cols-4` → `xl:grid-cols-3`（宽屏浪费 25% 水平空间）
- Avatar 尺寸 → 放大 4 倍（信息密度下降）
- Value score badge 位置微调

### 正确做的（对照好）
- Filter sidebar 15 维完整实现 ✅
- AppShellLayout canonical 复用 ✅
- Cursor pagination ✅

## 2. BM1 Database (`/database`) 详细 gap

### 🔴 严重差异

1. **右侧 Insights Panel 完全缺失**
   - 原型 `kol-database.html` 第 394-441 行：3 卡片（AI Intelligence / Coverage Gap / Engagement Trend）占右侧 320px 固定列
   - 实现：完全删除，主内容占满全宽
   - **失去实时洞察 + 行动建议上下文**

2. **Quick Stats 4 KPI 卡片缺失**
   - 原型：顶部 grid-cols-4（Total KOLs / Active Collabs / Avg AI Score / Follower Reach）
   - 实现：完全缺失
   - **库规模概览没有**

3. **Bulk Action Bar 缺失（幽灵控件问题）**
   - 原型：选中行后底部浮动条激活（3 action buttons: Add to Campaign / Email / Delete）
   - 实现：表格头有 checkbox 但**选中后无任何反应**
   - **幽灵控件：更差的 UX，因为让用户以为能操作**

4. **过滤维度 7 → 4**
   - 原型：Platform / Region / Tier / Game / Tags + 4 个状态 tab
   - 实现：仅 search + category + region + status（Game / Tags 维度缺失）

### 🟡 中度差异
- 表格行缺 growth indicator（"+12.4k"）
- Status badge 枚举不同（Blacklisted → terminated）
- 表格 cell 无 cyan dot + glow 视觉

## 3. BM2 F003 Campaigns 列表 (`/campaigns`) 重演确认

### 🟡 gap

1. **KPI stat strip 缺失**
   - 原型：顶部 4 KPI 卡（Active Campaigns / KOLs in Pipeline / Avg Reply Rate / Reach Forecast）
   - 实现：完全没有
   - **与 BM1 Database Quick Stats 是同类问题**

2. **Filter 维度简化 6 → 2**
   - 原型：6 filter chips（All/Active/Draft/Paused/Completed + Game/Region/Owner/Date 下拉）
   - 实现：仅 Search + Status dropdown

3. **AI Suggestions / Insights Panel 缺失**
   - 原型：左下角辅助区
   - 实现：无

### 公共组件 (FilterBar 独立组件但没用 `@/components/common/*` 的 `StatCard` / `GlassPanel` / `SectionHeader`；Dashboard 的做法没有被借鉴)

## 4. BM2 F005 Campaign 详情 (`/campaigns/:id`) 重演确认

### 🟡 gap

1. **Email Performance chart 缺失**
   - 原型：中部 chart section
   - 实现：无

2. **AI Suggestions + Activity Timeline 缺失**
   - 原型：右侧窄列（320px 固定）放 Campaign Health + AI Suggestions + Recent Activity timeline
   - 实现：无右侧 insights 布局，所有 section 单列垂直堆叠

3. **KOL Panel 手写 modal 不复用**
   - 实现：Add KOL modal 在 CampaignKolPanel.tsx（495 行）内完全手写
   - 没有抽取 `Dialog` 组件到 `@/components/common/`

## 5. 根因分析（3 条模式性问题）

### 5.1 Generator 把"装饰性丰富内容"当 MVP 简化项

Stitch 原型的"主搜索区 / AI Smart Match / Insights Panel / Quick Stats / Bulk Action Bar"等在 Generator 眼里被归类为"可删的丰富 UI"，而非"核心体验"。

**这是错误的产品判断**：
- 客户看到的不是 MVP 与否，而是"这个产品是否像成熟产品"
- Insights panel 正是"智能工具"的核心差异化 —— 比数据库本身更有价值
- Bulk Action Bar 是表格的核心功能，不能只留 checkbox 做幽灵控件

### 5.2 Generator 抄 Stitch HTML 的 className 而非复用公共组件

对比 Dashboard（F007，对照组做对了的）：
- Dashboard `page.tsx` import `GlassPanel` / `KolCard` / `GhostButton` / `SecondaryButton` / `SectionHeader` 从 `@/components/common`
- Discovery/Database/Campaigns list/Campaign detail：全部手写 className + 局部 `Th()` `Td()` `ChipCheckbox` 函数

**根因**：Generator 遇到原型 HTML 就用 Tailwind utility 直接重现，而不先问"我的组件库是否有这个抽象"。

### 5.3 签收流程漏洞 — visual regression baseline 未入库但签收通过

**证据链：**
- BM1 F009 Generator 自报（progress.json session_notes）："visual PNG 未生成（本地 WSL 无 Playwright system libs sudo 权限）"
- Reviewer signoff 报告 `BM1-console-kol-core-signoff-2026-04-23.md`：F009 标 PASS，验收凭据是"bm1-flow 连续 2 次 PASS；marketer-dashboard 4/4 PASS"
- **从未验证 visual baseline 是否真存在**

Evaluator 签收标准不够严格，让"功能 E2E 绿即算 UI PASS"成为默认。

## 6. 修复路径提案

### 6.1 对已完成的 5 页（BM1 F004/F005 + BM2 F003/F004/F005）

用户 2026-04-24 选 **C 档（pixel perfect + 组件库抽取）**，时机延后到 BM2 done 后。

但 spot audit 发现 BM2 F003/F005 也有问题，**应扩大 hotfix 范围**：

| 原建议 hotfix | 扩大后 hotfix |
|---|---|
| BM1.1-visual-fidelity（Discovery + Database 两页）| **MVP-visual-fidelity**（Discovery + Database + Campaigns + Campaign detail 四页 + KOL detail）|
| ~1.5-2 天 | ~3-4 天 |
| 2 页抽公共组件 | 5 页共同抽公共组件，ROI 更高 |

### 6.2 对 BM2 剩余 UI 页（F006/F007/F009/F010）

**必须在 F006 开工前加 guardrail**，否则会重演 5 次。

Guardrail 机制：`framework/harness/ui-fidelity-guardrail.md`（本次新建）强制 spec acceptance 包含：
- Stitch 参考 HTML 路径（已有）
- 必用公共组件清单（新增，Generator 开工前明确列出）
- **"不得简化的元素"清单**（新增）：如 KPI strip / Insights panel / Bulk Action Bar / AI CTA 等
- 任何简化必须 Planner 显式批准，写入 spec 的 "§3 关键设计决策"

同时 BM2 spec §F006/F007/F009/F010 acceptance 补 guardrail 要求，Generator 开工时对照清单。

### 6.3 对签收流程漏洞

`.auto-memory/role-context/evaluator.md` 加硬条款：
- Visual regression 任务的 PASS 判定必须 `ssh vps 'git ls-files tests/screenshots/baseline/*.png'` 返回非空
- scaffold 存在但 baseline 缺失 → 判 **PARTIAL**（即使 E2E 全绿）
- 签收报告模板加"Stitch 还原度评估"段（至少 pixel diff 或 Reviewer 目测对比摘要）

## 7. 推荐行动（优先级）

| 优先 | 动作 | 时机 | 执行者 |
|---|---|---|---|
| **P0** | BM2 F006 开工前补 guardrail | 立刻（本提交）| Planner（我）|
| **P0** | 归档审计报告 + 落 backlog 5 条 | 立刻 | Planner（我）|
| **P0** | evaluator.md + pre-impl-adjudication.md 补签收硬要求 | 立刻 | Planner（我）|
| **P1** | 扩大 hotfix 到 MVP-visual-fidelity（5 页）| BM2 done 后 | Generator + Evaluator |
| **P1** | 生成 + 入库 BM1 5 张 visual baseline PNG | 立即（或并入 hotfix）| Generator |

## 8. 对用户的 Phase 2 决策请求

用户 2026-04-24 已批准：
- ✅ 归档报告
- ✅ 修复流程漏洞
- ✅ 修复方式 C 档（pixel perfect + 组件库抽取）
- ✅ 修复时机：BM2 done 后（"借这个机会避免再出类似问题"）

**spot audit 发现后待决策：**

1. **Hotfix 范围扩大？** BM1.1 (2 页) → MVP-visual-fidelity (5 页) — 由于 BM2 F003/F005 也重演
2. **BM2 F011 visual regression 硬标准？** 是否把"PNG 生成 + 入库"从 optional/scaffold 提升为 fix_rounds 前置硬门槛
3. **BM1 5 张 baseline PNG 当前是否要求 Generator 补？** 独立 F 批次 or 并入 hotfix

这些问题待用户拍板。

## 9. 本次调查未深入的

- `/knowledge-base` (BM1 F003) — 仅 dashboard-level 浏览，未做 className 密度核查
- `/kols/[id]` (BM1 F006) — 仅提到 TabKey 手写，未详细 diff
- BM2 F007 (CRM) / F009 (ROI 页) / F010 (周报) — 尚未实现
- BM2 F008 (ROI compute util) — 非 UI，不在 audit 范围

若后续需要扩展 audit 覆盖，Planner 可按同样 side-by-side 范式补做。

---

**附件：** 原 Explore agent 详细调查 + BM2 spot audit 全文已保留在 Planner 本次会话 tool outputs 中，若未来需要可从 git 此提交对应 chat 记录或重新调用 agent 复制。
