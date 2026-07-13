# ADR-021: 前端视觉语言切换 — Horizon 紫色美学

## Status

**Accepted**

- 日期：2026-07-14
- 作者：用户直接决策 + Planner/Generator 落地
- 相关批次：BL-HORIZON-FE-PILOT（试点），影响所有后续 UI 批次
- 关系：**Amends [ADR-003](./ADR-003-pixel-perfect-visual-standard.md)**（像素级标准延续，参照基线重定）+ **Amends [ADR-004](./ADR-004-f010-component-library-lock.md)**（共享组件库视觉演进）

## Context

用户购买了付费 admin 模板 **Horizon UI Tailwind React NextJS Pro 3.0.0**，希望用它"重构 KOLMatrix 前端"。

Planner 做了可行性分析（2 个探索 agent 分别盘点两边）：

| 层 | KOLMatrix（现网） | Horizon 模板 | 兼容性 |
|---|---|---|---|
| 框架/路由 | Next 16 App Router + RSC + `[locale]` + 中间件鉴权 | Next 15 + `routes.tsx` 数组式 SPA | ❌ |
| 样式引擎 | Tailwind **v4** CSS-first `@theme` | Tailwind **v3** `tailwind.config.js` | ❌ |
| 组件库 | shadcn/ui（Radix）+ Material Symbols | 纯 Tailwind 183/215 + 7 Chakra 原语 + react-icons | ⚠️ |
| i18n | next-intl 5 语言 × 1783 key × 339 调用 | 无 | ❌ |
| 数据 | RSC + server actions + Prisma RLS | 纯客户端 mock | ❌ |

**结论：模板无法"直接套入"替换底座**——那等于在不兼容底座上重写整个应用，牺牲生产级 App Router/RSC/i18n/RLS。但 Horizon 的**视觉设计语言**（紫 brand `#422AFB` + navy 暗色 + 20px 圆角 + 柔和浮起阴影 + DM Sans/Poppins）以可移植的 Tailwind 形式交付，且两边同为 navy 暗色基底，气质不冲突。

关键决策问题：**是否用 Horizon 视觉语言替换现有 Neural Velocity（ADR-003/004 锁定的视觉契约）？**

## Decision

**采用"保留底座 + 重塑视觉语言"路径，试点先行：**

1. **保留 KOLMatrix 底座**：App Router + RSC + 5 语言 i18n + 多租户 RLS + shadcn + Tailwind v4，全部不动。
2. **视觉语言整体切换到 Horizon 紫色美学**（用户拍板）：紫 brand + navy 暗色卡 + 20px 圆角 + 柔和阴影 + DM Sans（正文）+ Poppins（标题），替换 Neural Velocity 的电流青（cyan `#00E5FF`）+ 玻璃拟态。
3. **additive token 策略**（可回滚）：Horizon token 作为**新增** `@theme` 条目引入 `globals.css`（`brand-*`/`navy-*`/`hz-*`/`shadow-hz-card`/`radius-hz-card`/`font-dm`/`font-poppins`），**不删** Neural Velocity token；试点面消费新 token，其余页保 NV，全量铺开批次再迁移+删旧。映射表见 `design-draft/horizon-tokens.md`。
4. **试点范围**（BL-HORIZON-FE-PILOT）：
   - 全局 App Shell（Sidebar/Topbar）
   - 旗舰页 `/insight` dashboard
   - **共享设计系统层**（`components/common/` 的 StatCard/KolCard/GlassPanel/SectionHeader/按钮等）——切换设计语言的自然含义就是重塑这些设计系统原语；它们波及用到它们的 ~5-7 页（推进全量铺开）
   - **不含**：其余 ~20 页的专属内容组件、登录/auth 页、landing 营销页（推迟到全量铺开批次）

### Amends ADR-003（像素级视觉标准）

**ADR-003 的像素级验收标准（间距 ±2px / 颜色 ΔE<2 CIE76 / 字号 100% / 布局结构 100% / 圆角阴影一致）继续生效**——严格度不降。仅**将参照基线从 Neural Velocity Stitch PNG 重定为 Horizon 新截图**（用户拍板）。ADR-003 的"色彩值必须走 Tailwind token、禁硬编码 HEX（globals.css 唯一例外）"硬约束继续生效。视觉回归基线由本批次 F005 经 `update-visual-baselines.yml`（Linux canonical）统一重生。

### Amends ADR-004（组件库锁定）

ADR-004 的"硬锁公共组件、页面专属放 features/"结构原则**继续生效**。本次是对这些锁定组件的**视觉重塑**（仅 className / 颜色 / 圆角 / 阴影 / 字体，**结构 / props / API 不变**），不是新增或推翻组件。共享设计系统层从 Neural Velocity 观感演进为 Horizon 观感。

## Consequences

### 正面
- 保住生产级 App Router/RSC/i18n/RLS 骨架，零重写风险
- 获得付费模板的成熟视觉语言（紫 brand + navy + 柔和阴影 + 现代字体）
- additive token → 试点可整体 revert，全量铺开可渐进
- 试点跑通"视觉 + i18n + 水合 + 基线"全链路，作为是否全量铺开的决策点

### 负面
- 全局外壳 + 字体 + 共享组件切换 → **所有 app 页视觉基线位移**，需全量重生（F005）
- 试点期新旧 token 并存 → `globals.css` 体积暂时增大；非试点页呈"旧内容 + 新外壳/共享组件"过渡态
- Neural Velocity 设计系统（Stitch Neural Velocity 原型 + design-system.md）与新观感脱节，需后续对齐

### 中性
- Stitch 原型重做**推迟**到全量铺开决策后；试点期设计真相源 = `design-draft/design-system.md`（更新）+ `design-draft/horizon-tokens.md` + Horizon 模板
- recharts 保留（ADR README 明示"用 recharts"是可替换实现细节，非 ADR 锁）；只借鉴 Horizon 图表卡视觉，不换 apexcharts

## Alternatives Considered

### 方案 A（保留 Neural Velocity，只局部借鉴，已拒绝）
- 只挑几个 Horizon 组件/布局移植，NV 主体不变。**拒绝理由**：用户明确要"整体切换到 Horizon 紫色美学"，局部借鉴达不到目标。

### 方案 B（全量替换前端底座，用 Horizon 作新框架，已拒绝）
- **拒绝理由**：Horizon 是 Tailwind v3 + routes.tsx SPA + 无 i18n + 无数据层 + React 19 RC，与 KOLMatrix 每层不兼容；等于重写，牺牲 App Router/RSC/i18n/RLS，工期以月计、生产风险高。

### 方案 C（给试点页复制一套 Horizon 变体共享组件做隔离，已拒绝）
- **拒绝理由**：两套组件分叉维护成本高，全量铺开时还要合并；additive token + 直接重塑共享层更简洁，且本就是要切换整个设计系统。

## References

- **Spec：** `docs/specs/BL-HORIZON-FE-PILOT-spec.md`
- **Token 映射：** `design-draft/horizon-tokens.md`
- **模板源：** Horizon UI Tailwind React NextJS Pro 3.0.0
- **Commits：** F001（token+字体 additive）/ F002（App Shell）/ F003（/insight dashboard + 共享设计系统层）
- **相关 ADR：** ADR-003（像素级标准，本 ADR amend 其基线）/ ADR-004（组件库锁定，本 ADR amend 其视觉）/ ADR-002（Tailwind v4 CSS-first 技术栈）

## Notes

### 重新评估触发条件
- 试点 F006 evaluator 验收 + 用户视觉复核后，决定是否启动 `BL-HORIZON-FE-ROLLOUT`（其余 ~20 页 + 删旧 NV token + Stitch 原型重做）
- 若全量铺开被否，本试点可整体 revert（additive token 未删 NV，回滚成本低）
