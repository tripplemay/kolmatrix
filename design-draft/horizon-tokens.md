# Horizon 设计 token 映射（BL-HORIZON-FE-PILOT F001）

> 来源模板：Horizon UI Tailwind React NextJS Pro 3.0.0 `tailwind.config.js`
> 目标：KOLMatrix `src/styles/globals.css` `@theme`（Tailwind v4 CSS-first）
> 策略：**additive** — 不删 Neural Velocity token，新旧并存；试点面（App Shell + `/insight`）消费本表 token，其余页保持 NV，全量铺开批次再迁移+删旧。
> 前提：KOLMatrix 是 **dark-first**（`color-scheme: dark`，无 light mode）→ 采用 Horizon 的**暗色变体**（navy-900 canvas / navy-800 卡）。

## 1. 品牌色 — Horizon 招牌紫

Horizon `brand.*` 用运行时 CSS 变量（`--color-50..900`，默认紫），KOLMatrix 试点用固定紫 ramp（不做运行时换主题色）。

| KOLMatrix @theme token | 值 | Tailwind 工具类 | Horizon 对应 |
|---|---|---|---|
| `--color-brand-50` | `#efebff` | `bg-brand-50` `text-brand-50` | brand 50 |
| `--color-brand-100` | `#e9e3ff` | `…-brand-100` | brand 100 |
| `--color-brand-200` | `#c0b8fe` | `…-brand-200` | brand 200 |
| `--color-brand-300` | `#a195fd` | `…-brand-300` | brand 300 |
| `--color-brand-400` | `#7551ff` | `…-brand-400` | brand 400 |
| **`--color-brand-500`** | **`#422afb`** | **`…-brand-500`** | **brand 500（招牌主色）** |
| `--color-brand-600` | `#3311db` | `…-brand-600` | brand 600 |
| `--color-brand-700` | `#2111a5` | `…-brand-700` | brand 700 |
| `--color-brand-800` | `#190793` | `…-brand-800` | brand 800 |
| `--color-brand-900` | `#11047a` | `…-brand-900` | brand 900 |
| `--color-brand-linear` | `#868cff` | `…-brand-linear` | brandLinear（渐变搭档） |

**用法：** 主按钮/激活态/强调/图表主色 = `brand-500`；hover = `brand-600`；渐变 CTA = `brand-500 → brand-linear`。

## 2. Navy 表面 — 暗色 canvas / 卡片 / 层级

| KOLMatrix @theme token | 值 | Tailwind 工具类 | 用途 |
|---|---|---|---|
| `--color-navy-700` | `#1b254b` | `bg-navy-700` | 卡内层级 / hover 卡 |
| `--color-navy-800` | `#111c44` | `bg-navy-800` | **卡片表面** |
| `--color-navy-900` | `#0b1437` | `bg-navy-900` | **app canvas 背景** |
| （navy-50..600 完整 ramp 已定义，边框/描边备用） | — | `…-navy-{50..600}` | 备用 |

> 与现有 NV `--color-navy-base (#0b1326)` / `--color-navy-deep (#0F172A)` 气质一致（都是深 navy），不冲突并存。

## 3. 中性文字 ramp（navy 上的蓝灰）

| token | 值 | 工具类 | 用途 |
|---|---|---|---|
| `--color-hz-gray-600` | `#a3aed0` | `text-hz-gray-600` | 次要正文（muted） |
| `--color-hz-gray-700` | `#707eae` | `text-hz-gray-700` | 次级标签 |
| `--color-hz-gray-400/500` | `#b0bbd5` / `#b5bed9` | `text-hz-gray-{400,500}` | 浅灰辅助 |
| `--color-hz-light-primary` | `#f4f7fe` | `bg-hz-light-primary` | Horizon 亮底（暗色变体基本不用） |

## 4. 圆角 / 阴影 / 字体

| token / utility | 值 | 工具类 | 用途 |
|---|---|---|---|
| `--radius-hz-card` | `20px` | `rounded-hz-card` | Horizon 招牌卡圆角 |
| `@utility shadow-hz-card` | `14px 17px 40px 4px rgba(112,144,176,.08)` | `shadow-hz-card` | 招牌柔和悬浮阴影（暗色下微妙 lift） |
| `--font-dm` | DM Sans（`--font-dm-sans-raw`） | `font-dm` | **正文**（已在 AppShellLayout 全 app 应用） |
| `--font-poppins` | Poppins（`--font-poppins-raw`） | `font-poppins` | **标题/display**（F002/F003 逐标题应用） |

## 5. 字体 wiring（`src/app/layout.tsx`）

- `DM_Sans` → `--font-dm-sans-raw`；`Poppins`（weight 400/500/600/700）→ `--font-poppins-raw`
- 两 variable 已挂到 `<html>` className
- app 子树经 `AppShellLayout` 根的 `font-dm` 类切到 DM Sans；landing/auth 仍 Inter（范围边界）

## 6. 明确未移植（试点不需要）

- Horizon `width.1p..99p`（百分比宽度 util）— Tailwind v4 任意值 `w-[N%]` 已覆盖
- `apexcharts` 相关 `backgroundImage`（balanceImg / carInterface / smartHomeDropzone）— 用 recharts，不移植
- Horizon 全套 `red/orange/amber/…/horizonGreen` 等语义色 ramp — 试点用 KOLMatrix 现有 `--color-warning/--color-error`；如全量铺开需要再补
- `tailwindcss-rtl` 插件 — KOLMatrix 无 RTL 需求

## 7. F002 / F003 消费指引

- **卡片**：`bg-navy-800 rounded-hz-card shadow-hz-card`（招牌浮起卡）
- **canvas**：区域背景 `bg-navy-900`（或沿用 `bg-navy-base`，二者近似）
- **主按钮/激活**：`bg-brand-500 hover:bg-brand-600 text-white`
- **标题**：`font-poppins`（H1/H2/KPI display）；正文默认已 `font-dm`
- **次要文字**：`text-hz-gray-600`
- **i18n 铁律**：所有文案仍走 `useTranslations`/`getTranslations`，禁引入模板硬编码英文
