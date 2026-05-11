# BL-065 Match 页内部 UI 实质重写 — 合并 Discovery + Database 为统一 KOL 工作台 Spec

> **草稿创建：** 2026-05-11 北京 / Planner johnsong
> **状态：** **DRAFT** — 草稿等待用户 review；不入 features.json；BL-064 整体 done + Phase 1 verifying gate 达成后 Planner 升级为正式 spec
> **批次类型：** 普通批次（全部 executor:generator）
> **优先级：** P0（Phase 2 第一批 / ADR-013 vision §2 Match 路由的实质化）
> **预估工时：** ~5-7 day Generator + 1 day Reviewer
> **依赖：** BL-064 done（/match 路由壳已 ready，当前 embed /discovery 占位）+ ideally BL-048 valueScore 优化并行（roadmap §8 提前到 Phase 2，AI 排序质量基础）
> **决策来源：** ADR-013 §Decision 第 1 条 / vision §2 Match 路由 / roadmap §4 BL-065

---

## §1 背景

BL-064（5/11 building 阶段，预计 5/12 done）完成顶层 IA 7→4 路由壳改造，`/match` 路由现 embed `/discovery` 内容作占位（embed-old-components 策略 A2）。`/database` 已 302 redirect 到 `/match` 但本身整页未删，仅功能合并预期。

**本批次目标：** 把 `/match` 从"embed /discovery 占位"升级为**全新的统一 KOL 工作台**，实质合并 Discovery（探索） + Database（管理） 两套体验，同时为 Phase 2 后续 BL-066（Campaign 详情页 AI 推荐主面板）的 campaignId query param 模式做铺垫。

### 当前 Discovery + Database 功能集

**`/discovery`（探索型）11 文件：**
- SearchBar（关键词搜索）/ FilterSidebar（多维过滤）/ KolResultCard（卡片视图）
- SmartMatchDialog（AI 智能匹配，按需触发的 modal）
- SaveSearchControls / AdvancedToggleCookie
- ActiveFilters / SummaryBar / EmptyState
- view-mode.ts（卡片/列表切换）
- 数据源：apify-kol 单源全量池

**`/database`（管理型）17 文件：**
- DatabaseTableClient（表格视图）
- DatabaseFilterBar（filter）
- DatabaseInsightsClient + InsightsPanel（数据洞察）
- BulkActionBar（批量操作：选中多行 → 批量加 campaign / 删除 / 导出）
- ImportCsvDialog（CSV 导入）
- AddKolDialog（手动添加单 KOL）/ AddToCampaignDialog（从 saved 推到 campaign，BL-063 已删 isSaved，路径仍存）
- QuickStats / search.ts / stats.ts

### 合并后 `/match` 应有功能（vision §2 + §3 + roadmap §4）

- 全量 KOL 工作台（默认 valueScore desc 排序）
- filter + search（合并 Discovery FilterSidebar + Database DatabaseFilterBar 重复部分）
- 双视图：卡片（探索友好）+ 表格（管理友好）— marketer 切换
- AI 推荐 sidebar：`?campaignId=xxx` 时显 campaign-context AI 推荐 top N（接 AiSuggestionsClient 现 logic + 升级）
- 批量操作（继承 BulkActionBar）
- 单 KOL 操作（继承 AddKolDialog 手动添加 + AddToCampaignDialog 加到 campaign）
- 数据洞察（QuickStats + InsightsPanel 重定位为顶部 summary bar）
- SaveSearchControls 保留（marketer 标记常用 search 组合）

### 不在本批次范围（避免 scope creep）

- **Campaign 详情页内部 UI** — BL-066 工作（含"接受 / 换一批 / refine"操作流 + 已确认 KOL 面板）
- **B3 自然语言 refine** — BL-068 工作（aigcgateway action `kol-refine-natural-language`）
- **C3 双向 explainability** — BL-067 工作（每个推荐附"为什么"+ 用户 query）
- **个性化偏好学习** — Phase 5 候选（不属本批次）

---

## §2 业务目标

- `/match` 从 embed /discovery 占位升级为实质工作台，团队 dogfood 立即感知"AI 主导工作台"
- `/database` 整页删除（路由 + 17 文件），路由 redirect 在 BL-064 已就位
- `/discovery` 整页删除（路由 + 11 文件），路由 redirect 在 BL-064 已就位
- ImportCsvDialog 移到 `/admin/kol-csv-import`（marketer 不必看到批量管理工具）
- `?campaignId=xxx` query param 模式 ready，为 BL-066 Campaign 详情页主面板做铺垫
- L1 全绿 + staging+prod 全量 redeploy + 团队 dogfood 1 周无 P0

---

## §3 范围（7 features，待用户 ack 后正式化）

### F001 — Match 页 layout 重写 + 双视图切换

**周期:** ~10-12h Generator + 1h Reviewer

**Acceptance：**
- `src/app/[locale]/(app)/match/page.tsx` 从 embed /discovery 改为实质组件
- Layout 三段：顶部 SummaryBar（含 QuickStats 数据洞察）+ 左侧 FilterSidebar + 主区双视图（卡片 / 表格切换）
- 双视图：默认卡片（探索型），用户可切换表格（管理型）；视图状态记 cookie 或 URL param
- 默认排序 valueScore desc（apify-kol 单源全量池，无 isSaved filter）
- `?campaignId=xxx` 时右侧出现 sidebar 显 AI 推荐（仅占位，BL-066 接 logic）
- L1 lint 0 / tsc 0 / unit test PASS

### F002 — 合并 Filter + Search + SaveSearchControls

**周期:** ~8-10h Generator + 1h Reviewer

**Acceptance：**
- FilterSidebar 合并 Discovery FilterSidebar + Database DatabaseFilterBar 重复部分（platform / category / tier / region / etc）
- SearchBar 保留（Discovery 现 logic），添加表格视图下的 inline column search
- SaveSearchControls 保留：marketer 可标记常用 filter+search 组合
- ActiveFilters 保留作 filter 概览 chip 区
- L1 PASS

### F003 — BulkActionBar 集成 + 移动 ImportCsvDialog 到 /admin

**周期:** ~5-7h Generator + 1h Reviewer

**Acceptance：**
- BulkActionBar 从 /database 迁来，挂在 Match 页主区底部（选中多行 KOL 触发显）
- 操作：批量加 campaign（替代 AddToCampaignDialog 单 KOL 路径，dialog 仍保留作单 KOL 路径）/ 批量软删 / 批量导出 CSV
- ImportCsvDialog 移到 `src/app/[locale]/(app)/admin/kol-csv-import/page.tsx`（admin role 才可访问，marketer 看不到入口）
- `/admin/*` 路由需要 admin role check（参考现 /admin/apify-preview 模式）
- L1 PASS

### F004 — AddKolDialog（手动添加单 KOL）保留 + 升级

**周期:** ~3-5h Generator + 0.5h Reviewer

**Acceptance：**
- `/match` 顶部 actions 区加 "Add KOL" 按钮 + Dialog（继承 /database 的 AddKolDialog 路径）
- BL-063 已删 isSaved=true 字段写入；本批次仅 UI 路径迁移
- L1 PASS

### F005 — SmartMatchDialog → AI 推荐 sidebar（campaign-context mode）

**周期:** ~7-10h Generator + 1h Reviewer

**Acceptance：**
- 现 SmartMatchDialog（按需触发的 modal）改为 Match 页右侧 sidebar，`?campaignId=xxx` 时自动显
- Sidebar 显 top N AI 推荐（接现 AiSuggestionsClient logic，BL-066 升级为完整主面板）
- 占位 "为什么"解释（C2 浅版，C3 完整在 BL-067）
- 无 campaignId 时 sidebar 不显（普通工作台模式）
- L1 PASS

### F006 — i18n 5 语言 + e2e suite + 删 /discovery + /database 整页

**周期:** ~7-10h Generator + 1h Reviewer

**Acceptance：**
- messages/{cn,en,ja,ko,es}.json 加 match.* 完整 keys（覆盖 SummaryBar / FilterSidebar / 卡片/表格视图 / SaveSearchControls / BulkActionBar / AddKolDialog / AI 推荐 sidebar）
- 旧 `discovery.*` / `database.*` keys 标 deprecated（BL-070 完整迁移后删）
- 删除整文件：`src/app/[locale]/(app)/discovery/` 11 文件 + `src/app/[locale]/(app)/database/` 16 文件（保留 ImportCsvDialog 已迁 /admin）
- 删除对应 e2e spec：`tests/e2e/database-fidelity.spec.ts`（BL-063 已 skip 部分 case，本批次整删）+ `discovery.spec.ts`（如有）
- 新建 `tests/e2e/match-fidelity.spec.ts` — 覆盖 Match 页核心交互（卡片视图 / 表格视图 / filter / batch / addKol / campaign-context sidebar）
- L1 PASS

### F007 — staging + prod redeploy + 视觉 baseline regen + signoff

**周期:** ~3h Generator + 1h Reviewer

**Acceptance：**
- staging deploy via deploy-staging.yml
- 视觉 baseline regen via update-visual-baselines workflow（Match 页 / 删除的 Discovery+Database 旧 baseline 自动失效）
- 团队 staging dogfood spot check
- prod redeploy 用户 ack 时间窗
- 24h pm2 monitor + audit script + signoff doc + Reviewer 终审
- progress.json status reverifying → done

---

## §4 关键决策点（spec 正式化前需 Planner/用户 ack）

### #A 表格视图保留 vs 删除

- **保留（推荐）：** marketer 在管理大量 KOL 时表格视图效率高（一屏看 20+ 行），卡片视图适合探索
- **删除：** 只保留卡片视图，简化 UI / 减少维护成本
- **Planner 倾向 保留** — 双视图是合理 UX trade-off，BL-019 deferred mobile 不影响 desktop 双视图

### #B AI 推荐 sidebar vs 主面板（campaign-context mode）

- **Sidebar（本批次）：** Match 页主区是工作台，右侧 sidebar 显 campaign-context AI 推荐
- **主面板（BL-066 升级）：** `?campaignId=xxx` 时整个主区变成 AI 推荐主面板（接受/换/refine 操作流）
- **Planner 倾向 sidebar 起步，BL-066 升级为主面板** — 本批次范围控制，渐进式升级

### #C `/admin` 路由结构

- ImportCsvDialog 移到 `/admin/kol-csv-import` 是否合并到一个统一 `/admin` 索引页？
- 现 prod 已有 `/admin/apify-preview`（Stage 1.5）
- **Planner 倾向 一个 /admin 索引页 + 多个子路由**（kol-csv-import / apify-preview / 等），未来 admin 功能扩展时不重做

### #D BulkActionBar 操作集

- 现 /database BulkActionBar 操作：批量加 campaign / 批量删除 / 批量导出
- 本批次保留全部？删某些（如 marketer 不应该批量删 KOL，避免误操作）？
- **Planner 倾向 保留全部但加确认 modal** — 让 marketer 自由但有 friction

### #E SaveSearchControls 必要性

- marketer 标记常用 filter+search 组合是否真有用？
- 现 /discovery 有此功能，但 prod 实际使用率未知
- **Planner 倾向 保留** — 低成本（已有 logic），post-AI native 可作"AI 推荐 fallback"路径

### #F 卡片视图 vs 表格视图默认值

- 默认卡片（探索友好）vs 默认表格（管理友好）vs 上次用户选择记忆？
- **Planner 倾向 默认卡片**（与 vision §1 "AI 主导探索"心智一致），用户切表格记 cookie

---

## §5 风险

| Risk | 概率 | 影响 | 缓解 |
|---|---|---|---|
| /discovery + /database 整页删除引入回归 | 中 | 高 | F006 完整 e2e + staging dogfood 1 周；BL-064 redirect 仍在不死链 |
| 双视图实装复杂度超预估 | 中 | 中 | F001 拆"卡片视图先，表格视图后"两 stage，必要时 split F001a/F001b |
| BulkActionBar 集成与新 Match 页布局冲突 | 低 | 中 | F003 实装时与 F001 layout 并行 review |
| ImportCsvDialog 移 /admin 后 marketer 报"找不到 CSV 导入" | 低 | 低 | Match 页加 admin entry link（admin role 才显示）+ 文档说明 |
| 视觉 baseline 大量 break（删两个整页 + 新页）| 高 | 中 | F007 走 update-visual-baselines workflow regen（BL-061/063/064 实战路径）|
| Phase 2 BL-066 边界冲突 | 中 | 中 | §1 不在本批次范围已明确 sidebar vs 主面板边界 |

---

## §6 不变量（执行期间不得违反）

- **不动 Campaign 详情页内部 UI**（BL-066 工作）
- **不实装 B3 自然语言 refine**（BL-068 工作）
- **不实装 C3 完整 explainability**（BL-067 工作 — 本批次仅 C2 占位）
- **不动 isSaved 概念**（BL-063 已完成，本批次零相关）
- **不动 KOLMatrix mapper engagement_rate 公式**（ADR-013 + fork §3.3 数学等价）
- **F007 prod redeploy 必须用户 ack 时间窗**（per BL-063/064 实战流程）
- **不动 BL-063 4 sed/awk hot-fix on /opt/apify-kol-service**

---

## §7 关联文档

- ADR-013-ai-native-product-pivot（决策源）
- docs/product/ai-native-vision.md §2（Match 路由定义）+ §3（场景 2 推荐附"为什么"占位）
- docs/product/ai-native-roadmap.md §4 BL-065
- docs/specs/BL-064-top-level-ia-refactor-spec.md（前置批次，/match 壳）
- BL-064 fix-round 3 sediment：embed-old-components 策略实战 + redirect scope wire-readiness 评估
- BL-061 视觉 baseline regen via workflow 实战路径
- BL-063 F006/F007 prod ops audit script 模板

---

## §8 后续 backlog 影响

本批次完成后：
- **BL-066** Campaign 详情页 AI 推荐主面板 — Phase 2 第二批，依赖本批次 `?campaignId=xxx` mode + AI 推荐 sidebar
- **BL-067** C3 双向 explainability — Phase 3 第一批
- **BL-068** B3 自然语言 refine — Phase 3 第二批
- **BL-048 valueScore 优化** — 与本批次并行（roadmap §8）— AI 推荐排序质量基础
- **BL-062 数据 coverage 治理** — 与本批次并行（roadmap §8）— AI 推荐覆盖率基础

Phase 2 完成 gate（roadmap §11）= BL-065 + BL-066 + BL-048 都 done + AI 推荐用户接受率 ≥ 30%。

---

## §9 待用户/Planner 升级为正式 spec 时检查

本草稿在 BL-064 整体 done + Phase 1 verifying gate 达成后由 Planner 升级：

- [ ] BL-064 fix-round 3 实战经验是否影响本 spec 范围（特别是 redirect scope 评估教训）
- [ ] 6 个决策点 #A-#F 用户/Planner 最终 ack（embed Planner 倾向到 features.json acceptance）
- [ ] features.json 7 entries 写入
- [ ] progress.json 切 done → planning，sprint = BL-065
- [ ] BL-064 团队 dogfood 1 周反馈是否影响本 spec（如反馈"双视图不需要"则 #A 调整）
- [ ] BL-048 valueScore 优化是否同期 lock（Phase 2 并行批次）
- [ ] 文件改名 `BL-065-match-page-internal-rewrite-DRAFT.md` → `BL-065-match-page-internal-rewrite-spec.md`
