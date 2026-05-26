# ADR-015: 5 路由 IA — 加 `campaigns` 一级 nav（supersedes ADR-013 §IA 部分）

## Status

**Accepted**

- 日期：2026-05-26
- 作者：用户 + Planner Kimi（联合决策）
- 相关批次：BL-074-ia-v2（本 ADR 落地批次） + BL-073-prod-hotfix（触发反馈来源）
- Supersedes：ADR-013 §"顶层 IA 重做" 部分（4 路由 → 5 路由；活动可见性）。ADR-013 其它决议（KOL "saved pool" 删除、AI Native 转向等）保留。

## Context（背景）

### 触发事件

2026-05-26 BL-072 修复 prod 后用户实地访问，反馈"找不到活动列表"。当前 4 路由 IA（Brief / Match / Reach / Insight，ADR-013 lock）把 `/campaigns` 折叠成 `match` 的子路由（`deriveActiveNav` `/campaigns → match`），用户必须先进 `/match` 工作台才能看到"我的活动"，而 `/match` 视觉上是 KOL 池而非活动列表。

详见 `docs/test-reports/BL-073-prod-hotfix-audit-2026-05-26.md` §1 #3：用户行为路径分析显示，marketer 心智流是「先选活动 → 再为活动匹配 KOL」，而 ADR-013 的 4 路由 IA 隐藏了"活动"这一名词层级，强行让用户先经过 KOL 池。

### ADR-013 当时的设计假设

ADR-013（2026-05-10）把 IA 由 8 路由瘦身到 4 路由，决策依据：
- 4 动词路由（Brief → Match → Reach → Insight）映射 marketer 工作流的 4 个阶段
- 每个名词实体（KOL / 活动 / 邮件 / ROI）折叠进对应动词路由
- /campaigns 作为 /match 的"上下文 sidebar source"，不需要独立 nav

### 假设失败之处

prod 6 周观察 + BL-073 用户反馈表明：

1. **活动是高频回访资产**，不是一次性配置。marketer 需要频繁查看"活动状态 / 余额 / KOL 进度"，把它埋进 /match sub-route 增加了 2 步点击。
2. **动词流 + 名词实体不互斥**。BM2 时期的 8 路由是过度细碎，但 4 路由是过度合并；5 路由（4 动词 + 1 关键名词「活动」）刚好。
3. **/match 工作台心智冲突**。/match 既要承载 KOL 池又要承载活动上下文，sidebar 双角色让信息层级混乱。把活动外提一级后，/match 专注 KOL 池，AiSuggestionsSidebar 仅在 `?campaignId=...` 时挂载，职责清晰。

## Decision（决策）

将 IA 从 4 路由扩为 5 路由，加 `campaigns` 作第 2 一级 nav：

```
Brief → Campaigns → Match → Reach → Insight
```

具体落地：

1. **NAV_ITEMS** 由 4 → 5 条，campaigns 插在 brief 和 match 之间（顺序 Lock B）
2. **icon** = `campaign`（Material Symbols Outlined）
3. **i18n key** = `nav.campaigns` + `nav.campaignsDescription`，5 locale 完整翻译
   - zh = `活动`
   - en = `Campaigns`
   - ja = `キャンペーン`
   - ko = `캠페인`
   - es = `Campañas`
4. **deriveActiveNav** 把 `/campaigns` 和 `/campaigns/[id]` 都映射到 `campaigns` nav（不再 fallback 到 match）
5. **/campaigns 列表行加 Match KOL CTA**（链到 `/match?campaignId=<id>`）保留"活动 → 匹配 KOL"心智桥
6. **/insight QuickActions** 由 4 → 3 按钮（删 campaigns 冗余，sidebar 已有一级入口）

## Rationale（理由）

### 4 动词 + 1 名词的 IA 设计取舍

5 路由不是"加路由 = 更复杂"。反过来，强行 4 动词反而让 /match 这个动词路由被迫双重身份（KOL 池 + 活动上下文），违反「每条路由一个核心 noun」原则。

- **Brief**（动词，输入）：产品定义 + AI 草拟活动 brief
- **Campaigns**（名词，资产）：活动列表 + 状态追踪（新增）
- **Match**（动词，发现）：KOL 池 + 智能匹配
- **Reach**（动词，触达）：邮件 + tracking + CRM
- **Insight**（动词，回顾）：ROI + analytics + 周报

5 条 nav 总长 ≤ 30 字符（en）/ 12 字符（zh），sidebar 视觉容量充足。

### 顺序 Lock B 选择

3 候选顺序：

- **A**：`Brief → Match → Campaigns → Reach → Insight`（活动夹在 Match 之后）
- **B**：`Brief → Campaigns → Match → Reach → Insight`（活动在 Brief 之后，**已选**）
- **C**：`Campaigns → Brief → Match → Reach → Insight`（活动在最前）

选 B 的理由：
- 时序符合实际工作流：写 brief → 查/选活动 → 为活动匹配 KOL → 触达 → 看效果
- A 把 Campaigns 夹在两个动词之间，视觉断节
- C 让 brief 失去"输入"起点位置，破坏教学性

## Alternatives Considered（备选方案）

### 方案 A: 保留 ADR-013 4 路由，强化 /match sidebar 活动列表（已拒绝）

- 描述：在 /match 左侧加"活动列表" sidebar，点击切换 campaignId 上下文，不动 NAV_ITEMS
- 拒绝理由：
  - 活动是名词资产，被 /match 这个动词路由当 sidebar 内容，URL 不对称（无 `/campaigns` 直链）
  - sidebar 视觉拥挤（filter + activeFilters + 活动列表 + KOL 卡）
  - 不解决"用户找不到活动列表"的核心反馈

### 方案 B: 5 路由（已选择 ）—— 见 Decision 段

### 方案 C: 6 路由，加 `/kols` 作为第 6（已拒绝）

- 描述：把 KOL 也独立一级 nav，6 条
- 拒绝理由：
  - KOL 池是 Match 动词路由的核心 content，不是独立名词资产
  - 6 条 sidebar 高度临近 viewport 上限（在 1280×720 笔记本上可能要滚动）
  - 用户没反馈过"找不到 KOL"，是过度响应

## Consequences（后果）

### 正面

- marketer 心智模型 + IA 对齐（活动是 first-class 资产）
- /match 工作台职责清晰（KOL 池 + AI 匹配，不双重身份）
- 活动列表入口从 2 步缩到 1 步（sidebar 直链）
- 5 路由教学性仍强（4 动词 + 1 名词，覆盖工作流 5 段）

### 负面

- 5 nav 比 4 nav 略多视觉负担（影响轻微，sidebar 容量充足）
- /insight QuickActions 4→3 短期可能让一些用户找不到"campaigns 快捷入口"（但 sidebar 一级 nav 是替代品，文档化即可）
- ADR-013 §"顶层 IA 重做" 部分被 supersede，未来阅读 ADR-013 必须读到底部 marker 才知道

### 中性

- e2e 测试 nav 数量断言由 4 → 5（regression test 一次性更新）
- visual baseline regen 一次（sidebar 视觉变化）
- nav-config.ts 改动表面小（加 1 条 entry + 删 1 条 path-rewrite fallback），实际影响面 ≤ 10 个测试文件

## Implementation（落地）

由批次 **BL-074-ia-v2** 实施（spec：`docs/specs/BL-074-ia-v2-spec.md`），6 features：

- **F001**：NAV_ITEMS 4→5 + path-rewrite + i18n 5 locale + manifest 含 `campaign` icon
- **F002**：/campaigns CampaignsTable 每行加 Match KOL CTA 按钮（链 `/match?campaignId=<id>`）
- **F003**：/insight QuickActions 4→3（删 campaigns 冗余）
- **F004**：本 ADR-015 起草 + ADR-013 顶部加 Superseded marker + docs/adr/README.md 索引同步
- **F005**：e2e nav 测试由 4 → 5 条 + visual baseline regen
- **F006**：Codex Reviewer L1+L2 + signoff doc 终签

预估工时：~11h（Generator 8.5h + Reviewer 2h）。

## References（引用）

- **Specs**：`docs/specs/BL-074-ia-v2-spec.md`（spec 全文 + 4 子决策 lock）
- **Audit**：`docs/test-reports/BL-073-prod-hotfix-audit-2026-05-26.md` §1 #3（用户反馈触发点）
- **相关 ADR**：
  - **ADR-013**（被 supersede §"顶层 IA 重做"部分）：AI Native 转向 + 4 路由 IA + 删 KOL "saved pool"
  - **ADR-006**：Pre-Impl Audit → Planner Adjudication 模式（本 ADR 起草前已遵循）
- **相关 commit**（待 BL-074 实施落地后更新）：
  - NAV_ITEMS 改动 commit（TBD）
  - /campaigns Match CTA commit（TBD）
  - QuickActions 4→3 commit（TBD）

## Notes

### 后续审视触发条件

如未来出现以下情况，应重新评估本 ADR：

1. 用户反馈"5 nav 太多，sidebar 视觉拥挤"（统计支持后考虑折叠 reach/insight）
2. /campaigns 流量低（< 5% 用户每月访问），说明活动名词不再是高频资产
3. Phase 5 加入"模板库 / 个性化学习"等新名词资产，需重新做 IA scope

### 与 ADR-013 的关系

ADR-013 三大决议：
1. AI Native 转向 — 保留 ✓
2. 删 KOL "saved pool" — 保留 ✓
3. 顶层 IA 4 路由 — **本 ADR supersede**，改为 5 路由

ADR-013 文件顶部应加 1 行 marker 指向本 ADR，body 保持完整（历史价值），但读者应理解 §3 已被新决议替换。
