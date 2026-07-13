# UI Fidelity Guardrail

> **沉淀来源：** KOLMatrix BM1 批次签收后 UI fidelity 审计（2026-04-24）
> **触发：** 用户反馈 `/discovery` `/database` 实现与 Stitch 原型差异大；Generator 形成"看到装饰性 UI 就简化/删除"模式；BM2 F003/F005 已重演
> **适用场景：** 任何涉及 Stitch 原型参考的 UI 页面 feature

---

## 1. 问题定义

Generator 实现 UI 页面时常见 3 类偏离：

1. **装饰性删除** —— 主搜索区、Insights Panel、Quick Stats、Bulk Action Bar、AI CTA 等"非核心 CRUD 功能"被归类为"可删的装饰 UI"
2. **组件复用漏失** —— 抄 Stitch HTML 的 className 直接手写，忽视 `@/components/common/*` 的现有抽象
3. **幽灵控件** —— 保留 UI shell（如 checkbox）但未接功能（无 bulk action 反应），比完全删除更差 UX

根因：Generator prompt 中"对齐 Stitch xxx.html"被理解为"大体布局一致"，而非"逐元素还原"。

## 1.1 视觉参照物铁律（2026-04-24 发现 PNG 缩略图限制后新增）

**`design-draft/stitch-references/*.png` 全部是 512px 封顶的 Stitch preview 缩略图**（~240-512px × ~410-515px），仅作视觉索引（快速浏览找页面）用，**不是像素级参照物**。

**真实参照物是 HTML 文件**（`design-draft/stitch-references/*.html`）——用浏览器打开就是 Stitch 设计的真实 DOM 渲染（字号 / 颜色 / 间距 / icon / 动效全部精确到 CSS 值）。

### 所有角色的视觉参照规则

| 角色 | 读什么 | 怎么做 |
|---|---|---|
| **Planner 起草 spec** | HTML 源码（精确结构） + 浏览器打开 HTML（视觉） | `file:///.../kol-discovery.html` 在浏览器打开 + VS Code 看 className 源码，两者结合逐元素列"不得简化清单" |
| **Generator 实现** | HTML 浏览器渲染 + DevTools inspect | 浏览器开 HTML + 开发者工具看计算样式（比如 padding/margin 的 px 值），对照目标 Tailwind class 实现 |
| **Evaluator 签收** | HTML 浏览器并排 + staging screenshot | 两浏览器窗口并排（左 HTML 原型 / 右 staging 登录态同路由），同分辨率下肉眼逐 section 对 |

**禁止** 的做法：只看 PNG 缩略图做视觉判断——分辨率不够，细节全糊。

**过渡期**：`design-draft/stitch-references/renders/*.png`（~1920px 大 PNG，由未来 BL-010 script 自动从 HTML 渲染产出）出现前，只用 PNG 做"找页面"，像素对比仍用 HTML。

---

## 2. Spec 起草硬要求（Planner）

> **⚠️ 严格强制 — Planner spec 起草自检 checklist + Reviewer L1 受理前 checklist**
>
> Planner 起草 UI 类 feature spec 必须自检 4 段全含（见 `planner.md` §UI 类 spec 起草前 mandatory self-check checklist）；Reviewer L1 受理前必须 grep spec 确认 4 段都在，缺任一段 → 拒收 spec 退回 Planner 补全（不是 FAIL feature，是规格本身不合规）。
>
> 反面案例：BL-025 spec v1 仅含 §2.1，§2.2/2.3/2.4 全缺，靠用户 challenge 才补 → 来源 v0.9.6 [#5]。

**所有 UI 类 feature 的 acceptance 段必须包含以下 4 个子段：**

### 2.1 Stitch 原型参考路径（必须）

```markdown
**原型参考：** `design-draft/stitch-references/<page>.html`（用浏览器打开作为主视觉参照；同目录 .png 仅是 512px 缩略图索引，不够像素级对比）
```

### 2.2 必用公共组件清单（必须）

Generator 开工前对照清单，明确列出用 `@/components/common/*` 或 `@/components/ui/*` 哪些组件。例：

```markdown
**必用公共组件：**
- `GlassPanel` for 所有半透明容器
- `SectionHeader` for 每个 section 顶
- `GhostButton` / `SecondaryButton` / gradient CTA 用 `@/components/ui/Button` variants
- `StatCard` for KPI 卡片（如 dashboard F007 实现）
- `Dialog` for modal（若不存在需先抽取）
- `<TableRow> <TableCell>` for 表格（若不存在需先抽取）
```

### 2.3 不得简化的元素清单（必须）

Planner 起草 spec 时**逐条对照 Stitch 原型**，列出**看起来可删但不得删**的元素：

```markdown
**不得简化的元素**（Generator 若认为应简化须主动发 pre-impl 审计请求，不得自行删）：
- [ ] 主搜索区（platform selector + search + AI chips 轮转）
- [ ] AI Smart Match gradient CTA 按钮（右上角）
- [ ] Insights Panel（右侧窄列 320px 固定）
- [ ] Quick Stats 4 KPI strip（顶部）
- [ ] Bulk Action Bar（表格选中后底部浮动）
- [ ] Active Filter chips（可视化 + 可清除）
- [ ] Grid/List 视图切换 toggle
- [ ] ...
```

### 2.4 Visual regression baseline 硬性要求（必须）

```markdown
**Visual baseline：**
- 路径 `tests/screenshots/baseline/en-<page>.png` 必须入 git
- `git ls-files tests/screenshots/baseline/en-<page>.png` 返回非空才算 feature 完成
- Playwright scaffold 存在但 PNG 未生成 → 该 feature 判 PARTIAL 不算 PASS
```

---

## 3. Generator 开工硬要求

**UI 页面 feature 的 pre-impl 审计是强制的**（不是可选），含至少以下 3 条决议点：

### 3.1 "装饰性元素"每条明确处理

对 Stitch 原型中每个"看起来非 CRUD 核心"的元素（KPI 卡 / Insights / AI CTA / Quick Stats / Bulk Action 等），Generator 必须在 audit 里列：
- 方案 A：照原型实现（MVP 必须有）
- 方案 B：简化/删除（必须给出充分理由，Planner 裁决）
- 方案 C：占位 placeholder（如"Coming in BM2"按钮 disabled）

不得自行选 B 开工。

### 3.2 公共组件复用清单

Generator 在 audit 里列 5-8 条"本页将用哪些 `@/components/*` 组件"。缺失抽象时列"需要 Planner 批准新建 `XXXComponent`"。

### 3.3 幽灵控件检查

若原型有某控件（checkbox / toggle / dropdown）但 MVP 暂不接功能，Generator 有两个选择：
- **隐藏**：完全不渲染该控件
- **disabled + tooltip**："Coming soon"（disabled + opacity-50 + tooltip）

**不得保留 active 但无反应的幽灵控件**。

### 3.4 Landing / marketing 视觉 token layer 规范（BL-078 #2）

**触发场景：** landing / marketing 视觉精修类批次（非 CRUD app 页），如 BL-078。

**核心原则：** 视觉精修不应"散乱直接改 component CSS" — 必先建 token 层（single source of truth），components 引用 token，未来调 token 即批量调全 landing。Tailwind v4 `@theme` 自动从 `--color-*` / `--text-*` / `--leading-*` / `--tracking-*` / `--spacing-*` / `--ease-*` 等命名生成对应 utility class。

**4 类 token 分层（必含）：**

| 类 | token 类别 | 命名示例 | 用途 |
|---|---|---|---|
| **Typography** | font scale + line-height + tracking | `--text-landing-hero: clamp(2.75rem, 6vw, 5.5rem)` / `--leading-landing-display: 0.95` / `--tracking-landing-display: -0.035em` | Hero h1 / section h2/h3 / body lg/base / eyebrow 等 6 类 size + 4 类 leading + 3 类 tracking |
| **Color** | bg layer + text layer + accent layer | `--color-landing-canvas` / `--color-landing-ink` / `--color-landing-ink-muted` / `--color-landing-cyan-deep`（light-theme accent）| dark canvas + 现 brand cyan/purple/navy 复用 + 必含 deep variant for light-theme contrast |
| **Spacing** | section-y + container-x + element-y | `--spacing-landing-section-y: clamp(5rem, 9vw, 9rem)` / `--spacing-landing-container-x: clamp(1.5rem, 5vw, 6rem)` / `--spacing-landing-element-{tight,normal,loose}` | 3 级 element + section padding + container padding |
| **Motion** | duration + ease curves | `--duration-landing-short: 200ms` (medium 400 / long 800) + `--ease-landing-out: cubic-bezier(0.16, 1, 0.3, 1)` (Linear-style) | 3 级 duration + 2 ease 曲线（out / in-out）配套 §3.5 渐进增强 |

**复用规则（不破坏现有 brand）：**

1. **保留：** 现有 brand cyan / purple / navy / surface 调色板**不动**（避免业务页 cascade 影响）
2. **新加 layer：** landing-* token 仅在 landing / marketing 路由下使用；app 端（CRUD pages）不引用
3. **不强制 migration：** 现有 11 landing components 通过 `globals.css @theme` 自动获得 utility class，可逐 component 渐进迁移；不开 mega-refactor commit
4. **light-theme accent 必有 deep variant：** 任何 brand accent color（如 `--color-cyan` #00E5FF luminance ~0.73）在 light bg（`bg-surface-light` luminance ~0.91）下 contrast ~1.23:1 直接 fail WCAG AA。必须配套 `--color-landing-{color}-deep` token（如 `oklch(45% 0.10 215)` ≈ ~5.5:1 PASS）

**实物锚定（BL-078-F001 落地）：**

| 文件 | 内容 |
|---|---|
| `src/styles/globals.css` | `@theme` 扩展 25 个 `--*-landing-*` token + `landing-canvas` / `landing-ink` / `landing-cyan-deep` 等 |
| `design-draft/landing-v2-tokens.md` | 110 LOC token 规范文档：Linear / Plausible 风格对照表 + 4 类 token 完整清单 + 复用规则 + a11y contrast 复核（ink vs canvas ≈ 16:1） |
| `framework/patterns/testing-env-patterns.md` §8 | a11y 三件套验收（与 token color layer 配套）|

**避免反模式：**
- ❌ 在 component 内 inline 写 `style={{ color: "#7d8593" }}` / `text-[14px]` 等硬编码
- ❌ 仅靠 Tailwind preset utility（`text-gray-500`）— 与现有 brand 调色板不一致
- ❌ 直接 copy reference URL（如 Linear）的 css 值 — 应按 §"reference URL 提炼方法论"（`planner.md`，BL-078 #4）抽象成本项目 token

**配套：**
- 本文件 §3.5 现代 CSS 渐进增强三层守门（BL-078 #3 — `--duration-*` + `--ease-*` token 与该段配套）
- `planner.md` §"Visual polish reference URL 提炼方法论"（BL-078 #4）
- `framework/patterns/testing-env-patterns.md` §8 motion a11y 三件套（BL-078 #1 + #5）

来源：BL-078-F001 实物落 `src/styles/globals.css @theme` + `design-draft/landing-v2-tokens.md` + 用户 2026-05-27 ack。

### 3.5 现代 CSS 渐进增强三层守门（BL-078 #3 / BL-078-F002+F003）

**触发场景：** 引入现代 CSS API（view transitions / scroll-driven animations / `interpolate-size: allow-keywords` / container queries 等）做 motion / transition / animation 类视觉效果。BL-078 实战：landing 视觉精修引入 `@view-transition { navigation: auto; }` 跨文档过渡 + `animation-timeline: view()` scroll-driven entrance + `interpolate-size` FAQ smooth height transition。

**核心原则：** 现代 CSS API 在 Chrome 115+/Safari 18+ 原生支持，Firefox / 旧 Safari 走 fallback 退化（功能不破，仅 motion 缺失）；最后所有 motion 必经 `prefers-reduced-motion` 守门，启用 reduce 后退化静态/瞬时切换（与 `framework/patterns/testing-env-patterns.md` §8 motion a11y 三件套 配套）。

三层守门 = **Native API 优先** + **Fallback 兜底** + **reduced-motion 强制守门**。任一层缺失 → motion a11y 反例。

#### 3.5.1 Native API 优先（Chrome 115+/Safari 18+）

`@supports` 检测后启用 native CSS API。Firefox / 旧 Safari 不支持 → `@supports` 块整段忽略，无副作用。

```css
/* Cross-document view transitions opt-in (Chrome 126+/Safari 18+) */
@view-transition {
  navigation: auto;
}

::view-transition-group(root),
::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: var(--duration-landing-medium);
  animation-timing-function: var(--ease-landing-out);
}

/* Scroll-driven animation 检测 + 启用 */
@supports (animation-timeline: view()) {
  .landing-hero-fade-in {
    animation: hero-fade-in linear both;
    animation-timeline: view();
    animation-range: cover 0% cover 35%;
  }
}

/* interpolate-size: allow-keywords (Chrome 129+) for FAQ smooth height */
@supports (interpolate-size: allow-keywords) {
  :root { interpolate-size: allow-keywords; }
  details.landing-faq-item::details-content {
    height: 0;
    overflow: hidden;
    transition:
      height var(--duration-landing-medium) var(--ease-landing-out),
      content-visibility var(--duration-landing-medium) allow-discrete;
  }
  details.landing-faq-item[open]::details-content {
    height: auto;
  }
}
```

#### 3.5.2 Fallback 兜底 — Firefox / 旧 Safari

Native API 不支持时，JS-driven 兜底（IntersectionObserver / framer-motion）或干脆 graceful degradation（无 motion 但功能/navigation 不破）。

**两种 fallback 选择：**

| 方案 | 用法 | 适合场景 |
|---|---|---|
| **JS-driven 兜底** | `IntersectionObserver` 监听 viewport 进入 → 触发 CSS class 切换 `animation` / `transform` | scroll-driven entrance（淡入 / scale-on-enter）|
| **Graceful degradation** | 不写 fallback，native 失败时直接显示静态 end-state | view transitions 跨页 navigation（无 motion 但 navigation 不破）/ FAQ smooth height（无 motion 但 toggle OK）|

**BL-078 实例（`ScrollFadeIn` helper）：** IntersectionObserver-based 一次性 reveal（fire once），与 `@supports (animation-timeline: view())` 并存：
- Chrome/Safari：`@supports` 命中 → native scroll-driven 持续追踪 + IntersectionObserver one-shot fade-in（双跑无冲突）
- Firefox / 旧 Safari：`@supports` 块跳过 → 只剩 IntersectionObserver fade-in（仍有 motion，仅缺连续 scroll-bind）

```tsx
// src/components/landing/ScrollFadeIn.tsx (BL-078 fallback helper)
export function ScrollFadeIn({ children, delayMs = 0 }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { setVisible(true); observer.disconnect(); break; }
      },
      { rootMargin: "0px 0px -10% 0px" }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delayMs}ms` }}
         className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
      {children}
    </div>
  );
}
```

#### 3.5.3 prefers-reduced-motion 强制守门

任何 `animation` / `transition` / `transform` 必带 reduced-motion 兜底，启用系统选项后退化静态/瞬时。

**全局默认 + component 级精细兜底（双层）：**

```css
/* 1. 全局 default: 尊重用户系统偏好（globals.css 顶层） */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}

/* 2. component 级精细兜底（重要 motion 路径显式覆盖）*/
.landing-cta-primary { transition: transform 200ms, box-shadow 400ms; }
.landing-cta-primary:hover { transform: translateY(-1px) scale(1.02); }
@media (prefers-reduced-motion: reduce) {
  .landing-cta-primary { transition: none; }
  .landing-cta-primary:hover { transform: none; }
}

/* 3. view transitions 也要单独 honor reduced-motion */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-group(root),
  ::view-transition-old(root),
  ::view-transition-new(root) {
    animation-duration: 0.01ms !important;
  }
}
```

**实测 checklist（与 `framework/patterns/testing-env-patterns.md` §8 配套）：** DevTools Rendering panel 模拟 `prefers-reduced-motion: reduce` → 抽 3-5 个 motion 路径（hero entrance / sticky-parallax / scroll-driven / view transitions / FAQ smooth height）实测无 motion 或 ≤ 0.01ms `animation-duration`。

#### 3.5.4 适用边界

| 适用 | 不适用 |
|---|---|
| `animation` / `transition` / `transform` / view transitions / scroll-driven / interpolate-size 类 motion | 静态 CSS（color / spacing / typography / layout）|
| 现代 API 检测 + fallback + reduced-motion 三层（任一缺失即 review FAIL） | 仅纯 CSS 静态规则（color token / radii / shadows / border 等不需 motion 守门）|
| landing / marketing 页（motion-heavy） | app CRUD 页（motion-light，通常仅 hover / focus transitions 也建议带 reduced-motion 守门）|

**配套：**
- 本文件 §3.4 landing visual token layer（BL-078 #2 — `--duration-*` + `--ease-*` token 与本段配套）
- `framework/patterns/testing-env-patterns.md` §8 motion a11y 三件套（BL-078 #1 + #5 — opacity-dimming trap + reduced-motion 验收）
- `planner.md` §"Visual polish reference URL 提炼方法论"（BL-078 #4 — 决定哪些 motion 信号契合自身 brand）

来源：BL-078-F002 `src/styles/globals.css` `@view-transition` + `landing-hero-fade-in` + `landing-hero-video-scale` 实物 + BL-078-F003/F004 `interpolate-size` FAQ smooth height + BL-078 #3 用户 2026-05-27 ack。

---

## 4. Evaluator 签收硬要求

### 4.1 Visual baseline 查

签收 PASS 前必须 `ssh vps 'cd /opt/kolmatrix && git ls-files tests/screenshots/baseline/*.png'` 返回非空。

**Scaffold 存在 + PNG 未生成 = PARTIAL**，不是 PASS。

### 4.2 Stitch 还原度评估段

签收报告模板加一节：

```markdown
## Stitch 还原度评估
- 原型参考：<html-path>（浏览器打开；**不用 PNG**，PNG 是 512px 缩略图，看不清细节）
- Reviewer 并排打开两浏览器窗口（左 Stitch HTML 原型 / 右 staging 登录态同路由），同分辨率下逐 section 对比
- 缺失/简化元素清单（以 spec §2.3 "不得简化" 为 baseline）
  - [ ] ...
- 总体评级：🟢 pixel-perfect / 🟡 有中度差异可接受 / 🔴 重大缺失必须回 fixing
```

### 4.3 公共组件复用核查

`grep -rn "className=\".*glass-panel\|className=\".*gradient-cta\|className=\".*rounded-" src/app/[locale]/\(app\)/<page>/ | wc -l` 超过阈值（经验：>20 行 hardcoded className 在单文件）→ 提示 Planner 考虑抽取组件（不判 FAIL 但留记录）。

---

## 5. Anti-patterns（不得出现）

### 5.1 Generator 自行"MVP 化"

**错误：** Generator 看到原型有 Insights Panel 就想"这是 BM2 可做的，BM1 先不做"
**正确：** 查 spec §2.3 "不得简化" 清单；不在里面 → 问 Planner 而不是自删

### 5.2 Planner 写 spec 时只给"对齐 Stitch"一句话

**错误：** acceptance 只说 "src/app/... 对齐 Stitch xxx.html"
**正确：** 列 §2.1-2.4 四个子段，特别是 §2.3 "不得简化"清单逐条

### 5.3 Evaluator 只验功能不验视觉

**错误：** 功能 E2E 全绿就签 PASS，不核 visual baseline
**正确：** §4.1 baseline 入库 + §4.2 还原度评估两项都签

### 5.4 反复"幽灵控件"

**错误：** checkbox 保留但点了没反应 / dropdown 显示但 onChange 无 handler
**正确：** 隐藏 or disabled + tooltip 二选一

---

## 6. 启动检查清单（Planner 新 UI feature 起草前）

- [ ] spec acceptance 含 §2.1-2.4 四个子段
- [ ] §2.3 不得简化清单对照 Stitch HTML 原文逐项核（不是凭印象）
- [ ] §2.2 必用公共组件清单具体到组件名，不是"沿用设计系统"
- [ ] pre-impl 审计模板里提醒 Generator 本 guardrail 的 §3 要求

## 7. 与其他 harness 机制的关系

| 机制 | 关系 |
|---|---|
| `pre-impl-adjudication.md` | UI feature 的 pre-impl 审计是 §3 硬要求，不是可选 |
| `role-context/evaluator.md` | §4 签收条款须入 evaluator.md |
| `deploy-patterns.md` §2 | VPS artifact in-git 原则同理用于 baseline PNG |
| 铁律 6 | Generator 不得执行 codex 任务 — guardrail 由 Planner 写 spec + Evaluator 审，非 Generator 自检 |

---

## 8. 版本历史

| 日期 | 修订 | 来源 |
|---|---|---|
| 2026-04-24 | 初版沉淀 | KOLMatrix BM1 签收后 UI fidelity 审计 + BM2 F003/F005 重演确认 |
| 2026-05-27 | §3.4 Landing / marketing 视觉 token layer 规范（4 类 token + 复用规则 + light-theme deep variant WCAG AA） | BL-078-F001（v0.9.24 #2） |
| 2026-05-27 | §3.5 现代 CSS 渐进增强三层守门（Native API + Fallback + prefers-reduced-motion） | BL-078-F002/F003/F004（v0.9.24 #3） |
