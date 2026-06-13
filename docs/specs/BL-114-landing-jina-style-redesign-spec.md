# BL-114 落地页重做 — 照 Stitch 原型(Neural Velocity 设计系统)

> **Type：** 视觉重做。spec 硬性。
> **目标参照（精确）：** `design-draft/landing-stitch-prototype/`（用户用项目 Neural Velocity 设计系统在 Stitch 生成的落地页原型：`code.html` 完整结构+token / `screen.png` 渲染图 / `DESIGN.md`）。
> **来源：** 用户 2026-06-13 视觉优化 → 视觉审计 docs/reviews/landing-visual-audit-2026-06-13.md → **放弃 jina.ai 方向,改用项目自有设计系统(Stitch 原型)**。
> **用户决策（2026-06-13）：** ① **完全照原型**(含结构重组,去 PainPoints/BeforeAfter/EmailCenterDemo,加 How-it-works/Stats)；② hero 视觉**保留 `hero-illustration.png`** 那张清爽 dashboard 插画,其余 7 张删。
> **⚠️ 取代原 jina.ai 方向**(Generator F001 jina 版作废,照原型重做)。

## §1 目标 = Stitch 原型(Neural Velocity)

原型用项目自有设计系统 "Neural Velocity"——与现有 app 一脉,且补上审计发现的"景深用色阶+光晕而非边框、品牌青/紫敢用"。**Generator 实现时以 `design-draft/landing-stitch-prototype/code.html` + `screen.png` 为精确参照**。

**Token(原型 = 设计系统,多已在 globals.css):** 底 `#0b1326`;主青 `#00e5ff` / primary-fixed `#9cf0ff`(mono 标签);渐变 CTA 135° `#00daf3 → #c3f5ff`(lit-from-within,12px);色阶分层 `#131b2e/#222a3d`(**不用 1px 边框/硬阴影**);环境光晕 glow-blob(青/紫 radial,40px blur);玻璃拟态(blur 20-30px + 青 20%);字体 **Inter + JetBrains Mono**(mono 用于技术标签/步骤号)。

**原型 section 顺序(本批锁定结构):**
1. 环境光晕 blob 背景 + Nav(玻璃,wordmark + 极简链接 + Sign in + 渐变 Get started)
2. **Hero**(居中):青色 mono eyebrow + 大 display 标题(第二行青/紫渐变)+ 副文 + 渐变 "Start free" + "Book a demo" 次 CTA + 光晕 blob
3. **Hero dashboard 预览**:`hero-illustration.png`(保留)+ 玻璃/光晕装饰
4. Logo 条("Trusted by leading game studios" + 5 个 muted wordmark)
5. **Bento 能力区**:4 张色阶卡(Brief/Match/Reach/Insight),每张 material 图标 + 青 mono 标签 + 粗标题 + 描述,无边框
6. **How it works**:3 步(01/02/03 mono 号 + Define Objective / Neural Discovery / Execute & Track)
7. **Stats**:3 个大青色数字(6,000+ KOLs / 5+ languages / 100% ROI 等)+ muted caption
8. FAQ:色阶 accordion(无边框)
9. 收尾 CTA("Ready to lead the game?")+ footer

## §2 Features（照原型,守 perf99/a11y/reduced-motion）

> 全 generator 含单测 + i18n 5 locale + L1 全绿 + **npm run build**(视觉/route 改动)。Generator 以原型 code.html/screen.png 为准翻译成项目 React + Tailwind v4 组件(复用现有 globals.css token,缺的补)。

### F001 — Hero + 全局 token/字体 照原型重做（generator）【tone-setter 检查点,redo】
- Hero(`HeroVideo.tsx`/重命名)照原型:青 mono eyebrow + 大 display 标题(渐变第二行)+ 副文 + 渐变 "Start free" CTA + "Book a demo" 次 CTA + 光晕 blob 背景 + 下方 **hero-illustration.png dashboard 预览**(玻璃/光晕装饰)。
- 全局:接 **Inter + JetBrains Mono** 字体;`gradient-btn`(135° 渐变 CTA)+ `glow-blob` 环境光晕 utility + mono 技术标签样式(globals.css,复用已有 Neural Velocity token)。
- **⚠️ Hero-first 检查点(redo):** F001 完成 → 部署 staging → **停下让用户确认照原型方向对了** → 再推 F002+。
- i18n + 单测 + npm run build。

### F002 — Bento 能力区 + Logo 条（generator）
- Features(`Features.tsx`)照原型重做 **4 张 bento 色阶卡**(Brief/Match/Reach/Insight):material 图标(auto_awesome/travel_explore/forward_to_inbox/query_stats)+ 青 mono 标签 + 粗标题 + 描述;色阶分层无边框,hover 升级 + 青内发光。**去 5 张 feature 插画**。
- Logo 条:"Trusted by leading game studios" + 5 muted wordmark(可占位)。
- i18n + 单测 + npm run build。

### F003 — How-it-works + Stats + FAQ + 收尾 CTA + 结构重组（generator）
- 加 **How it works**(3 步 01/02/03 mono + 标题/描述)+ **Stats**(3 大青数字 + caption)。
- FAQ / FooterCTA 照原型重做(色阶 accordion / "Ready to lead the game?" 光晕 CTA 面板)。
- **结构重组:** `LandingPage.tsx` 组合改为原型顺序,**移除 PainPoints / BeforeAfter / EmailCenterDemo** section(原型无)。
- i18n + 单测 + npm run build。

### F004 — 清理 asset/死组件/死动效 + baseline 重拍（generator）
- 删 `public/landing/illustrations/` 的 **7 张**(保留 hero-illustration.png)+ 不再用的 illustration-asset 逻辑。
- 删不再 mount 的组件(PainPoints/BeforeAfter/EmailCenterDemo 若全仓无引用)+ 死动效 keyframe(landing-hero-video-scale/cta-glow-pulse 等)。
- **visual-regression baseline 重拍**(Linux runner)+ 连带 e2e 断言更新;Lighthouse perf99 / a11y AA 复验不回退;npm run build 绿。

### F005 — Codex L1+L2 + signoff（codex）
- L1：lint 0err warn≤3 / tsc=0 / npm test + **npm run build**。
- L2 部署后 staging:① 落地页**视觉对齐 Stitch 原型**(screen.png 对比:hero/bento/steps/stats/FAQ/CTA + Neural Velocity 色阶/渐变/光晕/mono)② **Lighthouse perf≥99 / WCAG AA / reduced-motion 不回退** ③ visual baseline 已重拍绿 ④ 5 locale 文案正常。
- signoff `docs/test-reports/BL-114-signoff-2026-06-XX.md`。

## §3 风险

- **结构重组** 去 3 个 section + 删 7 插画 + 删组件 → grep 全仓零引用再删 + npm run build 绿(generator §14.4)。
- **照原型不等于像素拷贝**:原型是 Tailwind CDN HTML,Generator 翻译成项目 Tailwind v4 @theme + 现有组件惯例(i18n/a11y/测试),视觉对齐 screen.png 即可。
- **守 BL-080 不回退:** perf99 / WCAG AA / reduced-motion;landing visual baseline 必 Linux runner 重拍 + 连带断言。
- Hero-first 检查点(redo)仍是主观风险控制。⚠️ 部署 OOM NODE_OPTIONS=4096。
