# BL-066 Campaign 详情页 AI 推荐主面板 · Stitch 设计稿

> **批次：** BL-066-campaign-detail-ai-main-panel · Phase 2 第二批
> **生成：** 2026-05-14 北京 · Stitch 用户手动生成（Variant A — Neural Velocity）
> **Prompt：** Planner 5/14 给的 3 段 Stitch prompt（仓库内 chat 历史；后续可整理到 V8-prompts.md）
> **对应功能：** features.json F001（Planner 设计稿任务，阻塞 F002 page.tsx 三段重写）

---

## 3 屏清单

| 文件 | 用途 | 生成屏号（参考） |
|---|---|---|
| `main.html` + `main.png` | 主屏：Brief Summary 顶 / AI Recommended KOLs 中 / Accepted KOLs 底 | `campaign_detail_ai_recommendation_main_panel` |
| `empty.html` + `empty.png` | 空态：AI candidates 0（产品被删 / embedding 未同步），仍显 Brief + Accepted KOLs | `campaign_detail_empty_state_kolmatrix` |
| `loading.html` + `loading.png` | Loading 态：smart-match 调用中的 5-card skeleton shimmer | `campaign_detail_loading_kolmatrix` |

---

## Generator F002 1:1 还原检查清单

执行 features.json F002 前 Generator 必读 main.html（per `generator.md §设计稿还原规则`）。还原时只允许：

- 硬编码文本 → next-intl i18n（覆盖 5 locale `campaigns.detail.aiPanel.*`）
- 静态 mock data → 真 API：
  - Brief 区：`runCampaignDetail(tenantId, id)` 现有 server query 复用
  - AI Recommended KOLs 区：F003 AiRecommendationPanel 客户端组件 → `/api/kols/smart-match` POST
  - Accepted KOLs 区：F006 AcceptedKolsPanel（git mv from CampaignKolPanel）
- HTML 元素 → React 组件（用 `@/components/ui` 已有 atoms）
- 静态 → 交互：valueScore badge cyan glow / Accept-Skip-Replace 三按钮 onclick / 「换一批」cycle 5

**禁止：**
- 替换指标类型（valueScore 数字位置不动 / 「Why we suggest this」文案区块结构不动）
- 替换图标（auto_awesome / check / close / swap_horiz / open_in_new 严格按 Material Symbols 还原）
- 删除区块（Brief 三栏 1:2:1 / AI 卡 5×2 grid / Accepted 表格列序不动）
- 改变链接语义（「View profile →」必须链到 /kols/[id]；「Reconnect product」链到 /campaigns/[id]/edit）

---

## 已知 Stitch 渲染漂移（Generator 实装时按 canonical / spec 修正）

| # | 漂移 | 代码应实现 |
|---|---|---|
| 1 | Sidebar 8 项老 IA（Dashboard / KOL Discovery / KOL Database / Campaigns / Email Center / Products / Analytics / Settings） | BL-064 顶层 4 路由 IA（Brief / Match / Reach / Insight），active = Match |
| 2 | empty.png 与 main.png Brief 区 layout 不一致（empty 显示 4 KPI 卡而非 main 的 3 栏 + 操作 cluster）| 以 main.html 为准；empty 仅替换中部 AI 主面板为 empty state，Brief 区结构保持一致 |
| 3 | loading.png sidebar active = "KOL Discovery" | 同 #1，active = Match |
| 4 | loading.png Brief 副标含 "Multi-region sci-fi MMORPG launch..." 文案不同于 main | Stitch 生成时间不同，文案对齐由 i18n 决定，不影响结构 |

**漂移按视觉参考价值排序：** Brief 三栏布局 + AI 卡 5×2 + Accepted 表格 = HIGH（必须 1:1）；sidebar nav active 项 = LOW（Generator 直接用 BL-064 IA 不参考）。

---

## 视觉关键节点（Generator 实装时优先核对）

### Brief 区（main.html 顶部 ~180px）
- 状态 pill 行：cyan `ACTIVE` 主 + 紫色 `AI-DRIVEN` 副
- 三栏 1:2:1：左 H1 + meta / 中 target audience chips + KPI target / 右 Accepted/Contacted 两计数 + 「Edit Brief」「Launch Comm」按钮

### AI Recommended KOLs 区（main.html 中部 ~620px）
- Panel header：auto_awesome icon + 「AI Recommended KOLs」+「Sourced from /api/kols/smart-match」cyan eyebrow
- 右侧 cluster：refresh 时间戳 +「Show next 5」cyan ghost button（cycle 30 候选）
- KOL 卡 5 列 grid（≥1280px）/ 4 列（1024-1279）/ 3 列（<1024）
- 单卡结构：avatar + 名/handle + 浮在右上的 valueScore badge（cyan glow 8px）+ platform/country/category chips + 「Why we suggest this」段（C2 浅版："matched on cosine similarity {score}; valueScore {N}"）+ 4 按钮（Accept 主 / Skip 次 / Replace 次 / View profile →）

### Accepted KOLs 区（main.html 底部 ~360px）
- Panel header：H2 + 计数 badge + 状态 chip 筛选 row
- 表格：avatar + 名 + Source chip（AI / CSV / Legacy）+ status pill + fee + 时间 + open_in_new icon
- **「Add KOL」+ button 必须缺席**（BL-066 #B decision — Marketer 只能通过 AI 推荐接受 / CSV 导入入路径）

---

## Stitch 项目入口

设计系统沿用 `9338165817879839093` Variant A（Neural Velocity）；本批次 3 屏作为 BL-066 F001 deliverable。

---

## 后续

- F002 Generator 起工 → 1:1 还原 main.html
- F008 e2e campaign-match-flow.spec.ts 视觉 baseline 在 F009 update-visual-baselines workflow 后生成
- 旧 design-draft/stitch-references/campaign-detail.html（BM2 版本）保留作历史 reference，不再更新
