# ADR-004: F010 Component Library Lock (12 Components)

## Status

**Accepted**

- 日期：2026-04-18
- 作者：用户 + Kimi（Planner）+ johnsong（F010 审计）
- 相关批次：B0-foundation F010（定义）+ F007（复用）/ 所有 UI 批次

## Context

B0 初版 spec 只要求 F005 App Shell 组件（Sidebar/Topbar）。其他公共元素（KPI 卡 / KOL 卡 / 玻璃徽章 / 渐变按钮 / 标签 chip / 头像+平台徽标等）**没有强制要求抽组件**。

用户在 pre-impl 审计阶段提出两个关键要求：
1. **代码级还原**（已在 ADR-003 解决）
2. **公共组件抽取 + 每页使用公共组件**（本 ADR 解决）

Generator 按跨页比对发现共需 12 个高复用组件（详见 `docs/specs/B0-f010-component-map.md` §2 矩阵）：

| 组件 | 跨页命中 |
|---|---|
| GlassPanel / SectionHeader / GradientButton / GhostButton | 7/7 页 |
| StatCard / AiScoreBadge / AvatarWithPlatformBadge / SecondaryButton | 6/7 页 |
| KolCard | 5/7 页 |
| TagChip | 4/7 页 |
| CampaignRow | 3/7 页 |
| ActivityFeedItem | 3/7 页（含 Dashboard） |

## Decision

**采用 "12 组件硬锁"策略：**

- `src/components/common/` 下**固定 12 个组件**：StatCard / KolCard / CampaignRow / AiScoreBadge / GlassPanel / GradientButton / SecondaryButton / GhostButton / TagChip / AvatarWithPlatformBadge / ActivityFeedItem / SectionHeader
- F010 acceptance 显式锁死这 12 个名单，不允许扩展
- 每个组件 ≤100 行，props interface 完整，文件头含注释
- 页面专属组件（如 KpiRow, AiMatchRingCard, EmailPerformanceCard）放在 `src/features/{feature}/`，不进 common/
- 色彩走 Tailwind token，禁止硬编码 HEX

**barrel export：** `src/components/common/index.ts` 统一导出 12 个组件。

**触发条件 → 扩展规则：**
- 新页面用到新视觉元素 → 先检查是否可用现有 12 组件满足（变通 props / variant）
- 确实无法复用 → 放 `features/{page}/` 作为页面专属
- 发现 3+ 页重复 → 起独立 ADR 讨论扩入 `common/`（不在 batch 里静悄悄加）

## Consequences

### 正面

- **防止组件膨胀：** `common/` 不会累积成 50+ 个半死不活的组件
- **强制抽象思考：** 遇新视觉时优先考虑复用（props / variant）
- **页面开发提速：** 后续业务批次直接 import，不重写
- **视觉一致性：** 12 组件样式统一，全产品视觉语言一致
- **组件库维护成本可控：** 12 个组件熟悉后成本低，不像 50+ 会失控

### 负面

- **变通成本：** 某些场景强推现有组件 variant 可能丑陋，不如单写
- **ActivityFeedItem 使用率偏低：** 仅 3/7 页用，F010 审计时讨论过要不要裁掉
- **页面专属组件边界争议：** 什么算"足够通用"进 common？（用 "3 页使用" 作为门槛）

### 中性

- Dashboard 不要求直接 import 12 个（见 ADR-005）
- F010 的 12 组件列表在 B0 完成时视为"定稿"，后续需要走 ADR 流程扩

## Alternatives Considered

### 方案 A（开放扩展，已拒绝）

`common/` 下任意组件数量，按需增加。

- **拒绝理由 1：** 没有硬锁导致半年后可能堆到 30+ 组件（很多只 1-2 页用）
- **拒绝理由 2：** 没有门槛 → 容易把页面专属组件误放 common
- **拒绝理由 3：** 用户要求"防止每页手写"—— 宽松扩展反而鼓励不思考就新建

### 方案 B（限定 10 核心，已拒绝）

只保留 10 个跨页 ≥5 的组件（移除 TagChip / CampaignRow / ActivityFeedItem）。

- **拒绝理由 1：** 这 3 个虽然使用率 3-4/7 页但依然是视觉一致性的基础
- **拒绝理由 2：** 删除后这些组件分散在页面代码里，仍然会重复
- **拒绝理由 3：** 10 vs 12 的差距不大，12 已在 B0 spec 声明不便频繁调整

### 方案 C（单组件 split 成多个，已拒绝）

如 KolCard 拆 KolCardGrid / KolCardRow 两个组件。

- **拒绝理由 1：** F010 名单已锁 12 个，拆分违反硬锁
- **拒绝理由 2：** variants 是标准模式，内部 70% 结构共享，拆分反而违反 DRY
- **通过 F010 审计 §5 #2 裁决：** 采用 `variant: "grid" | "row"` prop 切换

## References

- **Commits：** `c30fcea`（B0 v2 F010 引入）/ `1457a96`（F010 12 组件实现）/ `e5f3229`（F010 裁决）
- **Specs：** 
  - `docs/specs/B0-foundation-spec.md` §F010
  - `docs/specs/B0-f010-component-map.md`（pre-impl 审计详细分析）
- **相关 ADR：** 
  - ADR-003（视觉标准驱动本决策）
  - ADR-005（F007 如何"使用"这 12 组件的口径）

## Notes

### 扩展新组件的流程

- 新业务批次发现跨 3+ 页共用的新视觉元素
- Planner 起草新 ADR `ADR-0XX-common-library-expansion.md`
- 说明：为什么现有 12 个不够 + 新组件 props / 复用矩阵
- 用户确认后扩入 `common/`

### 重新评估触发条件

- 积累 3+ 个 "明明该进 common 但没进" 的案例（说明锁定过严）
- 某个组件 B5+ 只用 1 页（说明锁定时判断错误，可废弃）
- 业务方向大变（如从 B2B SaaS 转 B2C，视觉体系重建）
