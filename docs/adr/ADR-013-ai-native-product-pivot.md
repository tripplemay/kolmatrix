# ADR-013: AI Native 产品转向 — 顶层 IA 重做 + 删除 KOL "saved pool" 概念

## Status

**Accepted**

- 日期：2026-05-10
- 作者：用户 + Planner johnsong（联合决策）
- 相关批次：BL-061 收口后触发；后续 BL-063 → BL-070+ 全系列依赖

## Context（背景）

### 触发事件

2026-05-10 BL-060 + BL-061 收口后用户实地访问 prod，报告 `/campaigns/[id]` 详情页"添加 KOL"按钮 disabled。

Planner 调查根因链：
1. `CampaignKolPanel.tsx:77` disabled 条件 = `locked || available.length === 0`
2. `available` 来自 `runAvailableKolsForCampaign` (`src/lib/campaigns/detail.ts:209`) query: `WHERE isSaved=true AND deletedAt IS NULL`
3. prod SQL 实测：marketer tenant `2b1d...3d5` `is_saved=true AND deleted_at IS NULL` = **0**
4. → available=[] → button disabled

表面是 bug 修复或 UX 优化问题，深挖后发现是**产品架构层面问题**。

### 当前架构的设计包袱

KOLMatrix 现有 KOL 数据流是三层：

```
[apify-kol 数据源]
   ↓
/discovery (read-only 浏览，apify-kol 单源)
   ↓ 用户手动 "保存" 标 isSaved=true
/database (saved KOL 池)
   ↓ 用户手动 "添加到 campaign"
/campaigns/[id] AddKolDialog (从 saved pool 选)
```

这是 yt 时代（KOL 数据稀缺、需要手工采集和验证）的设计：
- 那时候 saved pool 是必要的（你能加到 campaign 的池 vs 还没收的池）
- 那时候 AI 只是辅助筛选

但 5/9 BL-059 切换到 apify-kol 单源 + BL-023 4 维度 valueScore 算法 + AiSuggestionsClient 已铺底层之后：
- 全量 KOL 池本身就是"可加到 campaign 的池"
- AI 评分已经能为 campaign 自动排序候选
- "isSaved" 这个字段成了**心智冗余**

### 用户实地反馈触发产品反思

用户原话："KOL 数据库这一层其实多余了，从用户心智来说，应该是录入产品 → 创建活动 → 在全量 KOL 中由 AI 添加合适的 KOL → 启动触达"。

这暴露了根本矛盾：**当前产品是"工具 + AI 辅助"架构，但用户心智期望的是"AI 主导 + 工具托底"架构**。

### 不决策的后果

- "添加 KOL 按钮 disabled"是表层告警，每个新用户上手都会撞到
- 1B/1C 等渐进方案虽然能修标但治不了本（仍保留 saved pool 心智）
- 5/13 上线对外仍是"普通 SaaS 加了 AI"的市场定位 — 错失差异化窗口
- 后续每个产品迭代仍受 saved pool / 三层心智约束，长期技术债持续累积

## Decision（决策）

**KOLMatrix 产品架构 pivot 为 AI Native，按 1A + A3 + B3 + C3 路径重构。**

具体动作：

1. **顶层 IA 重做** — 7 路由 → 4 路由：
   - **Brief**（产品 + 活动 = AI context source）— 现 KB + Campaigns/new 合并
   - **Match**（AI 推荐工作台）— 现 Discovery + Database + Campaign KOL panel 合并
   - **Reach**（触达执行）— 现 Outreach 大体保留
   - **Insight**（数据/反馈/优化）— 现 Dashboard + Reports 大体保留

2. **彻底删除 KOL "saved pool" 概念** — `isSaved` 字段从 schema 删除（migration），全量 KOL 池就是 campaign 加 KOL 的来源；`/database` 路由消失（redirect 到新 /match）。

3. **AI 是 protagonist 不是 sidekick** — Campaign 创建后 AI 自动扫描全量池预生成候选名单；用户在 campaign 详情页**审阅 AI 推荐**而非自己挑选。

4. **AI 交互形态选择 B3 混合**：默认结构化面板（filter + AI 排序）+ 自然语言 refine 作 escape hatch（"减少 micro tier，多加女性游戏受众"）。

5. **AI Explainability 选择 C3 双向**：每个推荐 KOL 附 1 句话"为什么"（命中哪些 4 维度信号）+ 用户可主动 query AI 详细解释。

6. **5/13 上线 deadline 取消** — 产品体验是硬约束，时间不是。重构周期 6-10 周，预计 2026-06-21 ~ 2026-07-19 范围对外。

7. **分 Phase 拆 BL-063 → BL-070+ 批次系列**（详见 `docs/product/ai-native-roadmap.md`）。

## Consequences（后果）

### 正面

- **真正差异化的 AI native 产品**：marketer 体验从"哦这是个 AI 加了的 SaaS"变成"哦这真的是 AI 来主导的工具"
- **用户心智简化**：3 层 KOL 概念（discovery / database / campaign）→ 1 层（全量 KOL 池 + AI 推荐）
- **AI 价值真正落地**：当前 AiSuggestionsClient + SmartMatchDialog 沦为侧栏功能，重构后 AI 推荐成为 campaign 工作流主面板
- **顶层 IA 砍到 4 路由**：marketer 学习曲线大幅下降
- **解决长期技术债**：isSaved 字段已是 9+ 处 query 的 filter（BL-060 加固过），删除后未来所有 KOL query 简化
- **未来扩展能力**：B3 自然语言 refine + C3 explainability 是后续 AI 个性化、conversational onboarding、campaign brief 智能生成的基础

### 负面

- **6-10 周重构投入** — Generator + Reviewer 工时显著（粗估 ~30-40 person-day）
- **5/13 上线 deadline 取消** — 错过原计划的 5/13 对外推广窗口（buffer 4 天）
- **schema migration + 数据迁移** — `is_saved` 字段删除（or 重命名 `is_starred` 个人收藏），需要 migration script + prod 数据评估
- **e2e suite 大量 break** — 现 7 路由的 e2e spec 全部需要 redo，UI 改动面极大
- **i18n 大量重做** — 5 语言的现有路由 keys 需要梳理 + 新路由 keys 增量
- **现 BL-054/BL-056/BL-062 等 backlog 优先级重新排** — 与新 phase 系列协调

### 中性

- **prod 现产品冻结**（重构期间）— 内部 demo 团队仍用现产品做 dogfood，不接新外部客户
- **每个 Phase 完成都需 prod redeploy** — 不能等 6-10 周一次性发，需要分批 promote 让团队能逐 phase 验证
- **BL-048 valueScore 区分度优化提前到 Phase 2** — 是 AI 推荐质量的核心 input，不能延后
- **BL-062 数据 coverage 治理（fork team profile schedules / weekly growth-curve）继续走** — 与 AI native 重构平行，AI 推荐质量依赖 KOL 数据完整度

## Alternatives Considered（备选方案）

### 方案 1A（已选择 — 见 Decision）

彻底删 `/database` + AI native 重构。配合 A3 (4 路由 IA) + B3 (混合 AI 交互) + C3 (双向 explainability)。

### 方案 1B（已拒绝）：合并 /database + /discovery + isSaved 重定位为收藏

合并两路由为统一"KOL 库"页（保留 /discovery 作主入口），isSaved 字段保留但语义重定位为"⭐ 个人收藏"。Campaign AddKolDialog `available` 来源改为全量未 link KOL + AI 排序。

**拒绝理由：**
- 不够 AI native — 仍保留"挑选 KOL 添加到 campaign"的工具式心智
- 仍有 7 路由 + 3 层 KOL 概念（discovery/库/campaign），用户认知负载没减
- 中量重构 ~3-5 day，但只解 50% 问题
- 1B 是过渡态，6-10 周后还要再重构到 AI native — 不如一次到位

### 方案 1C（部分采纳作 hotfix）：5/13 前 hotfix + 后续 1B 重构

5/13 前 hotfix `detail.ts:209` 去 isSaved filter（30min Generator）+ AddKolDialog tooltip。

**部分采纳：** 重构期间内部 demo 流畅性需要 unblock，可考虑跑这个 30min hotfix 让团队成员（dogfood）能用现产品到 Phase 1 完成。但**不作为终态方案**。

### 方案 A2（已拒绝）：中版 AI native（合并部分页面，保留 7 路由）

合并 Discovery + Database 为 /match，campaign 详情页重写。砍到 5 路由。

**拒绝理由：**
- 仍保留 7 路由概念（Dashboard + Match + Campaigns + KB + Outreach + Reports + ?），用户没看到顶层 IA 简化
- AI 在 KOL workflow 是主角但其它 workflow（campaign 创建 / outreach 触达）仍是工具式，体验不一致
- 不彻底，未来仍要再砍

### 方案 D1（已拒绝）：5/13 用现架构上线 + 后续重构

5/13 仍按计划上线现架构 + 后续 4-8 周冲刺 AI native 重构。

**拒绝理由：**
- 上线时被对外评价为"普通 KOL 工具加了 AI"，错过差异化窗口
- 早期客户养成现架构使用习惯后，迁移到 AI native 需要重新培训成本
- 对外推广 + 用户反馈 + 真客户使用产生大量数据 → 重构期间需要兼容老数据 → 工程复杂度不降反升
- 用户对 AI native 的产品体验信心比 5/13 时间表更重要

### 方案 D2（已拒绝）：延期 5/13 + 不做小 hotfix

完全延期 5/13 + 重构期间不动现产品。

**拒绝理由：**
- 内部团队 dogfood 阻塞（"添加 KOL 按钮 disabled"问题影响日常测试）
- 30min 投入换 6-10 周内的内部使用流畅度，ROI 极高，且与 1A 方向一致不做白工

### 方案 X（已拒绝）：不动产品 / 仅修 button disabled

仅做 1B/1C 的局部 UX 修复，不动产品方向。

**拒绝理由：**
- 不解决根本心智矛盾 — 用户每次都要先想"我要先去 /database 保存"
- 长期产品差异化弱
- AI native 是市场对 KOL 工具品类的下一个期待，被动等待会被竞品抢先

## References（引用）

- **触发事件 commits：** `BL-061 收口 @ 7e99e53` + 用户报告"添加 KOL 按钮 disabled" / Planner 调查 commits
- **本会话决策 commits：** （Phase 0 commit pending — 见后续提交）
- **Vision spec：** `docs/product/ai-native-vision.md`（4 路由 IA 详解 / 5 关键交互场景 / 用户旅程 / mockup）
- **Roadmap：** `docs/product/ai-native-roadmap.md`（BL-063 → BL-070+ 拆分 / 依赖关系 / 工时）
- **相关 ADR：**
  - **ADR-007** Multi-tenant RLS 策略 — 重构期间 schema migration 需保护 RLS
  - **ADR-009** aigcgateway 集成 — AI native 依赖的 LLM 调用层（B3 自然语言 refine + C3 explainability 都走 aigcgateway）
  - **ADR-011** Unified asset table vs typed tables — Asset 模式延续到新 IA
  - **ADR-012** Assets UX redesign outreach-first — 前期的 outreach-first 思路在新 Reach 路由保留
- **关联 backlog：**
  - **BL-048** valueScore 区分度优化（提前到 Phase 2 — AI 推荐质量核心依赖）
  - **BL-062** 数据 coverage 治理（与重构平行 — fork team profile schedules / weekly growth-curve）
  - **BL-054** flaky network test isolate（重构期间 e2e infra 同步整理）
  - **BL-056** notifications 真化（post AI native 重构）
- **外部参考：**
  - Cursor / v0 / Lovable / Linear AI / Notion AI / Perplexity 等 AI native 产品交互模式

## Notes（可选）

### 重新评估触发条件

以下任一情况发生需重新评估本 ADR：

1. **Phase 4 完成后回顾**（预计 2026-07 中下旬）：AI 推荐用户接受率 < 40% / 自然语言 refine 使用率 < 10% / 用户反馈"AI 不准我还是想自己挑" → 评估是否回退部分到工具式
2. **重构进度严重落后**（如 Phase 1 用了 6 周以上）：评估是否拆出"Brief + Match" 提前上线 vs 全量 4 路由完成再上线
3. **市场出现强差异化竞品采用类似 AI native 路径**：评估是否需加速或调整差异点

### 后续跟进项

- 见 `docs/product/ai-native-roadmap.md` Phase 1-4 拆分
- 重构期间每个 BL- 批次完成后增量更新本 ADR References 的 commits
- 重构完成后回写"Phase 4 复盘"段落到本 ADR Notes

### 决策非典型性

本 ADR 是 KOLMatrix 项目至今**最大的产品方向决策**（前 12 个 ADR 均为单点架构 / 流程决策），影响整个产品 IA 和 6-10 周后的所有批次。新 agent 上手必读。
