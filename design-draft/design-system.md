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

## 9. 覆盖验收清单

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
| Dashboard 屏幕 | `724c65f2855b4af2bb6c953b3ba3c588` |

访问：https://stitch.withgoogle.com/projects/9338165817879839093
