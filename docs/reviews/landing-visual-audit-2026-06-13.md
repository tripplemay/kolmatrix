# 落地页视觉审计 — 动效 / 插画 / 氛围

> **类型：** Planner 视觉审计(用户 2026-06-13 指派,聚焦动效/插画/氛围)
> **方法：** Planner 亲看 8 张插画 + 子 agent 通读动效/氛围代码(组件 + globals.css @theme + design-system)
> **作者：** Kimi (planner)
> **关联：** BL-078(视觉打磨)· BL-080(8 张 AI 插画替 video,Lighthouse perf99/LCP870)· design-draft/design-system.md + landing-v2-tokens.md

## 0. 结论

落地页**技术地基是一线水准**(Geist + fluid clamp 排版、hero 原生 scroll-driven 动效、CTA 多层 glow、reduced-motion 全兜底、留白节奏接近 Linear)。但离 Linear/Vercel 那种"每屏统一氛围张力"的差距,集中在**氛围一致性 + 品牌胆量**三处:

1. **暖白 light 区打断沉浸色温** —— 最大破坏点
2. **景深靠 1px border 而非自己设计系统钦定的"色阶分层 + 环境光晕"**
3. **品牌色(电流青 #00E5FF / 紫 #9D50FF)克制到几乎隐身**,加上最高级的 `--ease-landing-out` 曲线只用在 CTA、没下放到进场动效

成品停在"非常干净但偏安全的深色 SaaS"。

## 1. 插画现状(Planner 亲看 8 张)

**风格:** 高度一致的深色 navy + 青/紫霓虹 + dashboard/卡片 mockup(hero KPI 卡、before-after 乱→整、feature KOL 卡网格、email 撰写+评分 98)。
**评价:** 质感尚可、风格统一、性能好(PNG 已优化)。但:
- **是抽象占位 UI**(灰色条/通用卡)而非展示真实产品价值或有辨识度的品牌插画 —— 读起来像"通用深色仪表盘"不像"这是我们的产品"。
- **深色霓虹科技风很泛**(每个 AI/SaaS 都用青紫 glow),不差异化。
- 数字(98)/元素略随意。
**定位:** 可接受、非短板;氛围提升的更大杠杆在下面的"动效+氛围"而非重做插画。重做插画属可选项(中等价值)。

## 2. 动效现状(代码审计)

**优点(一线水准的部分):**
- `ScrollFadeIn`:IntersectionObserver one-shot + 纯 opacity/transform(无 layout thrash),性能正确。
- Hero:原生 `animation-timeline: view()` scroll-driven + `@supports` 守门(globals.css:462)—— 全站最高级动效,零 JS。
- CTA hover:translateY+scale + 三层 cyan glow,用 `--ease-landing-out`(0.16,1,0.3,1)—— 质感标杆。
- **reduced-motion 模范**:`[data-landing-cinematic] *` 全局 kill + 各控件兜底。

**问题:**
- 🔴 **最高级的 `--ease-landing-out` 曲线只用在 CTA**,进场动效(ScrollFadeIn)用 Tailwind 默认平庸 `ease-out`,位移仅 16px 偏保守 → 全站进场缺"快进慢出"灵魂(ScrollFadeIn.tsx:60)。
- 🟠 `StickyParallax`(EmailCenterDemo):`scale()` 写成 inline-style **每帧 React re-render**,**违反 useScrollProgress 自身文档**(该写 CSS 变量走 compositor);callout 活跃态仅 `opacity 0.7↔1` 对比太弱(StickyParallax.tsx:73)。
- 🟠 `useScrollProgress`:`getBoundingClientRect()` 每 scroll 事件读 = 强制 reflow;文档推荐的 CSS-var 写法无人用(useScrollProgress.ts:49)。
- 🟡 Sticky 左栏(Features/Trust)纯钉住,**无任何随滚动微动**,缺 Linear 那种"跟着滚动叙事"的活感。
- 🟡 **死代码动效**:`landing-hero-video-scale`(globals.css:457)、`.cta-glow-pulse`(globals.css:397)定义了但 grep 无引用;FooterCTA 结尾 CTA 无持续脉冲、缺记忆点。

## 3. 氛围现状(配色/层次/过渡)

- **配色:** 有品牌方向(navy + 电流青 + 紫),但 **cyan 克制到几乎隐身**(body 区只在 border `/15`、icon halo `10%`),**紫色基本浪费**(只 BeforeAfter 一个 badge)。观感更像"安全深色 SaaS"而非"AI 能量脉冲"。
- **层次景深:** 设计系统明令"色阶分层 + 40px blur 环境光晕替代硬阴影 / 边框"(design-system.md:99),但落地页**几乎全靠 1px border 划分** —— **违背自己的质感铁律**;glass 只在 TopNav。body 卡片基本是"平的",缺多层 blur/glow 叠放。
- **section 过渡:** dark↔light 靠 24px 渐变条 + 微弱 cyan radial。🔴 **6px seam 太薄** + **暖白 `#f7f5f0` light 区与 navy dark 区色温/性格割裂** —— 让整体从"沉浸命令中心"掉回"普通营销页",是高级感最大破坏点。
- **留白:** 做得好(clamp section-y、sticky py-32、fluid 排版),呼吸感接近 Linear。

## 4. 🔝 改进机会(按"提升高级感 ÷ 工作量"排序)

| # | 改进 | 现状→建议 | 工作量 | 风险 |
|---|---|---|---|---|
| **A** | **进场动效统一灵魂曲线** | ScrollFadeIn 用默认 ease-out → 改 `--ease-landing-out` + 位移 16→24px,全站 5 section 进场统一 Linear 曲线 | 小 | 极低(visual baseline 需重拍) |
| **B** | **修 light 区色温割裂(最大杠杆)** | 暖白 #f7f5f0 → 冷调浅色(向 navy 色温靠)让明暗区共享品牌色温;或加厚 seam 64-96px + cyan glow 光学渐隐 | 中 | 中(改 light token 影响 PainPoints/Features/Trust 对比度,需重验 WCAG AA,别回退 F005) |
| **C** | **品牌色敢用 + 景深迁 glow** | dark 卡片改色阶分层 + 多层 cyan glow 替 border;1-2 个 dark section 引低透明 mesh/glow blob 背景(复用 hero mesh 思路),把紫真正用进来 | 中 | 低-中(纯装饰层,CSS radial 不加 asset 守 perf99,注意别压 LCP) |
| **D** | **StickyParallax 性能 + callout 对比** | inline-style 每帧 → CSS 变量 `--p` 走 compositor;callout 非活跃降 opacity-40 + 活跃微移;useScrollProgress 加 rAF 节流或迁 `animation-timeline: scroll()` | 中 | 中(低端机实测别破 perf99;非活跃文字别低于 AA) |
| **E** | **sticky 区"活"起来** | Features/Trust 左栏加随滚动进度指示(01—06 计数/细进度条)或 H2 极轻 parallax | 中 | 低 |
| **F** | **清死代码 + FooterCTA 记忆点** | 删 landing-hero-video-scale/cta-glow-pulse 死 keyframe,或把 cta-glow-pulse 真接到 FooterCTA 主 CTA 给结尾轻呼吸锚点 | 小 | 极低 |
| **G**(可选) | **插画差异化** | 8 张通用深色仪表盘 → 重生成更有品牌辨识度/展示真实产品价值的插画 | 中 | 中(重新生成 + 重新集成 + perf/视觉基线重验) |

## 5. 建议批次组织

**高价值快赢(建议优先):A(曲线)+ F(死代码/FooterCTA)+ C(glow 景深)** —— 改动相对独立、风险低、对"高级感"提升明显。
**中价值需谨慎:B(light 区色温)** —— 杠杆最大但碰 WCAG 对比度,建议单独 feature 重验。
**中价值:D(StickyParallax 性能)+ E(sticky 微动)** —— 动效精修。
**可选:G(插画重做)** —— 价值中等,可后置或单开。

> 全程守 BL-080 的 **Lighthouse perf99 / 可访问性 / reduced-motion** 不回退 —— 这是硬约束。
