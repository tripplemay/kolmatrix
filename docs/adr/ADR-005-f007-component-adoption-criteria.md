# ADR-005: F007 §11.2 Component Adoption Criteria

## Status

**Accepted**

- 日期：2026-04-19
- 作者：Kimi（裁决）+ johnsong（发现问题 + 争议）
- 相关批次：B0 F007 Dashboard / 所有需要 "使用 F010 组件" 的后续批次

## Context

B0 spec 在两处对"Dashboard 必须使用 F010 12 个公共组件"做出陈述：

**§F007 实现段（初版 v1）：**
> 必须使用 F010 抽出的公共组件（`StatCard` / `KolCard` / `CampaignRow` / `AiScoreBadge` / `GlassPanel` / `GradientButton` / `TagChip` / `AvatarWithPlatformBadge` / `ActivityFeedItem` / `SectionHeader`），不允许在 page.tsx 内 inline 写同等视觉的 div

**§F007 Acceptance 段（v1）：**
> page.tsx 必须 import 并使用全部 12 个公共组件（grep 验证）

F007 pre-impl 审计时 johnsong 发现两个问题：

1. **实际的组件使用边界**：`TagChip` / `AvatarWithPlatformBadge` / `AiScoreBadge` 这些组件**天然是 `KolCard` 内部消费的子组件**。page.tsx 中不会直接渲染它们。
2. **强求顶层直接 import**会逼出**虚引用**：
   ```tsx
   import { TagChip, AvatarWithPlatformBadge, AiScoreBadge } from "@/components/common";
   void TagChip; void AvatarWithPlatformBadge; void AiScoreBadge;  // 仅为 grep 通过
   ```
   这违反了**同段 "不允许在 page.tsx 内 inline 写视觉" 的精神本意**（防止重写视觉）。

关键问题：**"使用 12 组件" 的合理验证口径是什么**？

## Decision

**采用三条联合防线（§11.2 口径）：**

```
(1) page.tsx 直接 import ≥5 个真实顶层使用的 F010 组件
(2) Dashboard 渲染树中 12 个 F010 组件全部出现
    （直接 page.tsx 或间接经 KolCard / KpiRow 等封装引入都算）
    —— 通过 import 图静态分析验证
(3) page.tsx 内不允许 inline 写 card / button / chip / header 视觉片段
    （静态 grep 检查，无 <div className="... rounded-xl ... border ...">
    等直接仿组件样式的写法）
```

**验证手段：**
- 步骤 1：`grep -E "^import.*from ['\"]@/components/common['\"]" page.tsx | grep -oE "\{[^}]+\}" | ... | grep -cE "\w+"` ≥ 5
- 步骤 2：人工追踪 import 链 + `grep -rE "from ['\"]@/components/common['\"]" src/app/.../dashboard src/features/dashboard src/components/common` 汇总去重
- 步骤 3：`grep -rE '<div[^>]*className="[^"]*rounded-(xl|lg)[^"]*(border|shadow)' page.tsx` 命中 0

**附加：** `page.tsx` JSX 总长度 ≤ 80 行（强制拆到 features/dashboard/ 子组件）。

## Consequences

### 正面

- **尊重组件化逻辑：** TagChip 天然在 KolCard 内部使用，不需要强拉到顶层
- **仍然防止 inline 重写：** 第 3 条防线严格 grep 检查
- **保证组件库真正被用：** 第 2 条防线要求渲染树全覆盖（检查 import 图）
- **直接顶层 ≥5：** 第 1 条防线保证 page.tsx 不是"空壳"

### 负面

- **Reviewer 验证复杂度增加：** 不是 "page.tsx grep 数" 一步搞定，需要 import 图静态分析
- **解释成本：** 新 agent 需要理解为什么不是 "12 直接 import"
- **边界争议：** 什么算 inline 仿组件？例如 `<div className="rounded-lg">` 没有 border 算不算？（定义是 rounded + (border or shadow) 组合）

### 中性

- 完全消除了 Planner 规则冲突（见 ADR-006 P3：修 acceptance 必须扫全文）
- 实操 B0 F007：page.tsx 直接 import 5（KolCard/GlassPanel/SecondaryButton/GhostButton/SectionHeader），渲染树 12/12，0 inline，71 行 ≤ 80 ✓

## Alternatives Considered

### 方案 A（原 spec 字面版，12 直接 import，已拒绝）

page.tsx 必须 import 全部 12 个组件（grep 验证）。

- **拒绝理由 1：** 逼出 `void TagChip` 虚引用，违反 "不 inline 重写" 本意
- **拒绝理由 2：** page.tsx 人为膨胀，违反 "JSX ≤80 行" 约束
- **拒绝理由 3：** 破坏组件化单一职责（TagChip 本就是 KolCard 内部子组件）

### 方案 C（完全放开，只要运行时存在，已拒绝）

不限制 page.tsx 直接 import，只要 Dashboard 最终渲染用到 12 组件即可。

- **拒绝理由 1：** 没有直接 import 下限，page.tsx 可以退化为空壳
- **拒绝理由 2：** "不允许 inline" 检查依然需要，单这一条不够

## References

- **Commits：** 
  - `2937c28`（F007 pre-impl 裁决 §11.2 引入）
  - `0ddd72e`（F007 signoff 争议仲裁 —— 选 A 确认 §11.2 为权威）
- **Specs：**
  - `docs/specs/B0-foundation-spec.md` §F007 Acceptance
  - `docs/specs/B0-f007-dashboard-plan.md` §11.2
  - `docs/specs/B0-f007-signoff-dispute.md` §9 仲裁段
  - `docs/test-cases/B0-foundation-test-cases.md` TC-L1-003（新口径验证步骤）
- **相关 ADR：**
  - ADR-003（视觉标准）
  - ADR-004（F010 组件库锁定）
  - ADR-006（pre-impl 审计 pattern，本决策是该 pattern 的典型应用）

## Notes

### F007 signoff 争议教训

本 ADR 的诞生伴随一次 Reviewer 按旧口径判 PARTIAL 的签收争议。根因是 Planner 修订 §11.2 新 Acceptance 段时**忘记同步 §F007 实现段**，两段描述冲突，Reviewer 按字面理解旧段判 fail。

争议仲裁（`B0-f007-signoff-dispute.md` §9）：Planner 承认责任，修订消除矛盾。由此 Planner 铁律 P3 诞生（见 ADR-006）：**修 acceptance 必须 grep 扫全文**。

### 口径适用边界

本口径仅适用于 **"强制使用组件库"** 语境（如 F007 对 F010）。其他场景：
- 纯工具函数的 "必须使用" → 直接 import（无 wrapper 概念）
- 非硬性要求的 "建议使用" → 不需要此口径

### 重新评估触发条件

- F010 组件列表变化（扩展 / 裁减）→ 可能影响 "≥5 直接" 基数
- 发现某个组件有更好的组织方式（如合并到页面层）→ 可能修订规则
