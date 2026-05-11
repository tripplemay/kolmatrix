# BL-064 顶层 IA 改造 — 7 路由 → 4 路由（Brief/Match/Reach/Insight）Spec

> **创建：** 2026-05-11 北京 / Planner johnsong
> **批次类型：** 普通批次（全部 executor:generator）
> **优先级：** P0（Phase 1 第二批 / ADR-013 转向后顶层 IA 重做核心）
> **预估工时：** ~5-7 day Generator + 1 day Reviewer
> **依赖：** BL-063 done ✅（schema 层 isSaved 已拆，全量 KOL 池可用）
> **决策来源：** ADR-013 §Decision 第 1 条 / roadmap §3 BL-064 / vision §2

---

## §1 背景

BL-063（5/11 done）完成 schema 层 `is_saved` 字段拆除 + 9+ query 全清 + UI 控件删除。**全量 KOL 池现在已经是 campaign 加 KOL 的来源**。但顶层路由结构仍是旧 7 路由（Dashboard / Discovery / Database / Campaigns / Knowledge Base / Outreach / Reports），用户心智仍是"工具模块"思维。

本批次按 ADR-013 + vision §2 把顶层 IA 改造为**围绕用户意图组织的 4 路由**：

```
Brief（输入）     ← KB + Campaigns/new + 部分 Dashboard 合并
Match（AI 主导）  ← Discovery + Database + Campaigns/[id] KOL panel 合并
Reach（执行）     ← Outreach 大体保留
Insight（反馈）   ← Dashboard + Reports 大体保留
```

**本批次范围限定为：路由壳 + 老路由 redirect + 顶部 nav + i18n + e2e + deploy**。**不动**各路由内部的 UI 实质重写（如 Match 页合并 Discovery + Database 是 BL-065 工作，Campaign 详情页 AI 推荐主面板是 BL-066 工作）。

### 心智图

| 当前 7 路由 | 新 4 路由 | 何时迁移内部 UI |
|---|---|---|
| /dashboard | /insight（占位）| BL-070 |
| /discovery | /match（占位）| BL-065 |
| /database | /match（占位 redirect）| BL-065（删 /database 整体）|
| /campaigns/new | /brief（占位）| BL-069 |
| /campaigns/[id] | /match?campaignId=xxx 或 /brief/[id]（占位）| BL-066（AI 推荐主面板）|
| /knowledge-base | /brief（占位）| BL-069 |
| /outreach | /reach（占位）| BL-070 |
| /reports | /insight（占位）| BL-070 |

**本批次完成后：** 4 路由壳 ready，老路由全 redirect 到新路由（功能不丢）。**用户体验上能看到 nav 变化 + URL 变化，但各页面内部功能在 Phase 2-4 逐步迁移。**

---

## §2 业务目标

- 4 路由壳创建 + nav 重写，团队 dogfood 立即感知 IA 转向
- 老路由全 redirect 兜底（不死链）
- 5 语言 i18n 新路由 keys 完整
- 现 e2e suite 适配新路由（marketer.setup.ts + match.spec.ts 等优先）
- 视觉 baseline 适配新 nav
- staging + prod 全量 redeploy

---

## §3 范围（7 features）

### F001 — 4 新路由结构创建

**周期:** ~5-7h Generator + 0.5h Reviewer
**Acceptance：**
- 创建目录：`src/app/[locale]/(app)/brief/page.tsx` + `match/page.tsx` + `reach/page.tsx` + `insight/page.tsx`
- 每个 page.tsx 是 minimal 实装（暂时 redirect 到原对应路由 or 简单占位 + 内部 iframe-style 嵌入旧组件）— **决策点 #A：占位策略 redirect-only vs embed-old-components**（见 §4）
- 每个新路由有 metadata（page title / description）
- 现有 `<AppShellLayout>` 兼容新路由
- L1 lint 0 / tsc 0

### F002 — 老路由 redirect 兜底

**周期:** ~3-5h Generator + 0.5h Reviewer
**Acceptance：**
- `src/middleware.ts` 或各老路由的 `page.tsx` 加 redirect：
  - `/dashboard` → `/insight`
  - `/discovery` → `/match`
  - `/database` → `/match`
  - `/campaigns` （列表页） → `/brief` 或 `/match?view=campaigns`（决策点 #B）
  - `/campaigns/new` → `/brief?action=new`
  - `/campaigns/[id]` → `/match?campaignId=:id` 或 `/brief/[id]`（决策点 #B）
  - `/knowledge-base` → `/brief`
  - `/outreach` → `/reach`
  - `/outreach/composer` → `/reach/composer`
  - `/reports` → `/insight`
  - `/weekly-report` → `/insight/weekly` 或保留（next-intl 路径处理）
- redirect 是 **302（临时）** — 决策点 #C（permanent 301 风险大，先保留切回能力）
- 现有 URL 历史不死链（如老 bookmark / 邮件链接 / 第三方分享）
- L1 PASS

### F003 — 顶部 Nav 4 路由重写

**周期:** ~5-7h Generator + 0.5h Reviewer
**Acceptance：**
- `src/components/app-shell/Nav.tsx`（或同义文件）从 7 路由改为 4 路由
- 4 路由顺序 / 文案 / 图标 / 当前路由高亮（决策点 #D nav 顺序）
- mobile responsive 兼容（BL-019 deferred 但 nav 顺序应不破坏既有 mobile breakpoint）
- 单测 ≥2 case 验证 nav 渲染 + 高亮逻辑

### F004 — i18n 5 语言新路由 keys

**周期:** ~5-7h Generator + 1h Reviewer
**Acceptance：**
- `messages/{cn,en,ja,ko,es}.json` 新增 keys：
  - `nav.brief.label` / `nav.brief.description`
  - `nav.match.label` / `nav.match.description`
  - `nav.reach.label` / `nav.reach.description`
  - `nav.insight.label` / `nav.insight.description`
  - 各新路由 page title + breadcrumb
- 旧 keys（`nav.dashboard.label` 等）保留作 deprecated（标注 `// deprecated by BL-064`），BL-070 完整迁移完后删
- LLM 翻 ja/ko/es 后用户/团队 review 标 BL-014 跟进
- L1 PASS

### F005 — e2e suite 适配新路由

**周期:** ~7-10h Generator + 1h Reviewer
**Acceptance：**
- 现 e2e spec 文件全部更新：路径替换 + assertion 适配 + 必要 case 重写
- 优先做：`tests/e2e/marketer.setup.ts`（login 后跳 /insight 而非 /dashboard）+ `database-fidelity.spec.ts`（/database → /match）+ `marketer-dashboard.spec.ts`（/dashboard → /insight）+ `login-cinematic.spec.ts`
- 新建 `tests/e2e/ia-refactor-redirects.spec.ts` 验证 7 老路由全部 302 redirect 到新路由
- BM1 marketer-journey e2e（BL-063 中 skip 的）评估是否再 enable（如 Save toggle 已删，可能仍 skip）
- CI E2E 全 PASS

### F006 — staging deploy + 视觉 baseline regen

**周期:** ~3h Generator + 0.5h Reviewer
**Acceptance：**
- staging deploy via deploy-staging.yml workflow
- staging /api/health git_sha 与 main HEAD 一致
- 视觉 baseline 重新生成（nav 改了，几乎所有 page 的视觉断言会变）— 走 `update-visual-baselines` workflow（BL-061 实战路径）
- 团队 dogfood 路径开放：`https://staging.kol.guangai.ai/zh/brief` / `/match` / `/reach` / `/insight` 可访问
- 用户做 staging spot check（4 新路由 + 7 老路由 redirect + 5 语言 nav）

### F007 — prod redeploy + 24h 监控 + signoff

**周期:** ~2h Generator + 1h Reviewer（24h 后）
**Acceptance：**
- prod 数据 backup（routine pg_dump on deploy script）
- prod redeploy via Deploy to Production workflow（由用户手动触发）
- prod /api/health git_sha = main HEAD
- prod 4 新路由可访问 + 7 老路由 redirect 正常
- 24h pm2 logs 监控无 404 / route-not-found 错误
- `docs/test-reports/BL-064-signoff-2026-05-XX.md` 写最终结论
- Reviewer 复验 + signoff v2 → progress.json reverifying → done

---

## §4 关键决策点（spec 起草后需用户/Planner 在 building 中段裁决）

### #A 占位策略：redirect-only vs embed-old-components

新路由壳是仅 redirect 到旧路由（功能不动），还是把旧组件 import 进来？

- **方案 A1（redirect-only）：** /brief 仅 `redirect('/knowledge-base')`。用户看到 URL 变了但页面内容仍是旧的。简单，但 nav 路径会循环（点 Brief → /brief → redirect /knowledge-base → 显示 dashboard nav）
- **方案 A2（embed-old）：** /brief import 现 /knowledge-base 的 page.tsx 内容，user 看 URL 是 /brief 但内容直接渲染。要处理 nav active 路由判断
- **Planner 倾向 A2** — UX 不打折，用户清晰感知"我在 Brief 这个新 IA 中"
- Generator 起工时 spec §3 F001 acceptance 写 A2 实装路径，如发现实战阻碍升 Planner

### #B Campaign 详情页 redirect 目标

`/campaigns/[id]` redirect 到 `/match?campaignId=:id` 还是 `/brief/[id]`？

- /match?campaignId 强调"为这个 campaign 选 KOL"工作流（Phase 2 BL-066 主面板的最终落地点）
- /brief/[id] 强调"这是个 campaign，编辑它"（更接近 KB 模型）
- **Planner 倾向 /match?campaignId** — 与 vision §3 场景 1（campaign 创建即 AI brief 触发跳 Match）一致
- Generator 起工时按此实装

### #C Redirect HTTP status：302 vs 301

- **302 临时**（推荐）：保留切回旧路由能力，prod 上线后如发现回归可快速 revert middleware；SEO 影响小
- **301 永久**：搜索引擎更喜欢，但前期 redeploy 时如要 revert，browser 缓存层会粘住
- **Planner 倾向 302** — Phase 1 重构期间需要 revert 灵活性

### #D Nav 顺序：Brief → Match → Reach → Insight

- 按用户工作流自然顺序（输入 → 选 KOL → 触达 → 看反馈）
- vs 按使用频率（Match 最高频，可能放第一）
- **Planner 倾向 Brief → Match → Reach → Insight** — 教学性强，新用户一眼明白产品逻辑

### #E /admin 路由处置（CSV 导入等 marketer 不需要的工具）

- CSV 导入 / batch operations 等 admin 类工具在 BL-064 阶段是否一并挪到 /admin 路由？
- 或留到 BL-065 Match 页重做时处理？
- **Planner 倾向后者** — 本批次仅做壳 + redirect，admin 路由是另一个完整模块设计，下批次处理

---

## §5 风险

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| 老路由 redirect 漏处理 / 死链 | 中 | 高 | F005 e2e `ia-refactor-redirects.spec.ts` 全覆盖 7 老路由 → 新路由验证 |
| nav 改造引起视觉 baseline 大量 break | 高 | 中 | F006 走 `update-visual-baselines` workflow regen，BL-061 已实战路径 |
| BM1 marketer-journey e2e 仍 fail | 中 | 低 | 上批次已 skip；本批次 evaluate 后决定 enable / 继续 skip / 重写 |
| 团队 dogfood 反映 nav 不直观 | 低 | 中 | F006 完成后用户 staging spot check 1 周；如反馈调整 → fix-round 1 |
| Phase 2 BL-065/066 与本批次产生 spec 冲突 | 中 | 中 | 本批次明确仅做壳 + redirect，内部 UI 实质重写归 Phase 2 |
| LLM ja/ko/es 翻译不地道 | 低 | 低 | 标 BL-014 跟进，不阻塞本批次 |

---

## §6 不变量（执行期间不得违反）

- **不动各路由内部 UI 实质重写**（Match 页合并 = BL-065 / Campaign AI 推荐主面板 = BL-066）
- **不动 isSaved 概念**（BL-063 已完成，本批次零相关）
- **不动 KOLMatrix mapper engagement_rate 公式**（ADR-013 + fork §3.3 数学等价）
- **不引入产品功能新需求**（本批次纯 IA 改造）
- **F007 prod redeploy 必须用户 ack 时间窗**（per BL-063 F006 实战已固化的 ops 流程）
- **不动 BL-063 4 sed/awk hot-fix on /opt/apify-kol-service**

---

## §7 关联文档

- ADR-013-ai-native-product-pivot（决策源）
- docs/product/ai-native-vision.md §2（4 路由 IA 详解）
- docs/product/ai-native-roadmap.md §3 BL-064（本批次定位）
- BL-063 实战经验：scripts/bl063-f006-prod-audit.sh（F006 可参考的 prod audit script 模板）
- BL-063 signoff: docs/test-reports/BL-063-signoff-2026-05-11.md
- 现 nav 实装：grep `src/components/app-shell/` 或 `src/components/Nav` 系列

---

## §8 后续 backlog 影响

本批次完成后：
- **BL-065** Match 页（合并 Discovery + Database） — Phase 2 第一批，依赖本批次的 /match 壳已存在
- **BL-066** Campaign 详情页 AI 推荐主面板 — Phase 2 第二批
- **BL-048 valueScore 优化** — 提前到 Phase 2 并行（roadmap §8）
- **BL-062 数据 coverage 治理** — 与 Phase 2 并行（roadmap §8）

Phase 1 verifying gate（roadmap §11）在本批次 F007 done 后达成：所有现产品功能在新 IA 下 accessible / L1 全绿 / staging+prod e2e 全绿 / 团队 dogfood 1 周无新 P0 bug。
