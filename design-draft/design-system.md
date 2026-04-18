# KOLMatrix — Neural Velocity 设计系统（视觉基调基准）

> 状态：✅ 已定稿（2026-04-18）
> 来源：Stitch Variant A 对比评审
> Stitch 项目：`projects/9338165817879839093`（Stitch MCP 可调）
>
> 所有 UI 页面必须以本文件为唯一视觉参考源。

## 1. 核心哲学

全球游戏营销的数据很重，但体验必须轻盈。远离标准 SaaS dashboard（装在盒子里的 Excel），走向 **High-End Editorial** 沉浸式界面 —— 命令中心级的专业感，AI 驱动的能量脉冲。

关键词：深色 navy 基底 · 电流青 AI 脉冲 · 玻璃拟态 · 环境光晕 · 色阶分层（不用边框）

---

## 2. 色彩 Token

### 基础色

| 角色 | Token | HEX |
|---|---|---|
| primary | 电流青（AI 能量） | `#00E5FF` |
| secondary | 紫色（次级动作/分类） | `#9D50FF` |
| neutral 基底 | 深色 navy | `#0F172A` / `#0b1326` |
| color mode | DARK | — |
| color variant | FIDELITY | — |

### 表面分层（严格使用，禁止 1px 边框定义边界）

| 层级 | HEX | 用途 |
|---|---|---|
| surface (base) | `#0b1326` | 页面底色 |
| surface_container_lowest | `#060e20` | 斑马纹替代 |
| surface_container_low | `#131b2e` | 二级容器 |
| surface_container | `#171f33` | — |
| surface_container_high | `#222a3d` | 可交互卡片 |
| surface_container_highest | `#2d3449` | 输入框填充 |
| surface_bright | `#31394d` | — |

### 扩展色

| 用途 | HEX |
|---|---|
| primary 容器 | `#00e5ff` |
| primary fixed（元数据标签） | `#9cf0ff` |
| primary fixed dim（渐变起点） | `#00daf3` |
| secondary 容器 | `#6e06d0` |
| 告警（转化机会） | `#fec931` |
| 错误 | `#ffb4ab` |
| on_surface（主文字） | `#dae2fd` |
| on_surface_variant（次要文字） | `#bac9cc` |
| outline | `#849396` |
| outline_variant（ghost border） | `#3b494c`，通常 15% 不透明度 |

---

## 3. 排版

### 字体

- **全局：Inter**（headline / body / label 全部 Inter）

### 尺度规则

| 级别 | 用法 | 关键规则 |
|---|---|---|
| display-lg / display-md | 大型营销指标 | letter-spacing `-0.02em` |
| headline-sm | 区块标题锚点 | letter-spacing `-0.02em` |
| label-md | 元数据 / AI 属性 | 颜色用 `#9cf0ff`（primary_fixed） |
| body-md | 描述正文 | line-height `1.5` |

### 规则

- 不用全大写（除 tier 徽章等少量 HUD 语境）
- 数字指标（KPI）采用 display 尺度 + tight tracking，建立"信心感"
- 行距保证 1.5 以上

---

## 4. 圆角与间距

| 规则 | 值 |
|---|---|
| 主容器 | 12px（`ROUND_TWELVE`，md） |
| 次级容器 / 特色卡片 | 16px（lg） |
| 禁用 | 4px 的 web 标准圆角 |
| 网格 | 12 栏，gutter 24px |
| 分隔 | **负空间替代 divider line** —— 不够就加 padding |

---

## 5. 质感规则（差异化核心）

### 禁止

- ❌ 1px solid 边框分隔区块（用色阶分层替代）
- ❌ 纯黑、纯白大面积
- ❌ 硬阴影（drop-shadow 高不透明度）
- ❌ 标准 SaaS 灰白+单一蓝配色

### 强制

- ✅ **玻璃拟态（AI 洞察元素）**：backdrop-blur 20-30px + primary 20% 不透明度背景（如 AI 评分徽章）
- ✅ **环境光晕（浮动元素）**：40px blur + on_surface `#dae2fd` 5% 不透明度，替代硬阴影
- ✅ **渐变 CTA**：135° linear-gradient `#00daf3 → #c3f5ff`，"lit from within" 质感
- ✅ **Ghost Border**（输入框等需要边界时）：`outline_variant` @ 15% 不透明度。focus 态 → 100% primary + 4px outer glow（primary_fixed_dim 20%）
- ✅ **色阶分层**：嵌套容器时，内层比父层高一级（如 low → high）

---

## 6. 组件规范

### 按钮

| 类型 | 背景 | 文字 | 圆角 |
|---|---|---|---|
| Primary | 135° 渐变 `#00daf3 → #c3f5ff` | `on_primary` `#00363d` | 12px |
| Secondary（紫色脉冲） | `#6e06d0`（secondary_container） | `on_secondary_container` | 12px |

### 卡片

- 基础卡片：`surface_container_low` `#131b2e`，12px 圆角
- 可交互卡片：`surface_container_high` `#222a3d`
- Hover：升一级色阶 + 微弱 primary 内发光

### 输入框

- 填充：`surface_container_highest` `#2d3449`
- 空闲态：Ghost Border `#3b494c` @ 15%
- Focus 态：border → 100% primary + 4px outer glow

### AI 评分徽章 / 洞察 Chip

- 玻璃拟态：backdrop-blur 20px + primary `#00E5FF` @ 20% 背景
- 发光：text-shadow primary + 外 box-shadow 环境光
- 大号数字用 display 尺度（如 KOL 评分 44px）

### Chip / Tag

- 元数据标签：`label-md` + primary_fixed `#9cf0ff`，无边框无背景
- 分类标签：secondary_container 半透明背景 + secondary 文字

### 侧边栏

- 背景：`surface_container_lowest` `#060e20`
- 图标空闲：`on_surface_variant` `#bac9cc`
- 激活项：左侧 2px primary 青色竖条 + primary 文字 + 淡青发光晕

### 进度条

- 未填充：`surface_container_high` 20% 不透明度
- 已填充：primary 渐变填充（与 CTA 一致）
- 可选：shimmer 动画

---

## 7. 数据可视化

### 折线图

| 线 | 颜色 | 用途 |
|---|---|---|
| 主线（Sent） | primary `#00E5FF` 粗 2px | — |
| 次线（Opened） | secondary `#9D50FF` | — |
| 辅线（Replied） | primary `#c3f5ff` 淡 | — |
| Grid 网格 | `outline_variant` 15% | 几乎不可见 |

### KPI 卡片

- 数字使用 display 尺度
- Delta 变化用 primary_fixed `#9cf0ff` 小字注释
- 附加 mini-sparkline 或 circular ring（primary stroke）

---

## 8. 状态反馈

| 状态 | 色彩 |
|---|---|
| 成功 | primary `#00E5FF`（避免默认绿） |
| 警示 | tertiary_container `#fec931`（amber，不用红） |
| 错误 | error `#ffb4ab` |
| 完成 | secondary `#9D50FF` |

---

## 9. Canonical App Shell（强制规范）

> 所有页面必须使用统一的 sidebar + topbar，仅激活态和页面标题随页变化。
> 该规范同步写入 Stitch 设计系统的 `designMd`，AI 生成新页面时自动遵循。

### Sidebar（左侧 240px，固定，全高）

- 背景：`#060e20`（surface_container_lowest），无右边框
- 右侧分隔：20px 青色光晕阴影 @ 3% 不透明度（替代边框）
- 内边距：24px

#### Logo Block（顶部 56px 高，下方 32px margin）

- 40×40px 渐变方块（135° `#00daf3 → #c3f5ff`，10px 圆角），内嵌白色 "K" 字标（Inter 700 18px navy 色）
- 右侧文字：`KOLMatrix` Inter 700 18px（cyan 渐变文字）
- 文字下方 tagline：`NEURAL VELOCITY` Inter 600 9px tracking 0.15em，颜色 `#6B7280`

#### Navigation List（**严格 8 项**，顺序固定）

| 序 | 项 | 图标（material-symbols） |
|---|---|---|
| 1 | Dashboard | `dashboard` |
| 2 | KOL Discovery | `travel_explore` |
| 3 | KOL Database | `groups` |
| 4 | Campaigns | `rocket_launch` |
| 5 | Email Center | `forward_to_inbox` |
| 6 | Products | `inventory_2` |
| 7 | Analytics | `query_stats` |
| 8 | Settings | `settings` |

每项：padding `10px 14px`，圆角 10px，Inter 500 14px，icon 20px + label，gap 12px。

| 状态 | 文字 | 图标 | 背景 |
|---|---|---|---|
| 默认 | `#bac9cc` | `#bac9cc` | 透明 |
| Hover | `#dae2fd` | cyan `#00E5FF` | `rgba(34,42,61,0.5)` |
| Active | cyan `#00E5FF` Inter 600 | cyan | 90° 渐变 `rgba(0,229,255,0.10) → 透明`，左侧 2px cyan 竖条 |

#### User Chip（底部固定）

- 横向：avatar 36px 圆形 + 右侧文本（"Sarah Chen" Inter 600 14px / "Ops Lead" Inter 400 11px `#6B7280`）+ 远端小 chevron 图标
- padding 12px，圆角 10px，hover 背景 `rgba(34,42,61,0.4)`

#### Sidebar 禁忌

- ❌ Help Center 链接
- ❌ Create Campaign 按钮（属于主内容头部）
- ❌ Connect Wallet 等任何 Web3/crypto 元素
- ❌ 8 项之外的任何 nav item
- ❌ rocket logo 单色（必须是 K 字标 + 渐变方块）

### Topbar（顶部 64px，sticky）

- 背景：`rgba(11,19,38,0.85)` + backdrop-blur 24px（毛玻璃）
- 无底部边框，下方 4px 环境光晕 `rgba(0,0,0,0.3)`
- 横向 padding 32px，垂直居中
- 三段式布局：左 / 中 / 右

#### LEFT — 页面标题
- Inter 600 16px 白色，简单文本（如 "Dashboard" / "KOL Discovery" / "KOL Profile"）
- ❌ 不放任何横向 nav 链接（"Global Trends"、"Leaderboard" 等）

#### CENTER — Global Search（max-width 480px，flex-1，mx-auto）

- 药丸形，高 40px，padding-x 16px
- 背景 `#2d3449`（surface_container_highest）
- 左侧 search 图标 18px `#6B7280`
- Placeholder：`"Search KOLs, campaigns, emails..."` Inter 400 13px `#6B7280`
- 右侧 `Cmd+K` 小 chip（Inter 500 11px `#6B7280` 细边框）
- Focus：1px cyan ghost border + 4px outer cyan glow @ 20%

#### RIGHT — Action Cluster（gap 16px）

1. 语言切换：`EN` chip Inter 500 13px `#bac9cc` + 小 chevron
2. 通知铃铛：`notifications` 图标 22px `#bac9cc`，未读时右上 6px 红点
3. 垂直分隔：1×24px `rgba(186,201,204,0.15)`
4. 用户头像：32px 圆形 + 小 chevron（**不显示用户名**，名字在 sidebar）

#### Topbar 禁忌

- ❌ Connect Wallet（或任何 Web3 元素）
- ❌ 横向 nav 链接
- ❌ 底部边框线（用环境光晕）
- ❌ `auto_awesome` / sparkle 按钮（已被 Cmd+K 提示替代）

### Per-page 配置

| 页面 | Sidebar Active | Topbar 标题 |
|---|---|---|
| Dashboard | Dashboard | Dashboard |
| KOL Discovery | KOL Discovery | KOL Discovery |
| KOL Detail | KOL Discovery | KOL Profile |
| Campaigns | Campaigns | Campaigns |
| Campaign Detail | Campaigns | Campaign · {name} |
| Email Center | Email Center | Email Center |
| KOL Database | KOL Database | KOL Database |
| Products | Products | Products |
| Analytics | Analytics | Analytics |
| Settings | Settings | Settings |

---

## 10. 项目色彩 Token 边界政策（2026-04-18 沉淀）

> 来自 F010 pre-impl 裁决 §11.2。`docs/specs/B0-f010-component-map.md` 有完整理由。

### 10.1 必须 token 化（写入 `globals.css @theme`）

- **品牌主体色**：navy 阶层 / cyan / cyan-fixed / purple / purple-container
- **文字色阶**：text-primary / text-muted / text-very-muted
- **语义色**：accent-warning / accent-error / outline / outline-variant

这些色承载设计系统意图（如 cyan = AI 能量）。

### 10.2 允许使用 Tailwind 预设色（不强制 token 化）

- **平台品牌色**（外部带入）：
  - YouTube `bg-red-600` / Twitch `bg-purple-600` / TikTok `bg-black` / Instagram `bg-gradient-to-tr from-pink-500 to-violet-600`
- **状态辅色**（单一语境）：
  - `emerald-400`：trend up 正向变化
  - `amber-400`：pending 状态边缘使用

### 10.3 判断原则

| 颜色类型 | 处理 |
|---|---|
| 承载设计系统意图（如 AI 能量 = cyan） | 必须 token |
| 外部品牌色（YouTube red） | Tailwind 预设 |
| 单一语境辅色（trend up = emerald） | Tailwind 预设 |

### 10.4 HEX 硬编码扫描规则

B0 F002 强制：`grep -rE '#[0-9a-fA-F]{6}' src/` 在 `globals.css` 之外命中数 = 0。

**Tailwind 预设类名（`bg-red-600`）不是 HEX，不触发 fail。** 这允许平台品牌色 + emerald 状态色走预设类而不破坏扫描。

---

## 11. 覆盖验收清单

新页面上线前必须自检：

- [ ] 无 1px solid 边框分隔区块
- [ ] 所有 AI 相关元素有玻璃拟态或 primary 发光
- [ ] 主 CTA 为 135° 渐变（非实色）
- [ ] 浮动元素为环境光晕（非硬阴影）
- [ ] 圆角 ≥ 8px（首选 12px/16px）
- [ ] 字体全部 Inter，headline 有 -0.02em tracking
- [ ] 深色基底为 navy（非纯黑）
- [ ] KPI 数字使用 display 尺度
- [ ] Chip/Tag 使用 primary_fixed `#9cf0ff` 而非纯白

---

## 附：Stitch 项目映射

| 资源 | ID |
|---|---|
| 项目 | `projects/9338165817879839093` |
| 设计系统 Asset | `assets/18406648320972948834` |
| Dashboard 屏幕（canonical shell） | `8b4aa02ae47c4da181239399c6ef4658` |
| KOL Discovery 屏幕（canonical shell） | `a1771401c71140e49e20ebc559782dc3` |
| KOL Detail 屏幕（canonical shell） | `b06528d25565440c833a7f94035feead` |

访问：https://stitch.withgoogle.com/projects/9338165817879839093

> **shell 同步机制：** Stitch 设计系统的 `designMd` 已嵌入 §9 Canonical App Shell 完整规范。后续 `generate_screen_from_text` 生成新页面时会自动读取，AI 应输出统一 shell。如出现不一致，用 `edit_screens` 批量对齐。
