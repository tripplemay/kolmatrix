# KOLMatrix AI Native 重构 Roadmap

> **创建：** 2026-05-10
> **作者：** Planner johnsong
> **决策来源：** ADR-013-ai-native-product-pivot
> **配套文档：** docs/product/ai-native-vision.md
> **总周期估算：** 6-10 周（2026-05-13 启动，预计 2026-06-21 ~ 2026-07-19 完成）
> **文档性质：** 实施路线图（不是 spec），描述**批次拆分 / 依赖 / 工时**，作为后续 Planner 起 features.json 的依据

---

## §1 Phase 总览

```
Phase 0  方向沉淀（ADR + vision + roadmap） — 进行中（本会话完成）
   ↓
Phase 1  基础重构（schema + IA） — ~2-3 周
   ↓
Phase 2  Match 页核心（合并 + AI 推荐主面板） — ~2-3 周
   ↓
Phase 3  AI 交互升级（B3 refine + C3 explainability） — ~2 周
   ↓
Phase 4  Brief / Reach / Insight 页打磨 — ~2 周
   ↓
对外上线（预计 2026-06-21 ~ 2026-07-19）
```

---

## §2 Phase 0 — 方向沉淀（本会话）

**周期：** 0.5 天（即时）
**Owner：** Planner（不动产品代码）

**产出：**
- ✅ `docs/adr/ADR-013-ai-native-product-pivot.md`
- ✅ `docs/product/ai-native-vision.md`
- ✅ `docs/product/ai-native-roadmap.md`（本文件）

**Phase 0 done 后立即做：**
- 用户 ack 三份文档
- Planner 起 BL-063（Phase 1 第一批次）正式 batch（spec + features.json）
- 同时跑 30min hotfix（去 isSaved filter）unblock 内部 dogfood — 单独小 commit，不入 BL-063 spec

---

## §3 Phase 1 — 基础重构（schema + IA）

**周期：** ~2-3 周
**核心目标：** 删除 isSaved 概念 / 重做顶层路由 / 老路由 redirect 兜底
**风险：** 高（schema migration + 9+ 处 query 改 + 路由全改），但是后续 Phase 的前提

### BL-063 — schema 重构 + isSaved 字段处置

**周期：** ~3-5 天 Generator + 1 天 Reviewer
**优先级：** P0（Phase 1 第一批，所有后续依赖）

**实装范围（5-6 features 估算）：**

- F001 schema migration：`is_saved` 列处置（决策点：完全删 / 保留作 `is_starred` 个人收藏 — 详 vision §1 弱化为收藏选项）
- F002 移除 9+ 处 isSaved 过滤 query：
  - `src/lib/campaigns/detail.ts:209` `runAvailableKolsForCampaign` — `WHERE isSaved=true AND deletedAt IS NULL` → `WHERE deletedAt IS NULL`
  - `src/lib/campaigns/list-kpis.ts` / `src/lib/crm/overview.ts` / `src/app/[locale]/(app)/dashboard/data.ts` / `src/app/[locale]/(app)/database/stats.ts` / `src/lib/dashboard/kpi-snapshot.ts` 等
- F003 删除 BL-060-F005 SQL ops 残留（4 个 yt 残留 isSaved 数据，prod 仍未跑 SQL）
- F004 单测 + 集成测试：移除 isSaved 相关 case，加 "全量池"逻辑测试
- F005 staging 验证 + 数据 audit：prod 数据迁移 dry-run 在 staging 验证
- F006 prod migration 执行 ops（用户手动触发 + 监控）

**关键决策点（spec 起草前）：**
- `is_saved` 字段完全删除还是重命名 `is_starred`？（BL-014 vs BL-015 类似情境的处理参考）
- 现 4 个 yt 残留 isSaved=true 数据是否一起迁移？

### BL-064 — 顶层 IA 改造（7 → 4 路由）

**周期：** ~5-7 天 Generator + 1 天 Reviewer
**优先级：** P0（Phase 1 第二批）
**依赖：** BL-063 done（先去 isSaved 概念再做 IA 重组）

**实装范围（6-7 features 估算）：**

- F001 新路由结构创建：`src/app/[locale]/(app)/brief/` + `src/app/[locale]/(app)/match/` + `src/app/[locale]/(app)/reach/` + `src/app/[locale]/(app)/insight/`
- F002 老路由 redirect 兜底：`/discovery` → `/match` / `/database` → `/match` / `/campaigns` → `/brief` 或 `/match` / `/knowledge-base` → `/brief` / `/outreach` → `/reach` / `/dashboard` → `/insight` / `/reports` → `/insight`（保留旧链接不死）
- F003 顶部 nav 重写：4 路由 navigation 组件 + 当前路由高亮
- F004 i18n 重做：5 语言新路由 keys + 老路由 keys 标 deprecated（next-intl middleware 不变）
- F005 e2e suite 更新：现有 e2e 全部 redo（路由变了），优先做 marketer.setup.ts + match.spec.ts（高价值）
- F006 staging deploy + smoke + 视觉 baseline regen
- F007 prod redeploy（first prod-promote of refactor，需用户审慎）

**关键决策点：**
- 老路由 redirect 是 301（永久）还是 302（临时，保留切回能力）？
- nav 顶部 4 路由顺序：Brief → Match → Reach → Insight 是否符合用户工作流认知？
- 是否在 Phase 1 完成时即 prod redeploy 让团队 dogfood，还是等 Phase 2 完成？（建议 P1 后 redeploy，让团队验证 IA 直觉性）

---

## §4 Phase 2 — Match 页核心

**周期：** ~2-3 周
**核心目标：** 合并 Discovery + Database 为统一 Match 页 / Campaign 详情页 KOL panel 重写为 AI 推荐主面板
**风险：** 中-高（UI 大量重写 + e2e break + AI 推荐质量验证）

### BL-065 — Match 页（合并 Discovery + Database）

**周期：** ~5-7 天 Generator + 1 天 Reviewer
**优先级：** P0（Phase 2 第一批）
**依赖：** BL-064 done

**实装范围（6-8 features 估算）：**

- F001 Match 页 layout：全量 KOL 工作台 + filter sidebar + 卡片视图 + 对比视图（保留 /database 的表格视图作 alternate view）
- F002 数据源统一：删除 isSaved filter（已在 BL-063 完成）+ 全量 apify-kol KOL 池 + 默认按 valueScore desc 排序
- F003 BulkActionBar 集成（从 /database 迁来）+ ImportCsvDialog 移到 /admin
- F004 SmartMatchDialog 升级：现 dialog 按需触发 → 改为 Match 页的"campaign 上下文"sidebar，campaignId query param 时显 AI 推荐
- F005 SaveSearchControls + AdvancedToggleCookie 保留（marketer 标记常用搜索）
- F006 i18n 5 语言 + e2e suite 更新（match-fidelity.spec.ts）
- F007 staging deploy + 视觉 baseline regen

### BL-066 — Campaign 详情页 AI 推荐主面板

**周期：** ~5-7 天 Generator + 1 天 Reviewer
**优先级：** P0（Phase 2 第二批，AI native 核心体验）
**依赖：** BL-065 done（Match 页 ready）+ BL-048 valueScore 优化（提前到此 Phase 2，作为推荐质量基础）

**实装范围（7-9 features 估算）：**

- F001 Campaign 详情页 layout 重写：
  - 顶部 Brief 摘要（产品 + 活动目标）
  - 中部 AI 推荐主面板（top 30 候选，可对话 refine）
  - 底部已确认 KOL 工作流（触达进度 / 邮件状态）
- F002 AI 推荐主面板组件：每个 KOL 卡片含 valueScore + 一句话"为什么"占位（C2 浅版，C3 完整在 Phase 3）
- F003 接受 / 跳过 / 换一批 操作流：用户操作 → 后端 update kol_campaign 表
- F004 删除现 AddKolDialog 路径：button "添加 KOL" 概念消失，dialog 文件删除
- F005 现 CampaignKolPanel.tsx 重构为 AcceptedKolsPanel.tsx（仅显已确认 KOL）
- F006 单测 + 集成测试 + e2e (campaign-match-flow.spec.ts)
- F007 i18n 5 语言
- F008 staging + prod 数据迁移：现 kol_campaign 表数据兼容性

### BL-048 — valueScore 区分度优化（提前）

**周期：** ~3-5 天 Generator + 1 天 Reviewer
**优先级：** P1（提前到 Phase 2，与 BL-066 并行）
**触发：** AI 推荐质量核心依赖；现 valueScore 公式 follower cap=2154 / categoryScore length-only / engagement >10% 一刀切 → top-15 包含 2080 粉到 12.6M 粉的 mega vs nano 同分

**实装范围：** 见 backlog.json BL-048（4 个候选方向，需 Planner 起 spec 时锁定）

**关键：** 与 BL-066 并行进行，BL-066 上线时 valueScore 公式已优化，AI 推荐质量与公式同步升级。

---

## §5 Phase 3 — AI 交互升级（B3 + C3）

**周期：** ~2 周
**核心目标：** 自然语言 refine（B3）+ 双向 explainability（C3）
**风险：** 中（LLM 调用稳定性 + cost cap + 响应延迟）

### BL-067 — Explainability（C3 双向）

**周期：** ~5-7 天 Generator + 1 天 Reviewer
**优先级：** P0（Phase 3 第一批，AI native 关键差异化）
**依赖：** BL-066 done（推荐主面板 ready）+ aigcgateway action 创建

**实装范围（5-7 features 估算）：**

- F001 aigcgateway action: `kol-recommendation-explain`（输入：KOL + campaign + 4 维度数据 / 输出：1 句话解释）
- F002 推荐卡片解释生成：每个 KOL 旁渲染解释（懒加载 + 缓存 / cost cap MVP $5/day per tenant 沿用 BL-034 F005）
- F003 用户主动 query 入口："为什么这个排前？"按钮 + 详细解释（aigcgateway action `kol-recommendation-explain-detailed`）
- F004 5 语言 i18n（解释文案 LLM 直接生成本地化版本）
- F005 单测 + 集成测试（mock LLM 响应）+ e2e
- F006 cost monitoring + retry/fallback（LLM 不可用时显默认数据）
- F007 staging deploy + 视觉 baseline

### BL-068 — Conversational refine（B3 混合）

**周期：** ~5-7 天 Generator + 1 天 Reviewer
**优先级：** P0（Phase 3 第二批，AI native 关键差异化）
**依赖：** BL-067 done（reuse aigcgateway 调用模式）

**实装范围（6-8 features 估算）：**

- F001 aigcgateway action: `kol-refine-natural-language`（输入：用户自然语言 + 当前推荐池 / 输出：重排后的 KOL ID 列表 + filter 状态调整）
- F002 Match / Campaign 详情页加 "Refine with AI" 输入框 UI
- F003 LLM 解析层：自然语言 → filter dimensions（"micro tier" → tier=micro / "女性受众" → audience.gender_f > 0.5 / etc）
- F004 错误边界：LLM 解析失败 → 友好提示 + filter UI fallback
- F005 用户操作 audit log（refine 输入 / 解析结果 / 用户接受率）— Phase 4 个性化学习的输入
- F006 5 语言 i18n + 单测 + e2e
- F007 staging + cost monitoring
- F008 prod redeploy

---

## §6 Phase 4 — Brief / Reach / Insight 页打磨

**周期：** ~2 周
**核心目标：** 4 路由完整体验，对外 ready

### BL-069 — Brief 页（合并 KB + Campaigns/new）

**周期：** ~3-5 天 Generator + 1 天 Reviewer
**优先级：** P1
**依赖：** BL-068 done

**实装范围（4-6 features 估算）：**

- F001 Brief 页 layout：产品列表 + 活动创建 + AI brief 生成入口
- F002 自然语言 brief 输入支持："Q2 推 Genshin Impact 给东南亚游戏受众，预算 $10K" → LLM 解析 → 自动填表
- F003 Brief 提交后自动跳 Match 页 + AI 候选预生成（after-create hook）
- F004 现 KB / Campaigns/new 页面 redirect
- F005 i18n + 单测 + e2e
- F006 staging + prod redeploy

### BL-070 — Reach + Insight 页适配新 IA

**周期：** ~3-5 天 Generator + 1 天 Reviewer
**优先级：** P1（Phase 4 第二批）
**依赖：** BL-069 done

**实装范围（5-7 features 估算）：**

- F001 Reach 页：现 Outreach 路径迁来 + 与 Match 页接受的 KOL 流自动衔接
- F002 Insight 页：Dashboard + Reports 合并 + 加"AI 学到的偏好"展示（Phase 5 candidate？）
- F003 现 outreach / dashboard / reports redirect
- F004 i18n + 单测 + e2e
- F005 staging + prod 全量 redeploy
- F006 4 路由全量 e2e suite + 视觉 baseline regen
- F007 对外上线 ready 验收 checklist

---

## §7 Phase 5 候选（post-Phase 4，可选）

不在 6-10 周硬上线范围内，但 AI native 完整体验需要：

- **个性化学习**：用户每次接受/拒绝/refine → 偏好数据 → 4 维度权重个性化（aigcgateway action 或本地 ML）
- **对话式 onboarding**：第一次用户登录 → AI 引导 conversational 完成第一个 campaign
- **跨 campaign learning**：单 marketer 多 campaign 的偏好聚合 → 跨 campaign 推荐

视 Phase 1-4 验收数据决定是否启动。

---

## §8 现 backlog 重新排（5/13 deadline 取消后）

按 ADR-013 决策，5/13 上线 buffer 取消，现 backlog 重新排：

| Backlog ID | 原优先级 | 新优先级 | 原因 |
|---|---|---|---|
| BL-048 valueScore 区分度 | low | **P1（提前 Phase 2）** | AI 推荐质量核心依赖 |
| BL-054 flaky network test | medium | **medium（Phase 1-2 期间穿插）** | e2e suite 全 redo 时一并处理 |
| BL-056 notifications 真化 | low | low（post Phase 4）| 不阻塞 AI native 重构 |
| BL-062 数据 coverage 治理 | high | **medium（与 Phase 1-2 平行）** | AI 推荐质量依赖 KOL 数据完整度 |
| BL-014 i18n ja/ko/es 人工 review | low | low（post Phase 4）| 重构期间 i18n 大量重做，等稳定后 review |
| BL-015 Visual regression 跨平台 | low | low（post Phase 4）| 重构期间视觉 baseline 反复变 |
| BL-016 Weekly Report 真 PDF | deferred | deferred（post-AI native）| 跟着 Insight 页重做后再评估 |
| BL-026 视频脚本投放路径 | deferred | deferred（post-AI native）| 等 Reach 页重做后再评估 |
| BL-027 富文本邮件编辑器 | low | low（post-AI native）| Reach 页重做时一起评估 |
| BL-042 aigcgateway max_tokens 治理 | deferred | **medium（Phase 3 期间评估）** | B3 + C3 大量 LLM 调用，max_tokens 需明确 |

---

## §9 重构期间的产品状态

### 内部 dogfood（重构期间团队仍要用产品）

- Phase 0 完成后跑 30min hotfix（去 isSaved filter）unblock 现产品 — 与 1A 方向一致不做白工
- Phase 1 完成后 prod redeploy → 团队体验新 IA（4 路由）
- Phase 2 完成后 prod redeploy → 团队体验 Match 页 + AI 推荐主面板
- Phase 3 完成后 prod redeploy → 团队体验 explainability + refine
- Phase 4 完成后对外上线

每个 Phase prod redeploy 都给团队 1-2 周 dogfood 期 + 反馈收集 → 下个 Phase 起前作为 spec 输入。

### 外部客户（重构期间不接新真客户）

- 当前 prod 5 个 tenant（marketer 内部测试）继续，不主动推广
- 重构期间不接新外部客户（避免老架构习惯养成）
- Phase 4 完成 + 对外上线后开始接新客户

### 数据迁移与兼容

- 现 prod 数据（4 个 yt 残留 isSaved KOL / 5 tenant Asset / Campaign / KolCampaign 等）保留
- BL-063 schema migration 兼容现数据（is_saved 字段处置后旧数据迁移到 starred 或直接删除）
- 路由 redirect（BL-064 F002）保留 1-2 个 phase 后再删

---

## §10 风险与缓解

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| Phase 1 schema migration 引入回归 | 中 | 高 | F005 staging dry-run + 多次验证；F006 prod ops 用户手动触发 + 监控 |
| Phase 2 AI 推荐质量不达预期 | 中 | 高 | BL-048 提前到 Phase 2 优化 valueScore；用户接受率作 Phase 2 验收门槛 |
| Phase 3 LLM 调用 cost 超预算 | 中 | 中 | aigcgateway 月预算 $100 已配；F002 缓存 + 懒加载；BL-042 max_tokens 治理同期评估 |
| Phase 4 对外上线时仍有 P0 bug | 中 | 高 | 每 Phase prod redeploy + 团队 dogfood 1-2 周；Phase 4 完成后再加 1 周 internal beta |
| 总周期延期超 12 周 | 中 | 中 | 每 Phase 完成后 review 周期偏差，必要时砍 Phase 4/5 范围 |
| 个别 BL- 批次工时严重低估 | 高 | 中 | 各 BL- spec 起草时 Planner pre-impl-audit 严格 + 用户 ack |
| 用户中途方向再调整 | 低 | 极高 | ADR-013 已 lock 方向 + 重新评估触发条件明确（见 ADR Notes）|

---

## §11 验收门槛（每 Phase 完成判定）

### Phase 1 verifying gate
- 所有现产品功能在新 IA 下 accessible（redirect 兜底全测）
- L1 全绿 / staging E2E 全绿 / prod redeploy /api/health green
- 团队 dogfood 1 周无新 P0 bug

### Phase 2 verifying gate
- Match 页 AI 推荐 top 30 候选稳定渲染（响应时间 < 2s）
- Campaign 详情页接受 / 跳过 / 换一批操作流通
- AI 推荐用户接受率 ≥ 30%（团队内部测试）

### Phase 3 verifying gate
- explainability 解释覆盖率 100%（每个 KOL 卡片都有解释）
- refine 自然语言成功解析率 ≥ 80%（mock 100 个常见输入）
- LLM 调用 P99 延迟 < 5s

### Phase 4 verifying gate（对外上线 ready）
- 4 路由全量 e2e suite 全 PASS
- 团队 dogfood 1 周 + 1 周 internal beta 无 P0 bug
- 用户旅程 5-7 步可达（实测）
- 完整 i18n 5 语言验证

---

## References

- ADR-013-ai-native-product-pivot
- docs/product/ai-native-vision.md
- docs/product/KOLMatrix-MVP-PRD.md（部分仍有效）
- backlog.json（19 entries，重排见 §8）
- 现 BL-021/BL-023/BL-048/BL-061 等已完成批次 audit trail
