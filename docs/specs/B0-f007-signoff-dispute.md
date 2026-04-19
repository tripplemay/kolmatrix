# B0 F007 · Signoff 口径争议仲裁请求

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-19
> **触发：** Reviewer 第 2 轮复验（docs/test-reports/B0-foundation-reverify-2026-04-19.md）判 F007 **PARTIAL**，其他 11 项全 PASS；争议焦点是 F010 12 组件"复用"的认定口径
> **状态：** 等待 Planner 明确裁决，**未收到前 B0 sprint 停在 fixing/verifying，不进第 3 轮复验**

---

## 1. TL;DR

B0 sprint 10/10 features 全绿，唯 F007 因"12 组件是否必须 page.tsx 直接 grep 可见"解释不同，Reviewer 判 PARTIAL 阻断签收。请 Planner 在 3 个选项里仲裁（§6）。

---

## 2. 事实清单

### 2.1 Reviewer 第 2 轮复验结论（docs/test-reports/B0-foundation-reverify-2026-04-19.md §未通过项）

> F010/F007 强约束未满足：
> 1. `src/app/[locale]/(app)/dashboard/page.tsx` 行数已满足（71 行）
> 2. 但页面未覆盖全部 12 个 F010 组件（按页面代码直接核验缺失）：
>    `StatCard` / `CampaignRow` / `AiScoreBadge` / `GradientButton` / `TagChip` / `AvatarWithPlatformBadge` / `ActivityFeedItem`

Reviewer 处理建议：
> 若项目接受"通过组合组件间接复用 F010"，**需由 Planner 明确修订 B0 验收口径**（从"page.tsx 直接可 grep 全量"改为"渲染树可追踪复用"）。
> 若保持现口径不变，则 Generator 需补齐页面级可验证复用证据（或实现调整）后再复验。

### 2.2 当前 spec 文案同时包含两段不一致表述

**`docs/specs/B0-foundation-spec.md` §F007 实现段**：
> 必须使用 F010 抽出的公共组件（`StatCard` / `KolCard` / `CampaignRow` / `AiScoreBadge` / `GlassPanel` / `GradientButton` / `TagChip` / `AvatarWithPlatformBadge` / `ActivityFeedItem` / `SectionHeader`），不允许在 page.tsx 内 inline 写同等视觉的 div

**`docs/specs/B0-foundation-spec.md` §F007 Acceptance 段**（Kimi §11.2 裁决修订，2026-04-19）：
> **F010 12 组件接入口径**（F007 裁决 §11.2 修订，2026-04-19）：
> 1. page.tsx 直接 import **≥5 个**真实顶层使用的 F010 组件
> 2. Dashboard 渲染树中 **12 个 F010 组件全部出现**（直接 page.tsx 或间接经 KolCard 等封装引入都算）——通过 import 图静态分析验证
> 3. page.tsx 内**不允许** inline 写 card / button / chip / header 等视觉片段（静态 grep 检查无 `<div className="... rounded-xl ...">` 等直接仿组件样式）

**`features.json` F007 acceptance** 已同步 §11.2 新口径（commit `2937c28`）。

### 2.3 Generator 当前实现状态

- `src/app/[locale]/(app)/dashboard/page.tsx`：**71 行 / JSX 30 行**（≤80 ✓）
- 直接 import 的 F010 组件：`KolCard` / `GlassPanel` / `SecondaryButton` / `GhostButton` / `SectionHeader` = **5 个**（≥5 ✓）
- 渲染树 import 图覆盖：

| # | F010 组件 | 在 page.tsx 直接 | 间接路径 |
|---|---|---|---|
| 1 | StatCard | - | page.tsx → `KpiRow` → `StatCard` |
| 2 | KolCard | ✅ | — |
| 3 | CampaignRow | - | page.tsx → `ActiveCampaignsSection` → `CampaignRow` |
| 4 | AiScoreBadge | - | page.tsx → `KolCard` → `AiScoreBadge` |
| 5 | GlassPanel | ✅ | 也由 `EmailPerformanceCard` + `RecentActivityCard` 间接消费 |
| 6 | GradientButton | - | page.tsx → `GreetingBar` → `GradientButton` |
| 7 | SecondaryButton | ✅ | — |
| 8 | GhostButton | ✅ | 也由 `ActiveCampaignsSection` 间接消费 |
| 9 | TagChip | - | page.tsx → `KolCard` → `TagChip` |
| 10 | AvatarWithPlatformBadge | - | page.tsx → `KolCard` → `AvatarWithPlatformBadge` |
| 11 | ActivityFeedItem | - | page.tsx → `RecentActivityCard` → `ActivityFeedItem` |
| 12 | SectionHeader | ✅ | 也由 `ActiveCampaignsSection` + `EmailPerformanceCard` + `RecentActivityCard` 间接消费 |

**12/12 全覆盖 + ≥5 直接 = 按 §11.2 新口径完全满足。**

### 2.4 为什么 Reviewer 仍判 PARTIAL

Reviewer 采纳了 §F007 实现段的字面理解（"必须使用" = "必须 page.tsx 直接 grep 全量"），没有执行 Acceptance 段的 §11.2 新口径（"间接通过 KolCard 等封装引入都算"）。

> "按 B0 规格'Dashboard 强制复用 12 个组件（可 grep 验证）'这一硬性口径，仍判定未通过。"

---

## 3. 口径冲突的设计原因

当初 §11.2 修订的起因（F007 pre-impl 审计发现）：

- **强求 page.tsx 顶层直接 import 12 个 F010 组件**会导致无意义的虚引用：
  ```tsx
  import { TagChip, AvatarWithPlatformBadge, SecondaryButton } from "@/components/common";
  void TagChip; void AvatarWithPlatformBadge;  // 仅为 grep 通过
  ```
  这违反了同段 "不允许在 page.tsx 内 inline 写同等视觉的 div" 的**精神本意**（防止页面重写视觉，强制 F010 实际出现在渲染树）。

- **正确的组件化逻辑**：TagChip 天然在 KolCard 内部使用；AvatarWithPlatformBadge 同；AiScoreBadge 同。把这些组件硬拉到 page.tsx 顶层反而破坏单一职责。

§11.2 的解：**"page.tsx 直接 ≥5 个（保证有真实顶层消费）+ 渲染树 12 全覆盖（保证组件库不漏）+ 不允许 inline 仿写（保证没绕过 F010）"**——这三条联合防线比"直接 12 硬 grep"更能实现"强制复用"的本意。

---

## 4. 原 spec 文案的内部矛盾

`B0-foundation-spec.md` §F007 有两段相互冲突的陈述：
- **实现段** 列 10 个组件（遗漏 `SecondaryButton` / `GhostButton`，总数其实是 12，此处表述已经不精准）
- **Acceptance 段** §11.2 明确说 "间接封装也算"

Reviewer 读第一段，按旧口径判 fail；Generator 按第二段实现并认为达标。**同一份文档里两段话指向不同方向，才有这次争议。**

---

## 5. 影响评估

| 指标 | 按 §11.2 新口径 | 按 Reviewer 旧口径 |
|---|---|---|
| 当前实现是否 PASS | ✅ | ❌ |
| JSX ≤80 约束 | 满足（30 行） | 若强求 12 直接 import，JSX 膨胀可能破 80 |
| 代码组件化 | 合理（KolCard 自含子组件） | 人为拉高顶层 import 数 |
| "不 inline 视觉片段"要求 | 同时满足 | 与"12 直接"有张力（push 向虚引用） |
| Reviewer 验证方式 | import 图静态分析（需看 children 关系） | 单文件 grep（简单直接） |

---

## 6. 3 个仲裁选项

| 选项 | 说明 | Generator 动作 | Reviewer 动作 |
|---|---|---|---|
| **A（推荐）** | 确认 §11.2 新口径 binding，正式更新 `B0-foundation-spec.md` §F007 **实现段**语言与 Acceptance 段一致（把 "必须使用 10 个" 改为 "12 组件按 §11.2 口径" + 同一处给出 Reviewer 可复制的验证命令） | 无代码改动 | 按新口径复验 TC-L1-003（当前实现已达标，应 PASS） |
| **B** | 推翻 §11.2，恢复"12 组件 page.tsx 直接 grep 可见"严格口径 | 重写 page.tsx：把 7 个间接组件改成直接 import 并在 JSX 顶层各渲染一次；可能需要把 Sidebar/KpiRow 等包装解开；预计 JSX 破 80 行，需要提高行数预算 | 按旧口径复验 |
| **C** | 给第 3 方案（例：设定直接 import 下限 7 或 10，余下仍可间接） | 按新下限调整 page.tsx（比如引入额外的 wrapper 让 7 个成为 page.tsx 直接使用） | 按新口径复验 |

**johnsong 倾向 A**。理由：
1. §11.2 是 F007 pre-impl 审计期 Planner 主动修订的结论，意图明确
2. features.json F007 acceptance 已是新口径
3. 当前 spec 第一段与第二段的矛盾是"没同步更新实现段"的遗留，Planner 补一次同步即可彻底消除歧义
4. 当前代码实现既满足"防 inline"又 12 组件全出现在渲染树，组件化清晰

如 Planner 选 B，请同时把 `page.tsx JSX ≤ 80 行` 放宽（预估 95-110）。

---

## 7. 请 Planner 回复格式

短格式：`#选项:A` 或 `#选项:B` 或 `#选项:C <具体下限>`

如选 A，请同步执行：
1. `docs/specs/B0-foundation-spec.md` §F007 **实现段** 改为引用 §11.2（消除双重表述）
2. `docs/test-cases/B0-foundation-test-cases.md` TC-L1-003 验证方式改为 import 图静态分析（不是 page.tsx 单文件 grep）
3. 通知 Reviewer 按新 test case 执行第 3 轮复验

---

## 8. 相关文档

- `docs/test-reports/B0-foundation-execution-2026-04-19.md` — Reviewer 首轮报告（FAIL）
- `docs/test-reports/B0-foundation-review-response.md` — Generator R1 回应
- `docs/test-reports/B0-foundation-reverify-2026-04-19.md` — Reviewer 第 2 轮（PARTIAL）
- `docs/specs/B0-f007-dashboard-plan.md` §11 — Kimi 原 F007 裁决含 §11.2
- `features.json` F007 acceptance — 已采纳 §11.2 新口径
- `docs/specs/B0-foundation-spec.md` F007 — 同时含旧表述（实现段）+ 新 §11.2（Acceptance 段），争议源
