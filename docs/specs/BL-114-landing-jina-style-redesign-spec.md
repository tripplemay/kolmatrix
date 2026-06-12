# BL-114 落地页 jina.ai 风格重做 — 文字驱动极简

> **Type：** 视觉重做（用户指定参考 https://jina.ai/）。spec 硬性。
> **来源：** 用户 2026-06-13 "落地页风格和 jina.ai 一样" + 视觉审计 docs/reviews/landing-visual-audit-2026-06-13.md
> **用户决策（2026-06-13）：** ① 全去 BL-080 的 8 张插画 → 文字驱动极简；② 重点 = 文字驱动极简 / 大留白 / 排版 / 技术质感。
> **⚠️ 反转 BL-080**（8 插画替 video）—— 用户明确决定。

## §1 背景 + jina.ai 风格读取

jina.ai 底色其实与现状接近（**全深色 navy + 青**），所以本批**不是推翻配色**，核心是三个移动：去插画 → 文字驱动极简、大留白、排版/技术质感。

**jina.ai 风格特征（Planner 经 WebFetch 读取，Generator 实现时须直接参考 jina.ai 现场对齐）：**
- 全深色 navy + 纯白字 + 电流蓝/青 + 金/琥珀点缀；几何无衬线（Inter 类）+ 文档区等宽字体。
- **文字驱动极简、几乎不用插画/照片**：靠干净图标 + 合作 logo + 细分隔线 + 微妙渐变 + 等宽代码块。
- **大留白、呼吸感强**；技术 × 优雅，开发者可信度。

**现状（审计）：** 重插画（8 mockup）+ 暖白 light 区交替 + 青紫克制。技术地基（Geist/clamp 排版、hero scroll-driven、CTA glow、reduced-motion）已一线水准。

## §2 设计方向（本批锁定）

- **去全部 8 张插画**（`public/landing/illustrations/*.png`），section 转**文字驱动极简**：大标题 + 副文 + 干净图标 / 细分隔线 / 适当等宽代码块或抽象几何 / 大留白。
- **截图（`/landing/screenshots/`）**：按 jina.ai 极简口径**克制使用或转文字驱动**（Generator 判断；若保留须极简干净、不堆砌）。
- **排版/技术质感**：强化几何无衬线层级（复用 Geist）、等宽代码块体现技术质感、清晰分隔线层级。
- **大留白**：放大 section 间距/呼吸感对齐 jina.ai。
- **硬约束（不回退）：** Lighthouse perf99 / 可访问性 WCAG AA / reduced-motion 兜底（守 BL-080）；landing visual-regression baseline **须 Linux runner 重拍**（generator §21 / proposed-learning）。
- 用户**未选**"去暖白 light 区"和"金色点缀" → 本批不强推；但去插画+极简后若 light 区割裂仍明显，Generator 可在 §3 提议（不擅自做）。

## §3 Features

> 全 generator 含单测 + i18n（落地页文案 5 locale 或现有口径）+ L1 全绿 + **npm run build**（route/视觉改动）。

### F001 — Hero 文字驱动极简重做 + 全局排版/留白向 jina 收敛（generator）【tone-setter 检查点】
- Hero（`HeroVideo.tsx`）重做：**去 hero 插画**，改大 display 标题 + 副文 + 主/次 CTA + 微妙渐变/mesh 背景（CSS,无 asset),大留白,jina.ai 居中/呼吸感。
- 全局排版/留白向 jina.ai 收敛：type scale / section 间距 / 分隔线层级（globals.css token 微调,不破 perf/a11y）。
- **⚠️ Hero-first 检查点（硬要求）：** F001 完成 → 部署 staging → **停下让用户确认 jina.ai 方向**,再推 F002+。避免主观重做做满后才发现方向偏。
- i18n + 单测 + npm run build。

### F002 — Features + BeforeAfter 转文字驱动极简（generator）
- Features（`Features.tsx`）：**去 5 张 feature 插画**,重做文字驱动 feature 呈现(干净图标 + 标题 + 描述 + 大留白,jina.ai 列表/网格极简);截图克制处理(见 §2)。
- BeforeAfter：**去 before-after 插画**,改文字/极简对比(两列 before/after 文字 or 极简几何,无 mockup)。
- i18n + 单测 + npm run build。

### F003 — EmailCenterDemo + 其余 section 对齐极简（generator）
- EmailCenterDemo：**去 email 插画**,转文字驱动极简(StickyParallax 可保留滚动叙事但内容文字化/极简)。
- PainPoints / TrustPlaceholder / FAQ / FooterCTA / TopNav / SectionTransition：对齐极简文字驱动 + 大留白 + 技术质感(分隔线/mono/留白);Trust 若有 logo grid 按 jina.ai 干净 logo 排布。
- i18n + 单测 + npm run build。

### F004 — 清理插画 asset + 死动效 + perf/a11y/baseline（generator）
- 删 `public/landing/illustrations/*.png`(8 张)+ 不再引用的 `illustration-asset` 逻辑/相关 i18n key。
- 删审计标的死动效(`landing-hero-video-scale` / `cta-glow-pulse` 等无引用 keyframe,globals.css)。
- **visual-regression baseline 重拍**(Linux runner `update-visual-baselines.yml`)+ 连带失效断言更新(删 hero-video 等)；Lighthouse perf99 / a11y AA 复验不回退。
- npm run build 绿。

### F005 — Codex L1+L2 + signoff（codex）
- L1：lint 0err warn≤3 / tsc=0 / npm test + **npm run build**。
- L2 部署后 staging：① 落地页对齐 jina.ai 文字驱动极简(无插画/大留白/技术质感)② 各 section 视觉走查 ③ **Lighthouse perf≥99 / WCAG AA / reduced-motion 不回退** ④ visual baseline 已重拍绿 ⑤ 5 locale 文案正常。
- signoff `docs/test-reports/BL-114-signoff-2026-06-XX.md`。

## §4 风险

- **主观重做：** Hero-first 检查点(F001 staging 先验方向)是主要风险控制;用户 staging 迭代。
- **反转 BL-080：** 插画删除不可逆(asset 删除)——但 git 历史可恢复;用户已决。
- **CI visual-regression：** 落地页视觉大改 → baseline 必 Linux runner 重拍 + 连带 e2e 断言更新(generator §21)；否则 main 持续红。
- **perf/a11y 硬约束：** 去插画通常更快(少 asset),但新渐变/留白别压 LCP;a11y 对比度别回退。
- ⚠️ 部署 staging+prod 手动触发 OOM NODE_OPTIONS=4096。
