# Landing v2 Visual Tokens — BL-078

> **D1：** 现代极简（Linear / Vercel / Stripe 风）
> **D2：** Linear (主) + Plausible (辅) — 不 1:1 复刻，取其精神（极简 / 大量 white space / 微妙 motion / 高质感 typography）
> **D3：** view transitions + scroll-driven + IntersectionObserver fallback
> **范围：** 落地页 11 components；app 端不受影响

## 1. 设计原则

| 维度 | Linear 范本 | Plausible 范本 | KOLMatrix Landing v2 取舍 |
|---|---|---|---|
| 整体节奏 | 大量留白 + 单 hero + 阶段化 reveal | 短 landing + B2B 直白 CTA | 11 components 不动，但每 section 加垂直呼吸（`--spacing-landing-section-y` clamp 5-9rem） |
| Typography | Display sans serif + 大 hero h1 | 中性 grotesk + 等价正文 | Geist sans 保留；hero clamp(2.75-5.5rem) 比旧的 64-124px 稍收敛但更协调 |
| 色彩 | 近黑 (#08090a) + 高对比 ink | 暖灰黑 (#1a1a1a) + 单色 accent | 保 Neural Velocity 主调（navy + cyan + purple），landing 层 deeper canvas + 略冷 off-white ink |
| Motion | scroll-driven 微动 + view transitions | 几乎无 motion | 全栈现代化（D3 lock）；fallback 守 Firefox / 旧 Safari / prefers-reduced-motion |
| CTA | 圆角 pill + 微妙 glow + hover scale | 矩形 + 实色 hover 反转 | 圆角 pill + cyan glow + view-transition trigger（F002） |

## 2. Token 清单（25 项）

### 2.1 Typography（6 size + 4 leading + 3 tracking = 13）

| Token | 值 | 用途 |
|---|---|---|
| `--text-landing-hero` | clamp(2.75rem, 6vw, 5.5rem) | Hero h1（44-88px） |
| `--text-landing-h2` | clamp(2rem, 4vw, 3.25rem) | Section h2（32-52px） |
| `--text-landing-h3` | clamp(1.25rem, 2vw, 1.75rem) | Card / sub h3（20-28px） |
| `--text-landing-body-lg` | 1.125rem | Hero subtitle / 长正文 |
| `--text-landing-body` | 1rem | 默认正文 |
| `--text-landing-eyebrow` | 0.6875rem | Eyebrow / mono label（11px） |
| `--leading-landing-display` | 0.95 | Hero / 大字 display |
| `--leading-landing-tight` | 1.1 | h2 / h3 |
| `--leading-landing-normal` | 1.5 | 正文 |
| `--leading-landing-relaxed` | 1.7 | 段落 / FAQ 答 |
| `--tracking-landing-display` | -0.035em | Hero 收紧 |
| `--tracking-landing-tight` | -0.02em | h2 / h3 收紧 |
| `--tracking-landing-eyebrow` | 0.3em | mono eyebrow 宽松 |

### 2.2 Color（5 项）

| Token | OKLCH | 近似 HEX | 用途 |
|---|---|---|---|
| `--color-landing-canvas` | oklch(14.5% 0.022 265) | ~#080f1c | 主背景（比 navy-base 略 deeper + cooler） |
| `--color-landing-canvas-elevated` | oklch(18.5% 0.025 264) | ~#141d31 | section sectional 背景 |
| `--color-landing-ink` | oklch(94% 0.012 240) | ~#ebeef5 | 主文字（略冷 off-white，Linear 风） |
| `--color-landing-ink-muted` | oklch(78% 0.018 240) | ~#b9c1ce | 正文 muted（F005 a11y fix：70%→78% 守 /70 opacity 路径 4.5:1）|
| `--color-landing-ink-subtle` | oklch(60% 0.020 240) | ~#7d8898 | eyebrow / footer / 微 meta（F005 a11y fix：52%→60%）|

**复用规则：** brand cyan (`--color-cyan`) / purple (`--color-purple`) / 中性 navy 全保留；landing-canvas 仅在 hero / FAQ / FooterCTA 等 dark sections 优先用，light sections 继续用 `--color-surface-light`。

### 2.3 Spacing（5 项）

| Token | 值 | 用途 |
|---|---|---|
| `--spacing-landing-section-y` | clamp(5rem, 9vw, 9rem) | section 垂直 padding |
| `--spacing-landing-container-x` | clamp(1.5rem, 5vw, 6rem) | section 水平 padding |
| `--spacing-landing-element-tight` | 0.5rem | eyebrow → h1 |
| `--spacing-landing-element-normal` | 1.5rem | h1 → subtitle |
| `--spacing-landing-element-loose` | 3rem | subtitle → CTA group |

### 2.4 Motion（5 项）

| Token | 值 | 用途 |
|---|---|---|
| `--duration-landing-short` | 200ms | hover micro-interaction |
| `--duration-landing-medium` | 400ms | reveal / card entrance |
| `--duration-landing-long` | 800ms | hero fade-in / scroll-driven |
| `--ease-landing-out` | cubic-bezier(0.16, 1, 0.3, 1) | Linear-style expressive ease-out |
| `--ease-landing-in-out` | cubic-bezier(0.65, 0, 0.35, 1) | 平滑双向 |

### 2.5 Radii（2 项 — 附加）

| Token | 值 | 用途 |
|---|---|---|
| `--radius-landing-card` | 18px | Feature / Pain / Trust card |
| `--radius-landing-pill` | 9999px | CTA pill |

## 3. 使用约定（F002-F004 实施时遵守）

1. **新加视觉规则优先用 landing token**，不强制全量替换现有 `text-cyan` / `bg-surface` 类（避免大 diff 触发 visual baseline noise > 5%）
2. **Tailwind 利用：** `--color-landing-*` / `--text-landing-*` / `--leading-landing-*` / `--tracking-landing-*` / `--spacing-landing-*` / `--ease-landing-*` 由 Tailwind v4 自动生成对应 utility（`bg-landing-canvas` / `text-landing-hero` / `leading-landing-tight` 等），可直接用
3. **duration 非自动 utility：** 用 arbitrary value `duration-[var(--duration-landing-medium)]` 或 `style={{ transitionDuration: 'var(--duration-landing-medium)' }}`
4. **motion 必带 fallback：** 所有 motion 用 `@media (prefers-reduced-motion: no-preference)` 守门或确保 reduce 状态下视觉不破（参 globals.css `[data-landing-cinematic]` 现有规则）
5. **mesh gradient / glow** 由 F002 引入 utility class（`.landing-mesh-hero` 等），统一引用而非散落 inline style

## 4. 迁移计划

- **F002（Hero + TopNav）：** 引入 hero h1 typography + spacing-section + mesh-hero utility + landing-ink 主文字
- **F003（PainPoints / Features / BeforeAfter / EmailCenterDemo）：** section h2 + cards radius + element spacing + scroll-driven token
- **F004（Trust / FAQ / FooterCTA / SectionTransition）：** secondary CTA glow 与 Hero 统一 + FAQ smooth-height motion
- **OUT-OF-SCOPE：** app 端（/insight / /match / /brief）不动；本 token layer 仅服务 landing

## 5. 风险 / 兜底

- 5 locale text overflow：hero clamp 顶值 5.5rem 比旧 7.75rem (124px) 收敛 30%，ja / ko 长字符更不易溢出；F005 抽样验证
- LCP 性能：mesh gradient 用 radial-gradient stack（< 1KB CSS），不引入额外 asset；F002 单独 commit + Lighthouse 实测 ≥85 守门
- a11y 对比度：ink (94% L) vs canvas (14.5% L) ≈ 16:1，远超 WCAG AA 7:1；ink-subtle (52% L) vs canvas ≈ 6.2:1，正文 AA ≥ 4.5:1 仍 PASS（不用作纯正文，仅 eyebrow）

## 6. 参考

- Linear https://linear.app
- Plausible https://plausible.io
- ADR-003 Pixel-Perfect Visual Standard
- BL-070 #29+#30 Suspense skeleton 像素镜像（CLS < 0.05 守门）
- framework/harness/ui-fidelity-guardrail.md
