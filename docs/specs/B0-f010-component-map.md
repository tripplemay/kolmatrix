# B0 F010 · 公共组件库规划稿

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-18
> **触发：** F010 开工前审计，按 "pre-impl 审计 → Planner 裁决" 工作范式
> **状态：** 等待 Planner 明确回复，**未收到前不开工**

---

## 1. 背景 & 目标

F010 acceptance 要求 `src/components/common/` 下 **固定 12 个组件**、每个 ≤100 行、F007 Dashboard 必须 import 全部 12 个、JSX ≤80 行。

本文在实现前提交：  
- 每个组件的 **HTML 参考源 + 跨页变体对比 + Props API 设计**  
- **6 条 Planner 决议请求**（影响 props 分支、token 扩展、ActivityFeedItem 命运等）

决议敲定后 johnsong 立刻开工，预计 2-3 小时完成 12 个组件 + 一轮 HEX/tsc/lint/build 闸门。

---

## 2. 组件 → 页面复用矩阵

| # | 组件 | dashboard | kol-discovery | kol-database | campaigns-list | campaign-detail | email-center | kol-detail | 命中 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | StatCard | ✅ 4x | ✅ 3x | ✅ 4x | ✅ 4x | - | ✅ 5x | ✅ 6x | **6/7** |
| 2 | KolCard | ✅ 4x | ✅ 3x | ✅ 行 | - | ✅ 行 | ✅ 3x | - | **5/7** |
| 3 | CampaignRow | ✅ 3x | - | - | ✅ 表 | ✅ KOL表 | - | - | **3/7** |
| 4 | AiScoreBadge | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ | **6/7** |
| 5 | GlassPanel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| 6 | GradientButton | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| 7 | SecondaryButton | ✅ | ✅ | ✅ | ✅ | ✅ | - | ✅ | **6/7** |
| 8 | GhostButton | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |
| 9 | TagChip | ✅ | ✅ | ✅ | - | - | - | ✅ | **4/7** |
| 10 | AvatarWithPlatformBadge | ✅ | ✅ | ✅ | - | ✅ | ✅ | ✅ | **6/7** |
| 11 | ActivityFeedItem | - | - | - | - | ✅ | ✅ | - | **⚠️ 2/7** |
| 12 | SectionHeader | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | **7/7** |

**观察：** 11 个组件覆盖 ≥3 页，唯独 `ActivityFeedItem` 仅 2 页。但 F010 spec 锁死 12 个名单，不能裁掉。→ 决议 #5 讨论。

---

## 3. 12 个组件 Props API 草案

> **约定：** 所有 props 用 `?:` 标可选；默认值在注释里；color prop 用项目 token 名（`cyan / purple / warning` 等），不用原始 HEX。

### 3.1 `StatCard`
```typescript
interface StatCardProps {
  label: string;              // "Total KOLs"
  value: string | number;     // "12,847"
  subLabel?: string;          // "/ 5,000"
  trend?: {
    direction: "up" | "flat" | "down";
    percent: number;          // 12 (不含 % 符号)
    accent?: "emerald" | "purple" | "warning"; // 默认按 direction 推断
  };
  icon?: string;              // material symbol name, 右上角装饰大图标 opacity-10
  sparkline?: number[];       // [40, 60, 80, 100] 存在时渲染 bar chart
  className?: string;
}
```
**HTML 源：** `dashboard.html:190-206`（完整形态）  
**变体：** 6 页使用，唯 dashboard 带 sparkline。→ 决议 #1  
**估行：** ~90 行

### 3.2 `KolCard`
```typescript
interface KolCardProps {
  name: string;
  avatar: string;
  followers: string;           // "2.4M Subs"
  aiScore?: number;            // 94 → 右上角 AiScoreBadge
  platform?: "youtube" | "twitch" | "tiktok" | "instagram";
  tags?: string[];
  variant?: "grid" | "row";    // 默认 grid
  className?: string;
}
```
**HTML 源：** `dashboard.html:365-380` (grid) / `kol-database.html` (row)  
**变体：** grid 4/7 页、row 3/7 页；内部 70% 结构共享。→ 决议 #2  
**估行：** ~95 行

### 3.3 `CampaignRow`
```typescript
interface CampaignRowProps {
  name: string;
  logo: string;
  subtitle?: string;           // "Global Launch • 450 KOLs"
  progress?: number;           // 0-100
  primaryMetric?: { label: string; value: string | number }; // Open Rate: 42.8%
  secondaryMetric?: { label: string; value: string | number };
  status?: "active" | "paused" | "draft" | "completed";
  onMoreClick?: () => void;    // more_vert 菜单触发
  className?: string;
}
```
**HTML 源：** `dashboard.html:269-295`  
**变体：** 3 页用法微差，progress + 2 metric 槽位够覆盖。  
**估行：** ~85 行

### 3.4 `AiScoreBadge`
```typescript
interface AiScoreBadgeProps {
  score: number;                           // 94
  variant?: "circle" | "pill" | "inline";  // 默认 circle
  size?: "sm" | "md" | "lg";               // text-xs | text-lg | text-4xl
  glow?: boolean;                          // 默认 true
  className?: string;
}
```
**HTML 源：** `dashboard.html:366-368` (circle with glow)  
**变体：** 圆形右上角（KolCard）/ pill 型（表格）/ inline 数字。kol-detail SVG 圆环进度**单独用**，不归此组件 (属 KolDetail 页专属，F010 不收)。  
**估行：** ~50 行

### 3.5 `GlassPanel`
```typescript
interface GlassPanelProps {
  children: ReactNode;
  rounded?: "xl" | "2xl";                  // 默认 xl
  padding?: "sm" | "md" | "lg";            // p-4 | p-5 | p-6
  tone?: "neutral" | "cyan";               // border 颜色 → 决议 #3
  glow?: boolean;                          // ambient-glow shadow
  className?: string;
}
```
**HTML 源：** `kol-discovery.html:179`（filter 面板）  
**变体：** 7 页都用，border 颜色不统一。→ 决议 #3  
**注意：** 项目 `globals.css` 已有 `@utility glass-panel`，此组件只是 React 封装壳。  
**估行：** ~40 行

### 3.6 `GradientButton`
```typescript
interface GradientButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;                 // material symbol
  iconPosition?: "left" | "right";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}
```
**HTML 源：** `dashboard.html:182-185`  
**实现：** 走项目现有 `gradient-cta` utility。`rounded-lg / rounded-xl` 差异用 size 映射统一。  
**估行：** ~50 行

### 3.7 `SecondaryButton`
```typescript
interface SecondaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  size?: "sm" | "md" | "lg";
  tone?: "purple" | "cyan" | "neutral";   // 默认 neutral
}
```
**HTML 源：** `campaign-detail.html:217`  
**变体：** 6 页样式小异，tone prop 收拢 3 色系。  
**估行：** ~55 行

### 3.8 `GhostButton`
```typescript
interface GhostButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: string;
  iconPosition?: "left" | "right";  // 默认 right（View All style）
  size?: "sm" | "md";
}
```
**HTML 源：** `dashboard.html:265`（"View All" 模式）  
**实现：** 纯 text + hover:text-cyan，无 bg / border。  
**估行：** ~45 行

### 3.9 `TagChip`
```typescript
interface TagChipProps {
  label: string;
  tone?: "navy" | "cyan" | "purple" | "neutral"; // 默认 neutral
  size?: "xs" | "sm";                             // 默认 xs
  icon?: string;
  className?: string;
}
```
**HTML 源：** `dashboard.html:376-378`  
**变体：** 4 页，形状差异大（pill vs rounded）。canonical 定 `rounded-full` pill（多数派）。  
**估行：** ~40 行

### 3.10 `AvatarWithPlatformBadge`
```typescript
interface AvatarWithPlatformBadgeProps {
  src: string;
  alt?: string;
  name?: string;                                  // fallback initial
  size?: "sm" | "md" | "lg" | "xl";               // w-10 | w-14 | w-16 | w-[140px]
  platform?: "youtube" | "twitch" | "tiktok" | "instagram";
  hoverBorder?: boolean;                          // 默认 true, group-hover cyan
  className?: string;
}
```
**HTML 源：** `kol-discovery.html:247-251`  
**变体：** 头像尺寸 4 挡、角标 4 平台。  
**注意：** 平台角标颜色（YouTube red、Twitch purple、TikTok black、Instagram gradient）**不在项目 token 里**。→ 决议 #4  
**估行：** ~70 行

### 3.11 `ActivityFeedItem`
```typescript
interface ActivityFeedItemProps {
  text: ReactNode;                                // 允许含 <strong> 子元素
  time: string;                                   // "2 hours ago"
  icon?: string;                                  // material symbol, 左侧时间线圆点
  accent?: "cyan" | "purple" | "secondary";       // 圆点 border 色
  showTimeline?: boolean;                         // 默认 true
  rightAction?: ReactNode;                        // 右侧 verified icon 等
  className?: string;
}
```
**HTML 源：** `campaign-detail.html:493-499`  
**变体：** 仅 2 页使用（campaign-detail 时间线、email-center reply）。→ 决议 #5  
**估行：** ~60 行

### 3.12 `SectionHeader`
```typescript
interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  as?: "h1" | "h2" | "h3";                        // 默认 h3
  actions?: Array<{
    label: string;
    icon?: string;
    variant?: "ghost" | "secondary" | "gradient";
    onClick?: () => void;
  }>;
  className?: string;
}
```
**HTML 源：** `dashboard.html:263-265`  
**变体：** 7 页，级别 h1/h2/h3 不同，action 数量 0-3 个。  
**估行：** ~75 行

---

## 4. Token 缺口盘点

按 `globals.css @theme` 现有 token 清单比对，以下色系 HTML 中用到但**项目未定义**：

| HTML 原色 | 用途 | 出现次数 | 建议处理 |
|---|---|---|---|
| `emerald-400` | StatCard trend up chip | 3+ | 决议 #4 |
| `purple/10` `purple-container` | SecondaryButton / AiScoreBadge / TagChip | 5+ | 已有 `--color-purple` `--color-purple-container`，够用 |
| `red-600` | YouTube 平台角标 | 3 | 决议 #4 |
| `purple-600` | Twitch 平台角标 | 3 | 已有 purple，但饱和度差异？ |
| `pink-500 / violet-600` | Instagram 角标 | 1 | 决议 #4 |

---

## 5. 6 条 Planner 裁决请求

| # | 决议点 | A 方案 | B 方案 | johnsong 建议 |
|---|---|---|---|---|
| 1 | StatCard sparkline | 可选 prop，无则单行布局；不强制 | 所有 StatCard 必带 | **A**（其他页本就不带） |
| 2 | KolCard 变体 | 单组件 `variant: "grid" \| "row"` 切换 | 拆成 `KolCard` + `KolRow` 两个组件（违反 12 名单） | **A**（F010 名单固定只能单组件） |
| 3 | GlassPanel border 色 | 默认 `border-white/5`，`tone: "cyan"` 可选 | 默认 cyan 光晕 border | **A**（多数页 white/5） |
| 4 | 非项目 token 色怎么办 | 平台角标色（red/purple/pink）保留 HTML 原 Tailwind 预设色（`bg-red-600` 等），**emerald trend** 按同样方式保留 | 全部扩 @theme，每个加一个自定义 token | **A**（平台色是品牌色不是设计系统色，不必 token 化；emerald 仅 trend 用，保留预设） |
| 5 | ActivityFeedItem 仅 2 页用，要否保留 12 名单 | 保留（按 F010 spec 锁死），但实现基础版 | 替换为更高频的组件（例如 `DividerRow` / `KpiDelta`） | **A**（spec 锁死不改，Planner 若同意替换需改 features.json） |
| 6 | 文件组织 | 12 个文件分散在 `common/` 下，每个单独 export（`common/StatCard.tsx` 等） + `common/index.ts` barrel re-export | 单个 `common/index.tsx` 挤 12 组件 | **A**（spec 明写"12 个组件文件全部存在"） |

**裁决格式：** `#1:A #2:A #3:A #4:A #5:A #6:A` 即可，偏离建议请给理由。

---

## 6. 原型 bug 追加

跨页深度提取时新发现 3 处 HTML bug，请 Planner 决定是否加入 `design-draft/stitch-references/README.md` 漂移清单：

| # | 文件 | bug | 建议处理 |
|---|---|---|---|
| B6 | `dashboard.html:249` | SVG `viewbox` 小写应为 `viewBox` | 纳入清单，实现时写对 |
| B7 | `kol-discovery.html:188-191` | Filter 按钮缺 disabled 态 class | 实现 FilterButton 时补（**非 F010 范畴**，B1 再处理） |
| B8 | `campaigns-list.html:245-252` | Tab underline 用绝对定位但 button 无 `relative` | 实现时补 `relative` |

---

## 7. F007 Acceptance 串联

F010 完工后 F007 Dashboard 的实现约束（spec 原文）：

> **F007 acceptance 摘录：**  
> - `page.tsx` 必须 import 并使用 F010 全部 12 个组件  
> - `page.tsx` JSX 总长度 ≤ 80 行  
> - 重复样式片段 ≥2 次必须抽组件

**但 ActivityFeedItem 在 dashboard 里没有 timeline 使用场景**（Email Performance 区块是 chart，Activity Feed 可以复用）。F007 能否凑够 12 个 import 取决于 Dashboard 要不要加 "Recent Activity" 区块。

**请 Planner 确认：** Dashboard 页面是否有 "Recent Activity" 区块？spec §F007 §实现描述写"5 区块：问候栏 / KPI 4 卡 / Active Campaigns 3 行 / AI-Recommended KOLs 2x2 / Email Performance LineChart + Activity Feed"。**有 Activity Feed**，所以 ActivityFeedItem 能在 F007 用上。→ 决议 #5 维持 A 合理。

---

## 8. 估算开工时长

| 环节 | 预估 |
|---|---|
| 实现 12 组件（~70 行均值 × 12）| 2 h |
| 写 props interface + 文件头注释 | 0.5 h |
| 跑 HEX/tsc/lint/build 闸门 + 修 | 0.3 h |
| 本地 storybook-like 验证（手动在 /dashboard 临时渲染） | 0.5 h |
| 总计 | **~3.3 h** |

---

## 9. 开工条件

收到 Planner 对**第 5 节 6 条 + 第 6 节 3 个 bug + 第 7 节 Activity Feed 确认**的明确回复后，johnsong 会：

1. 按决议建 12 个组件（`src/components/common/`）
2. 走 HEX / tsc / lint / build 全绿闸门
3. 在 `/dashboard` 页临时组合渲染做自检（非 F007 正式页）
4. push 到 main，更新 progress.json + features.json (F010 → completed)

**未收到明确回复前不开工。**

---

## 10. 相关文档

- `docs/specs/B0-foundation-spec.md` §4 F010 — 原规格
- `docs/specs/B0-app-shell-canonical-review.md` — F005 先例（裁决流程模板）
- `design-draft/stitch-references/README.md` — Stitch HTML 漂移清单
- `design-draft/design-system.md` — Neural Velocity token 与组件规则
- `src/styles/globals.css` — 现有 token + utility（`glass-panel` 等）
