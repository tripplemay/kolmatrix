# BL-078 Landing Visual Polish Spec — 不动结构/文案/业务路径的视觉精修

> **Sprint：** BL-078-landing-visual-polish
> **Type：** Visual polish（非业务批次；纯视觉精修，0 业务代码逻辑改动 / 0 文案 / 0 结构变更）
> **预估工时：** ~17h ≈ 2 day Generator + 0.5 day Reviewer
> **关联：** /everything-claude-code:plan v2 (5/27 用户 ack) + Phase 1 D1-D3 全 lock (5/27)
> **状态：** A0+A1 完成 → 待 building
> **依赖：** BL-077 done @ tag bl077-done @ 0fc8abf（已满足）
> **参照：** ADR-003 像素完美视觉标准 + ui-fidelity-guardrail.md + BL-070 #29+#30 Suspense skeleton 像素镜像沉淀 + BL-074 5 路由 nav alignment

---

## §1 背景与触发

### 1.1 用户反馈触发

5/27 用户 /plan 命令 + 反馈：
> "目前页面的内容、顺序、板块没有问题，但是不够美观"

**范围严格收窄：** 不动 11 components 结构 / sections 顺序 / 文案 / 业务路径。仅视觉精致度升级。

### 1.2 Plan v2 + D1-D3 Lock（用户 5/27 ack）

| 决策 | Lock | 说明 |
|---|---|---|
| **D1 美感方向** | 现代极简（Linear / Vercel / Stripe 风）| B2B SaaS marketer 业务契合 + dark theme + 大量 white space |
| **D2 参考案例** | Linear 主（https://linear.app）+ Plausible 辅（https://plausible.io）| Linear: dark theme 极简标杆 + 顶级 typography + scroll-driven motion 完整范本 / Plausible: B2B SaaS conversion-focused 短 landing |
| **D3 视觉技术栈** | 全栈现代化 — view transitions API + scroll-driven animations | native Chrome/Safari 新 API + IntersectionObserver/framer-motion fallback for Firefox / 旧 Safari |

### 1.3 角色分配

role_assignments = null（默认映射）

---

## §2 整体范围 / 边界

### 2.1 IN-SCOPE

- F001 视觉 token 规范定义（typography / color / spacing / motion tokens）
- F002 Hero + TopNav 视觉精修（LCP 关键路径，view transitions setup）
- F003 Body 4 sections 精修（PainPoints / Features / BeforeAfter / EmailCenterDemo）
- F004 Trust / FAQ / FooterCTA / SectionTransition 精修
- F005 visual baseline regen + 5 locale × 4 viewport + Lighthouse perf + a11y verify
- F006 Codex Reviewer L1+L2 + signoff

### 2.2 OUT-OF-SCOPE（明示）

- 11 components 增删 / 合并 / 重构（**保结构不动**）
- sections 顺序调整（**保顺序不动**）
- 文案 / i18n 内容修改（**保文案不动**；仅 typography 微调可能影响 line break 不算改文案）
- 业务路径修改（CTA → /request-access form + wantsDemo 链路保留）
- Auth redirect 修改（authenticated → /insight 保留）
- sitemap / robots / canonical 修改
- 新 i18n locale 添加（保现 zh/en + ja/ko/es 现状）

### 2.3 不变量

1. **0 业务逻辑改动**（仅 UI styling / motion / transition CSS / framer 集成）
2. **11 components 文件保留**（每 component 内部可改，但文件名 / export 不改）
3. **性能 不 regression：** 保 BL-070 标准（logged-out anonymous Lighthouse Desktop）：
   - perf ≥ 85
   - LCP < 2.5s
   - CLS < 0.05
   - TBT < 200ms
4. **i18n 文本不动：** 不改 messages/*.json 内容（仅 typography CSS 可微调）
5. **设计稿驱动：** D2 lock 的 Linear（主）+ Plausible（辅）是 visual reference 而非 1:1 复刻；Generator 实施时取其精神（极简 / 大量 white space / 微妙 motion / 高质感 typography），不强制像素一致
6. **view transitions 必带 fallback：** Firefox / 旧 Safari 退化为普通跳转或 IntersectionObserver-based animation，acceptance 强制 browser matrix check
7. **a11y 不 regression：** contrast ≥ WCAG AA, keyboard nav, focus visible（不应因 motion / 视觉精致而降级）

---

## §3 实施 Phase 划分

| Phase | 范围 | 工时 | 谁做 |
|---|---|---|---|
| **A0** | Plan v2 + 现状审计（11 components / 5 locale / BL-070 #29+#30 sediment） | ✅ done |
| **A1** | D1-D3 lock | ✅ done |
| **B** | F001 视觉 token 规范定义 | 2h | Generator |
| **C** | F002 Hero + TopNav 精修 + view transitions setup | 4h | Generator |
| **D** | F003 Body 4 sections 精修 | 5h | Generator |
| **E** | F004 Trust / FAQ / FooterCTA / SectionTransition 精修 | 2h | Generator |
| **F** | F005 baseline regen + perf + a11y verify | 2h | Generator |
| **G** | F006 Reviewer L1+L2 + signoff | 2h | Codex |

**总：** ~17h ≈ 2 day Generator + 0.5 day Reviewer

**建议 commit 分批：**
1. F001 视觉 token（单 commit，建立 design tokens 基础）
2. F002 Hero + TopNav（单 commit，先 deploy staging 实测 LCP）
3. F003a PainPoints + Features（单 commit）
4. F003b BeforeAfter + EmailCenterDemo（单 commit）
5. F004 Trust + FAQ + FooterCTA + SectionTransition（单 commit）
6. F005 baseline regen + perf verify（单 commit）
7. F006 Reviewer signoff

---

## §4 Features 详细描述

### F001: 视觉 token 规范定义

**Why：** 现 Tailwind v4 @theme tokens 散落各处，BL-078 视觉精修需统一 token 基础给 Generator 实施时一致引用，避免 typography / color 散乱。

**What：**

1. 新建或扩展 `src/app/globals.css`（或 `tailwind.config.ts` 的 @theme）含 landing-specific token：

```css
@theme {
  /* Typography scale (Linear / Plausible 风, modern serif 或 grotesk) */
  --font-display: var(--font-sans);  /* 复用现有 */
  --font-size-hero-h1: clamp(2.5rem, 6vw, 4.5rem);
  --font-size-section-h2: clamp(2rem, 4vw, 3rem);
  --font-size-section-h3: clamp(1.25rem, 2vw, 1.75rem);
  --font-size-body-lg: 1.125rem;
  --font-size-body-base: 1rem;
  --line-height-tight: 1.1;
  --line-height-normal: 1.5;
  --line-height-loose: 1.75;
  --tracking-tight: -0.02em;
  --tracking-normal: 0;
  --tracking-wide: 0.05em;

  /* Color tokens — Linear-inspired dark theme refinement */
  --landing-bg-base: oklch(...);  /* 比现 navy-base 略 deeper / 略 cooler */
  --landing-bg-section: oklch(...);  /* 微妙 sectional contrast */
  --landing-text-primary: oklch(...);  /* 比现 white 略 dimmer 增 sophistication */
  --landing-text-muted: oklch(...);
  --landing-accent-cyan: var(--cyan-fixed);  /* 复用现有 brand */
  --landing-accent-purple: var(--purple);
  --landing-gradient-hero: linear-gradient(...);  /* 微妙 mesh gradient */

  /* Spacing rhythm (sections vertical scale, Linear-inspired) */
  --space-section-y: clamp(4rem, 8vw, 8rem);
  --space-container-x: clamp(1.5rem, 5vw, 6rem);
  --space-element-y-tight: 0.5rem;
  --space-element-y-normal: 1.5rem;
  --space-element-y-loose: 3rem;

  /* Motion tokens (scroll-driven + view transitions) */
  --motion-duration-short: 200ms;
  --motion-duration-medium: 400ms;
  --motion-duration-long: 800ms;
  --motion-ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --motion-ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

2. 新建 `design-draft/landing-v2-tokens.md` 文档化 token 规范 + 复用规则

3. 验证：landing 11 components 现有 CSS 是否需要 migration 到新 tokens（保留 fallback 兼容）

**Acceptance：**
- [ ] @theme tokens 落地（typography scale + color + spacing + motion 4 类 ≥20 token）
- [ ] design-draft/landing-v2-tokens.md ≥30 LOC（含 reference Linear / Plausible 对照 + 复用规则）
- [ ] 现有 11 landing components 通过 globals.css 引入 token（不强制全替换，但新加视觉效果优先用 token）
- [ ] L1 lint + tsc PASS（CSS 变更不破 build）

---

### F002: Hero + TopNav 视觉精修 + view transitions setup

**Why：** Hero 是 LCP 关键路径，且 first-impression 视觉决定整体 landing 印象。view transitions 在 navigation 跳转时提供高级体验，需先在 Hero / TopNav 设立 baseline。

**What：**

1. `src/app/[locale]/(marketing)/_components/HeroVideo.tsx`：
   - 应用 F001 token（hero h1 typography + spacing）
   - 加 scroll-driven animation：hero 内容 fade-in on enter, video 微妙 scale on scroll（保 BL-070 #29+#30 LCP skeleton 像素镜像）
   - Hero gradient：现 cyan/navy 升级到 mesh gradient（Linear 风）
   - CTA 按钮：现 cyan→深色 升级为 glow effect + hover 微动 + view transition trigger
   - **保 CTA href `/request-access` 不变**

2. `src/app/[locale]/(marketing)/_components/TopNav.tsx`：
   - 应用 F001 token
   - sticky + backdrop-blur 优化（Linear / Stripe 风）
   - locale switcher + login CTA 视觉精修

3. **view transitions setup：**
   - `src/app/[locale]/layout.tsx`（或 marketing layout）加 `<meta name="view-transition" content="same-origin" />` 或类似 CSS opt-in
   - 用 `@view-transition { navigation: auto; }` CSS rule 启用
   - Firefox / 旧 Safari fallback: 走普通 navigation（无效果但不破）

**Acceptance：**
- [ ] HeroVideo + TopNav 应用 F001 tokens
- [ ] hero scroll-driven animation（fade-in / scale）落地（Chrome/Safari native CSS）
- [ ] hero gradient 升级 mesh gradient
- [ ] CTA glow effect + hover 微动 + view transition trigger
- [ ] TopNav sticky + backdrop-blur 优化
- [ ] view transitions opt-in CSS + Firefox fallback acceptance（无效果不破）
- [ ] Lighthouse Desktop logged-out 实测：perf ≥85 + LCP <2.5s + CLS <0.05 + TBT <200ms（per BL-070 标准，不 regress）
- [ ] staging /zh + /en 实测 Hero + TopNav 视觉 OK
- [ ] CTA click → /request-access 跳转链路不破

---

### F003: Body 4 sections 精修（PainPoints / Features / BeforeAfter / EmailCenterDemo）

**Why：** 4 sections 是 landing 主体，视觉占整体 60%+，精修后整体观感升级最显著。

**What：**

1. `PainPoints.tsx`：
   - 应用 F001 token
   - 现 sticky stack 升级 scroll-driven progress（数字滚动 / icon entrance stagger）
   - light reveal motion 优化

2. `Features.tsx`：
   - 应用 F001 token + 6 module cards 视觉精修
   - 现 sticky stack 升级，每 card 滚到视窗时微妙 reveal + hover micro-interaction
   - icon 风格统一（Material Symbols 现有，不变）

3. `BeforeAfter.tsx`：
   - 应用 F001 token
   - sticky row-highlight 升级 horizontal scroll-snap 或更精致的 reveal（Linear 风）

4. `EmailCenterDemo.tsx`：
   - 应用 F001 token
   - sticky-parallax callouts 视觉精修
   - 产品截图 / 数据可视化 微调

**Acceptance：**
- [ ] 4 sections 应用 F001 tokens
- [ ] scroll-driven animations native CSS（Chrome/Safari）+ IntersectionObserver fallback
- [ ] 每 section single commit + visual baseline regen
- [ ] 5 locale × 4 viewport 视觉验证（baseline diff < 5% noise）
- [ ] CLS < 0.05（per BL-070 #29+#30 skeleton 像素镜像沉淀守门）
- [ ] L1 PASS

---

### F004: Trust + FAQ + FooterCTA + SectionTransition 精修

**Why：** 4 components 整体重要性次于 Body，但 trust signal + FAQ + Footer CTA 影响 conversion 信任感。

**What：**

1. `TrustPlaceholder.tsx`：
   - 应用 F001 token
   - logo wall 视觉精修（如有）/ KPI 数字 typography 升级
   - light sticky stack 优化

2. `FAQ.tsx`：
   - 应用 F001 token
   - 折叠交互 motion 升级（current → smooth height transition）
   - typography 升级

3. `FooterCTA.tsx`：
   - 应用 F001 token
   - 二次 CTA 视觉精修（与 Hero CTA 视觉统一）
   - access waitlist link 视觉强化

4. `SectionTransition.tsx`：
   - 应用 F001 token
   - gradient strip 精修（衔接更平滑 + 微妙 motion）

**Acceptance：**
- [ ] 4 components 应用 F001 tokens
- [ ] FAQ 折叠 motion 升级（smooth height transition）
- [ ] FooterCTA 与 Hero CTA 视觉统一
- [ ] visual baseline regen 4 viewport × 5 locale
- [ ] L1 PASS

---

### F005: visual baseline regen + 5 locale + Lighthouse + a11y verify

**Why：** 整体视觉精修后必须全验证：visual / 性能 / a11y / 5 locale text overflow。

**What：**

1. 触发 GitHub Actions `update-visual-baselines.yml` workflow：
   - 4 viewport（Desktop 1920 / Tablet 768 / Mobile 375 / Wide 2560）
   - 5 locale spot check（zh / en / ja / ko / es）
   - 11 components × 4 viewport × 5 locale = ~220 visual snap
   - baseline 入 git

2. **Lighthouse Desktop logged-out**：
   - perf ≥ 85
   - LCP < 2.5s
   - CLS < 0.05
   - TBT < 200ms
   - SEO ≥ 90
   - a11y ≥ 90

3. **a11y verify**：
   - keyboard nav: Tab through 所有 CTA / 链接 / form
   - focus visible: outline 清晰
   - contrast: WCAG AA (text vs background ≥ 4.5:1, large text ≥ 3:1)
   - aria-label / aria-hidden 关键交互

4. **5 locale text overflow**：抽 ja / ko（通常比 en 长 20-30%）+ es 验关键 sections 不溢出 hero / cards / FAQ

5. **Browser matrix check**：
   - Chrome 115+ / Safari 18+: native view transitions + scroll-driven animations
   - Firefox latest: fallback path（IntersectionObserver / framer-motion 退化无效果但不破）
   - 旧 Safari (< 18): fallback OK

**Acceptance：**
- [ ] visual baseline ~220 PNG 入 git
- [ ] Lighthouse 6 项门槛全 PASS
- [ ] a11y 4 项手动 verify PASS
- [ ] 5 locale text overflow spot check PASS
- [ ] browser matrix check PASS（含 fallback）

---

### F006: Codex Reviewer L1+L2 + signoff

**L1 自动化：**
1. `npm run lint` PASS（0 error / warning ≤ 3）
2. `npx tsc --noEmit` PASS
3. `npm test` PASS（含 visual baseline test + i18n-locale-coverage）
4. 11 components 文件存在 + export 不变（grep verify）
5. messages/*.json 5 locale 无新加 key（仅可能微调）

**L2 staging 抽样实测：**
1. /zh + /en + /ja + /ko + /es Hero 区域视觉 OK
2. CTA → /request-access 跳转链路不破（含 view transition 效果实测）
3. Lighthouse Desktop logged-out perf ≥ 85（per BL-070 standard）
4. a11y keyboard nav + contrast 抽样
5. Firefox / 旧 Safari fallback 实测（native API 不支持时退化 OK）
6. 设计参照（Linear / Plausible）的精神是否在 landing 落地（极简 / white space / 微妙 motion）

**Acceptance（signoff）：**
- [ ] L1 5 项 + L2 6 项 PASS
- [ ] 0 visual regression（per visual baseline diff）
- [ ] 0 perf regression（per Lighthouse）
- [ ] 0 业务路径破坏
- [ ] signoff doc `docs/test-reports/BL-078-signoff-2026-05-XX.md`

---

## §5 风险 / 应对

| 等级 | 风险 | 应对 |
|---|---|---|
| **🟡 MEDIUM** | LCP 性能 regression（motion / shadow / mesh gradient 过度）| F002 单独 commit + Lighthouse 实测；超阈即回退 token; BL-070 #29+#30 skeleton 像素镜像守门 |
| **🟡 MEDIUM** | view transitions / scroll-driven Firefox 退化体验差 | F005 强制 browser matrix check + fallback 必须 functional（无效果可接受，破坏 navigation 不可接受）|
| **🟡 MEDIUM** | 5 locale text overflow（ja / ko 长字符触发 hero h1 换行错乱）| F005 强制 5 locale × 4 viewport 抽样 + typography 容错（line-height / max-w 配置）|
| **🟢 LOW** | Linear / Plausible 风格不完美匹配 KOLMatrix gaming 业务 | D2 lock 时已选最契合两参考；Reviewer L2 验"精神落地"非"像素一致"|
| **🟢 LOW** | CLS 因 motion / scroll-driven 微增 | F005 Lighthouse CLS < 0.05 守门 |
| **🟢 LOW** | bundle size 微增（framer-motion fallback 引入）| F005 bundle-analyzer 验，预期 < 30KB（tree-shake 后）|
| **🟢 LOW** | a11y 因 motion 降级（vestibular disorder 等）| F005 加 `prefers-reduced-motion` media query 守门，敏感用户走简化 motion |

---

## §6 Done Definition

- [ ] F001-F006 全 acceptance PASS
- [ ] Reviewer L1+L2 PASS（signoff doc 终签）
- [ ] progress.json status = done
- [ ] backlog.json BL-078 entry 移除
- [ ] .auto-memory/project-status.md BL-078 DONE marker
- [ ] visual baseline ~220 PNG 入 git
- [ ] Lighthouse perf ≥ 85 / LCP < 2.5s / CLS < 0.05 / TBT < 200ms 守门
- [ ] 11 components 文件保留 + 业务路径不破

---

## §7 沉淀候选（done 阶段或 v0.9.25 batch）

1. **landing visual token 规范模板**（typography scale + color + spacing + motion tokens）入 framework/harness/ui-fidelity-guardrail.md 或新文件
2. **view transitions + scroll-driven 渐进增强 + fallback 模板**（Native CSS API + IntersectionObserver fallback）入 generator.md §"现代 CSS 渐进增强"段
3. **prefers-reduced-motion 守门模式**（任何 motion 必带 reduced-motion fallback）入 evaluator.md a11y 验收 checklist
4. **5 locale text overflow spot check 模板**（ja/ko 长字符 + 关键 sections 容错）入 planner-checklists.md §spec acceptance i18n 段

---

## §8 后续

- BL-078 done 后 prod deploy 让用户实测视觉精修效果
- v0.9.25 framework sediment batch（BL-078 4 沉淀候选 + 未来累积）
- Phase 5 / 真客户 onboarding 等
