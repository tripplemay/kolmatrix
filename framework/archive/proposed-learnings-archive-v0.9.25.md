# Proposed Learnings Archive — v0.9.25

> **沉淀完成日期：** 2026-05-27
> **来源批次：** BL-078-landing-visual-polish done @ tag `bl078-done` @ commit `4d62610`
> **沉淀范围：** 5 条 user-acked candidates → 4 实际段 + 1 同主题合并段
> **CHANGELOG：** `framework/CHANGELOG.md` v0.9.25 段（顶部）
> **0 chronological-append §N：** 全部 inline-merge 落入现有 topic（per D7 lock）

---

## §1 沉淀总览

5 条 sediment 全部用户 2026-05-27 ack（BL-078-F005 fix-round 1 完成后 + plan v2 D2 lock 时实战印证）。

| # | 1-line summary | 类型 | 来源 | 写入位置 |
|---|---|---|---|---|
| #1 | opacity-based dimming 在 WCAG AA contrast 上 fragile — parent opacity × text alpha 双重 dimming kills contrast + 4 重 distinction 替代模板 | 新坑 | BL-078-F005 fix-round 1 | `evaluator.md §11.6`（合并 #5）|
| #2 | landing visual token layer 规范模板 — 4 类 token 分层 + light-theme accent 必有 deep variant | 新规律 | BL-078-F001 | `ui-fidelity-guardrail.md §3.4` |
| #3 | @view-transition + animation-timeline + interpolate-size 渐进增强模式 — Native + Fallback + reduced-motion 三层守门 | 新规律 | BL-078-F002+F003 | `generator.md §18` |
| #4 | Landing / marketing 视觉重做项目: Reference URL 提炼方法论 — 解构 → 筛选 → 抽象 3 步法 | 模板修订 | BL-078 plan v2 D2 lock | `planner-checklists.md §"Visual polish reference URL 提炼方法论"` |
| #5 | prefers-reduced-motion 守门是 motion 类 batch 的 a11y 必修课 — 全局 default + component 级精细兜底双层模板 | 新规律 | BL-078-F005 | `evaluator.md §11.6`（合并 #1）|

---

## §2 同主题合并标注

**合并段：motion a11y 三件套（#1 + #5 同主题合并入 evaluator.md §11.6）**

**Before（独立两段）：**
- #1 opacity-dimming a11y trap — focused on parent opacity × text alpha 双重 dimming + 4 重 distinction 替代
- #5 prefers-reduced-motion 守门 — focused on motion 类 batch 的 reduced-motion 兜底 @media 模板

**合并理由：** 两条都属"motion 类视觉效果的 a11y 验收"维度，且 #1 实战中实际包含 motion-heavy 场景（sticky-parallax / scroll-driven inactive 元素的 opacity dimming），#5 reduced-motion 守门则是任何 motion 必带的 a11y 兜底。两者+ 既有 contrast WCAG AA 形成"三件套"：

- **件 1：contrast WCAG AA**（既有验收标准，Lighthouse `color-contrast` audit）
- **件 2：opacity-dimming trap**（#1，新加 — 防止 parent opacity × text alpha 双重 dimming）
- **件 3：prefers-reduced-motion 守门**（#5，新加 — motion 必带 reduce 兜底）

合并位置：`framework/harness/evaluator.md §11.6 "motion a11y 三件套验收"`（在 §11.5 字体子集 spot check 之后，§12 验收口径 之前；inline-merge under existing §11 L2 验收手段 topic，非 chronological-append）。

**After（合并段，单段含 3 件套）：** 详 `evaluator.md §11.6` 全文。

---

## §3 五条 sediment 全文（按 # 顺序）

### #1 opacity-dimming a11y trap (BL-078-F005 fix-round 1 / Generator + Planner Kimi)

**类型：** 新坑（v0.9.25 候选 #1）

**内容：** **opacity-based dimming 在 WCAG AA contrast 上 fragile — parent opacity × text alpha 双重 dimming kills contrast**。BL-078-F005 实战: 用 `opacity-50` 给 inactive sticky stack 元素做"褪色 inactive"视觉效果, 但当 parent 已带 `opacity-50` + text color 已经是 `oklch(.78 ... / .80)` 类带 alpha 的颜色时, 双重 dimming 让实际 visible contrast 跌破 WCAG AA 4.5:1 阈值, Reviewer L2 audit 直接 fail.

**修复 pattern：** 4 重 distinction 替代 opacity-50:
1. **Icon scale**: active 1.0 / inactive 0.85 (size 区别 active state)
2. **Icon color**: active accent / inactive ink-muted (不动 alpha, 改 color value)
3. **Cell background color**: active 高 contrast bg / inactive 低 contrast bg (bg 区别)
4. **Progress fill**: active gradient / inactive solid muted

**反面：** 任何 active/inactive UI state 默认用 `opacity-X` 都是 a11y trap 候选, 必须先验 contrast ratio. 推荐 grep `opacity-[0-9]+` in landing/marketing components.

**实战数据（BL-078-F005 fix-round 1）：**
- Reviewer verifying FAIL：Lighthouse `color-contrast.score = 0`，13 elements flagged，contrast 1.41-3.15:1（远低于 4.5:1）
- 修复 commits：`7dfb5b9`（删 BeforeAfter `opacity-50` + StickyParallax `opacity-40 → opacity-70` + Features/Trust eyebrow `text-cyan → text-landing-cyan-deep`）+ `b85d34a`（StickyParallax index `text-cyan/80 → text-cyan` 去 80% alpha）
- 修复后：`color-contrast.score = 1`，0 violations，a11y 0.96 → 1.0

**建议写入：** `framework/harness/evaluator.md §a11y 验收 checklist 新加段（与 #5 reduced-motion 同主题合并入 §11.6 "motion a11y 三件套"）

**状态：** 用户 5/27 ack（fix-round 1 完成）— 待 v0.9.25 framework sediment batch 落地 ✓

---

### #2 landing visual token layer (BL-078-F001 / Generator + Planner Kimi)

**类型：** 新规律（v0.9.25 候选 #2）

**内容：** **landing visual token layer 规范模板 — typography / color / spacing / motion 4 类 token 分层**。BL-078-F001 实物落 `src/app/globals.css` @theme 扩展 + `design-draft/landing-v2-tokens.md` 规范文档. 关键经验: landing 视觉精修不应"散乱直接改 component CSS", 必先建 token 层 (single source of truth), components 引 token, 这样未来调 token 即批量调全 landing.

**4 类 token 规范：**
- **Typography**: font scale (hero h1 clamp / section h2 / body lg/base) + line-height (tight/normal/loose) + tracking (tight/normal/wide)
- **Color**: bg layer (base/section) + text layer (primary/muted/subtle) + accent layer (现有 brand 复用 + 新 hero gradient)
- **Spacing**: section-y (clamp 4-8rem) + container-x (clamp 1.5-6rem) + element-y (3 级 tight/normal/loose)
- **Motion**: duration (short 200ms / medium 400ms / long 800ms) + ease curves (out / in-out)

**实战补充（fix-round 1 后追加）：** Light-theme accent 必有 deep variant —— `--color-cyan` #00E5FF luminance ~0.73 在 `bg-surface-light` luminance ~0.91 下 contrast ~1.23:1 直接 fail；必配 `--color-landing-cyan-deep: oklch(45% 0.10 215)` 给 light-theme eyebrow 等用，contrast ~5.5:1 PASS。

**建议写入：** `framework/harness/ui-fidelity-guardrail.md` 新段 §"landing / marketing 视觉 token layer 规范"（含 4 类 token + design-draft/landing-v2-tokens.md 复用案例）

**状态：** 用户 5/27 ack — 待 v0.9.25 framework sediment batch 落地 ✓

---

### #3 现代 CSS 渐进增强 (BL-078-F002+F003 / Generator + Planner Kimi)

**类型：** 新规律（v0.9.25 候选 #3，扩展 BL-076 ADR 类似)

**内容：** **@view-transition + scroll-driven + interpolate-size 渐进增强模式 — Native CSS 优先 + Firefox/旧 Safari fallback**。BL-078-F002/F003 实物落 view transitions API + animation-timeline 等 Chrome 115+/Safari 18+ 原生 CSS, Firefox/旧 Safari 走 IntersectionObserver 退化 (无 motion 但 navigation 不破).

**渐进增强 pattern：**
```css
/* Native API 优先 */
@supports (animation-timeline: view()) {
  .reveal { animation: fade-in linear; animation-timeline: view(); animation-range: cover 0% cover 30%; }
}

/* Fallback for Firefox / 旧 Safari */
@supports not (animation-timeline: view()) {
  .reveal { /* JS-driven via IntersectionObserver or framer-motion */ }
}

/* prefers-reduced-motion 守门 */
@media (prefers-reduced-motion: reduce) {
  .reveal { animation: none; opacity: 1; }
}
```

**BL-078 实物锚定（3 个现代 CSS API 各自落地）：**
- `@view-transition { navigation: auto; }` — cross-document view transitions（landing → /request-access）
- `animation-timeline: view()` — Hero scroll-driven fade-in + video scale + Body 4 sections reveal
- `interpolate-size: allow-keywords` + `::details-content` — FAQ smooth height transition

**建议写入：** `framework/harness/generator.md` 新段 §"现代 CSS 渐进增强 — Native API + Fallback + reduced-motion 三层守门"（含 BL-078 实战 + 模板）

**状态：** 用户 5/27 ack — 待 v0.9.25 framework sediment batch 落地 ✓

---

### #4 Reference URL 提炼方法论 (BL-078 plan v2 / Planner Kimi)

**类型：** 模板修订（v0.9.25 候选 #4）

**内容：** **Landing / marketing 视觉重做项目: 参考案例提炼方法论 — D2 lock 的 reference URL 是"精神参考"非"像素复刻"**。BL-078 lock Linear (主) + Plausible (辅) 作为视觉 reference, 但 Reviewer L2 验收时 acceptance 是"设计参照 Linear / Plausible 精神 (极简 / white space / 微妙 motion) 在 landing 落地" 不是"像素一致". 这避免了机械复制陷阱 (源/目标产品定位不同, 1:1 复刻可能破坏自身 brand identity).

**Reference 提炼方法论 3 步：**
1. **解构**: 列 reference URL 的 5-10 个视觉信号 (e.g. Linear: dark theme + sans-serif clean + scroll-driven + 极简 hero + subtle gradient)
2. **筛选**: 哪些信号契合 KOLMatrix brand (cyan/purple/navy) + 哪些冲突
3. **抽象**: 落 token layer (F001) 而非直接 copy css

**BL-078 实战印证：** Reviewer F006 L2 acceptance 文字: "(6) 设计参照 Linear / Plausible 精神 (极简 / white space / 微妙 motion) 在 landing 落地"。signoff 实际通过的是 token layer + 视觉感受双线主观评判，**未** require 像素一致。

**建议写入：** `framework/harness/planner-checklists.md` §spec acceptance i18n 段附近新加 §"reference URL 提炼方法论 (visual polish 类批次)"

**状态：** 用户 5/27 ack — 待 v0.9.25 framework sediment batch 落地 ✓

---

### #5 prefers-reduced-motion 守门 (BL-078-F005 / Generator + Planner Kimi)

**类型：** 新规律（v0.9.25 候选 #5，扩展 BL-078 #1 a11y trap 同主题）

**内容：** **prefers-reduced-motion 守门是 motion 类 batch 的 a11y 必修课**。BL-078 全栈现代化 motion (view transitions + scroll-driven) 设计含三层守门: Native API + Fallback + `prefers-reduced-motion` 退化静态. F005 acceptance 含 "启用系统选项后所有 motion 退化为静态/瞬时切换" 实测.

**Pattern：** 任何 `animation`, `transition`, `transform` 类 motion 必加：
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

或 component 级精细控制 (与 #3 渐进增强模板配套).

**双层模板（globals.css 顶层 + component 级精细兜底）：**
```css
/* 1. 全局 default: 尊重用户系统偏好 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}

/* 2. component 级精细兜底（重要 motion 路径显式覆盖）*/
.landing-cta-primary { transition: transform 200ms, box-shadow 400ms; }
@media (prefers-reduced-motion: reduce) {
  .landing-cta-primary { transition: none; }
  .landing-cta-primary:hover { transform: none; }
}
```

**建议写入：** `framework/harness/evaluator.md` §a11y 验收 checklist 加 §"prefers-reduced-motion 守门验证"（与 #1 opacity-dimming 同段，合并入 §"motion a11y 三件套" 大段含 reduced-motion + opacity-dimming + contrast）

**状态：** 用户 5/27 ack — 待 v0.9.25 framework sediment batch 落地 ✓

---

## §4 写入位置 cross-reference 矩阵

| 写入文件 | § | 含 sediment # | 配套引用 |
|---|---|---|---|
| `framework/harness/evaluator.md` | §11.6 motion a11y 三件套 | #1 + #5（合并段）| ↔ generator.md §18.3（reduced-motion 模板）/ ↔ ui-fidelity-guardrail.md §3.4（color layer 配套）|
| `framework/harness/ui-fidelity-guardrail.md` | §3.4 Landing / marketing 视觉 token layer | #2 | ↔ generator.md §18（duration/ease token）/ ↔ planner-checklists.md §reference 提炼（token 而非 copy css）|
| `framework/harness/generator.md` | §18 现代 CSS 渐进增强 三层守门 | #3 | ↔ evaluator.md §11.6（验收）/ ↔ ui-fidelity-guardrail.md §3.4（token 配套）|
| `framework/harness/planner-checklists.md` | §"Visual polish reference URL 提炼方法论" | #4 | ↔ ui-fidelity-guardrail.md §3.4（落 token）|

---

## §5 验证流程（Reviewer F006 L1+L2）

**L1 自动化 6 项（grep 全命中 + 文件存在）：**

```bash
# 5 source IDs grep
grep -nE 'BL-078 #1' framework/harness/evaluator.md            # ≥1
grep -nE 'BL-078 #2' framework/harness/ui-fidelity-guardrail.md # ≥1
grep -nE 'BL-078 #3' framework/harness/generator.md             # ≥1
grep -nE 'BL-078 #4' framework/harness/planner-checklists.md   # ≥1
grep -nE 'BL-078 #5' framework/harness/evaluator.md             # ≥1

# 文件存在 + 长度
ls -l framework/archive/proposed-learnings-archive-v0.9.25.md   # ≥200 LOC
grep -c 'v0.9.25' framework/CHANGELOG.md                        # ≥1 (顶部段)

# proposed-learnings 5 entries 全清 + marker
grep -c '2026-05-27.*v0.9.25.*沉淀完成' framework/proposed-learnings.md  # =1
grep -cE '## \[2026-05-27\].*Claude CLI.*来源：BL-078' framework/proposed-learnings.md  # =0
```

**L2 抽样阅读 3 段：**
1. evaluator.md §11.6 — 验 a11y 三件套合并段 #1+#5 完整（4 重 distinction 模板 + reduced-motion 双层模板 + grep 防御）
2. generator.md §18 — 验 Native + Fallback + reduced-motion 三层守门模板清晰可执行
3. CHANGELOG v0.9.25 ↔ archive v0.9.25.md 对应关系（5 候选 1:1 全文 + 1 合并段标注）

---

## §6 与之前 archive 的关系

- v0.9.24 (`framework/archive/proposed-learnings-archive-v0.9.24.md`, 817 LOC, 17 条 sediment): BL-077 sediment batch，5 同主题合并段
- v0.9.25 (本档, ~210 LOC, 5 条 sediment): BL-078 sediment batch，1 同主题合并段 — scope 小约 3x

**两批共同特征：** 全 inline-merge，0 chronological-append §N，多个同主题合并段示范，sediment 全部用户书面 ack 后入档。

---

**沉淀完成标志：** v0.9.25 此 archive 文件入档 + CHANGELOG v0.9.25 段顶部位置 + proposed-learnings.md 5 entries 全清 + marker 标注。可对照 git diff 验证。
