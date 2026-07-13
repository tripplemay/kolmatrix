# 验收环境与测试稳定性 Patterns（框架沉淀）

> 原为 `harness/evaluator.md` §13-§16 / §18-§19，v1.0 重构移入 patterns/。Evaluator 跑 L1/L2 验收命中对应技术栈（Prisma / Node / jsdom / Playwright / 字体子集 / RLS）时按需查阅；`harness/evaluator.md` 保留流程性规则。

---

## 1. L2 烟测含字体子集（Material Symbols / etc）必须 ≥ 5 dynamic callsite spot check

**背景：** BIx F005-B Material Symbols self-host 子集脚本仅 3 grep pattern，漏 5 类动态范式（JSX prop / 三元 / 对象值 key≠icon / 数组元素 / return + ?? fallback），prod 用户在 dashboard / discovery / crm / roi / database / knowledge-base 6 页都看到 19 个字符方框（`TRENDING_FLAT` / `bookmark_added` 等）。spec §F005 acceptance "100+ 处 material-symbols-outlined 全渲染无字符方框" 是抽样验证，未跑全 callsite。

**Reviewer L2 烟测处理规则：**

| 情境 | 处理 |
|---|---|
| Feature 含字体子集（Material Symbols / Font Awesome subset / 自定义 woff2 等） | L2 烟测必须 spot check ≥ 5 个 dynamic callsite（不只看 grep 出的 baseline icons）。dynamic = JSX prop / 三元 / 对象值 / 数组 / return + ?? fallback 等 grep pattern 难命中的写法 |
| Spot check 命中字符方框 / 缺字 | 标 FAIL，触发 fixing。同时建议 Generator 在 manifest 文件显式列漏 icon |
| 子集脚本无 manifest 文件兜底 | signoff 注 soft-watch："字体子集脚本仅靠 grep，建议下批次加 manifest 兜底" |

**配套：** 详见 `framework/patterns/material-symbols-pattern.md`（5 漏范式 + manifest 维护 + CI 守门 test 完整 pattern）。该文件已在 BL-025-F009 落地。

来源：BIx hotfix bb637a1（19 漏 icon prod 暴露）+ BL-025-F009 守门加固 + framework CHANGELOG v0.9.6 [#6]。

---

## 2. 回归测试稳定性 — fire-and-forget audit pattern 测试约束

**背景：** Server actions 用 `void logAudit({...})` fire-and-forget 模式（不 await）让业务路径少一次 round-trip，但 integration test 在 action 返回后立即查 audit_log 会偶发 race（CI 高并发下成立，本地 dev 不易复现）。BL-025 F003/F004 两轮跨同 commit 一次 PASS 一次 FAIL 验证为 flake，rerun 全绿。

**case 站点：** `src/app/[locale]/(app)/kols/[id]/actions.ts:83`（`void logAudit`）+ `tests/integration/kol-profile.test.ts:127`（`expect(audits).toHaveLength(1)`）。

**两选一规约：**

| 方案 | 适用场景 |
|---|---|
| (A) **Action 内部 `await logAudit`** | 业务路径不是热点（< 100 RPS） + 测试需观察 audit_log，简单可靠 |
| (B) **测试改用 `vi.waitFor(() => expect(audits)...)`** | 业务路径是热点，必须保留 fire-and-forget；waitFor 50-100ms retry 上限 |

**Generator 选择决策（开工时落 generator_handoff）：** 优先 (A)，仅在业务路径明确是热点（>100 RPS / <100ms p99）时降级 (B)。

**Reviewer 验收：** 看到 `void logAudit` + integration test 直接 `expect(audits)` 同时存在 → 直接标 PARTIAL（race condition 风险），要求 Generator 选 (A) 或 (B) 之一显式声明。

来源：BL-025 F004 CI flaky `kol-profile.test.ts` + framework CHANGELOG v0.9.6 [#7]。

---

## 3. L1 本机 tsc 跑前必先 `prisma generate`（v0.9.10 — BL-033 沉淀）

**背景：** Reviewer L1 跑 `npx tsc --noEmit` 时如本机 prisma client 在最近 schema migration 后未重生，会出现 80+ "Property 'asset' does not exist on PrismaClient" 误报。看似 in-flight 批次引入实际是本地环境状态。

**误报模式：**
```
src/app/[locale]/(app)/assets/actions.ts:142:23 - error TS2339:
Property 'asset' does not exist on type 'PrismaClient<...>'.
```

类似错误 80+ 行但真实代码完全正确。Reviewer 误判为"批次引入"将导致：

1. Reviewer 拒绝接收，写 evaluator_feedback "TypeScript 80 errors"
2. Generator 困惑 "本地 npm test 全绿 + CI 8/8 success 怎么 tsc 80 errors"
3. 浪费 1 轮排查时间发现是 prisma client 未生成

**修订规则（L1 标配前置命令，顺序固定）：**

```bash
# Reviewer L1 启动必跑
npx prisma generate    # 1. 重生 prisma client（30s）
npx tsc --noEmit       # 2. 然后跑 tsc（确保读最新 client types）
npm run lint           # 3. lint 跑（独立于 prisma client，但同一阶段一起跑）
```

**适用范围：**

- 任何含 schema.prisma 改动的批次（BL-025/BL-030/F004 等）
- Reviewer 切到新 worktree 或 git pull 含 migration 后首跑
- CI 不受影响（CI 在 npm ci 后自动跑 postinstall hook 触发 prisma generate）

**反面（BL-033 Reviewer 命中）：** Reviewer 接 BL-033 verifying 启动跑 tsc，因前批次 schema 改过 + 本机未跑 prisma generate → 80 errors。`prisma generate` 后立即清空。本可作为 L1 标配前置避免误判。

来源：BL-033 Reviewer signoff §Framework Learnings 新坑。

---

## 4. L1 本机 Node 版本必须与 `.nvmrc` 一致（v0.9.11 — BL-020-F002 沉淀）

**背景：** Node 25.x 引入 native `localStorage`，但要 `--localstorage-file <path>` flag 才启用持久化路径；无 flag 时 jsdom 29 的 `window.localStorage` shim 与 Node 25 native 占位 detect 互斥触发 fall-through，结果 `window.localStorage` 变 `undefined`。所有触及 `window.localStorage.setItem/getItem/clear` 的测试 100% fail，且本地复现明显但 CI（Node 20 LTS）不复现 — Reviewer 误判风险高。

**误报模式：**
```
TypeError: window.localStorage.setItem is not a function
  at AiSuggestionsClient.test.tsx:42
```

类似错误集中在 jsdom + localStorage 路径，本机 fail / CI Node 20 PASS。

**修订规则（L1 启动前置 + 误判判据）：**

```bash
# Reviewer / Generator L1 启动必查
node -v                          # 必须与项目根 .nvmrc 一致
cat .nvmrc                       # 当前锁 Node 20（lts/iron）
nvm use                          # 不一致时切换；无 nvm 装 Node 20 LTS
```

**适用范围：**

- 任何含 jsdom 环境单测 / `window.localStorage` / `window.sessionStorage` 测试的批次
- Node 22+ 引入 native `Web Storage` API 后均可能触发兼容性新坑
- 本机 fail 但 CI PASS 的 jsdom 类测试，**先核 Node 版本一致性**，不一致时本机 fail 不算反面证据

**反面（BL-020-F002 命中）：** Reviewer 本机 Node 25.7 + jsdom 29 跑 `AiSuggestionsClient.test.tsx` 2 集成 case fail，CI run 25330969685 Node 20 PASS。验证差异源于 Node 25 native localStorage incompat，不是产品 bug；锁 Soft-watch S4 + 本规则。

**来源：** BL-020-F002 Reviewer L1 本机 unit fail / CI PASS 对比。

---

## 5. E2E suite 稳定性诊断（v0.9.20 — BL-060 沉淀）

**背景：** BL-060 fix-round 1 单点放宽 timeout/正则只缓解症状，整组 E2E 仍 FAIL；fix-round 2 抽 `tests/e2e/<role>.setup.ts` + 各 spec opt-in `test.use({ storageState })`，N 次 login 收敛 1 次后 suite PASS。

**诊断信号：** 单例 PASS / 整组 FAIL = **suite-level isolation 问题**（不是 case 内容/正则问题）。

**候选根因：**
- 每 case `beforeEach` 重 login 累积抖动
- staging 8GB RAM 资源压力

**根治方案：** 抽 `tests/e2e/<role>.setup.ts` + 各 spec opt-in `test.use({ storageState })`，N 次 login 收敛 1 次。

**反模式：** 单点放宽 timeout / 正则只缓解症状，不解决 suite-level isolation。

**来源：** BL-060 fix-round 1（cc82a54 正则放宽失败）→ fix-round 2（f75cafd storageState PASS）。

---

## 6. SQL 跨 tenant 全量查询 RLS 注意（v0.9.20 — BL-061 沉淀）

**背景：** BL-061 F003 验收时 Reviewer 用 `kolmatrix_app` role + Prisma RLS 跨 tenant 查 audit_log 返回 0 行，误判为数据缺失；实际是 RLS 视角限制。

**处理规则：** 跨 tenant 全量验收 SQL 必须 `sudo -u postgres psql kolmatrix(_staging)` superuser bypass RLS。普通 `kolmatrix_app` role + Prisma RLS 跨 tenant 看 0 行（不是数据缺失，是 RLS 视角限制）。Reviewer only-read 验收尤其要走 superuser path。

**来源：** BL-061 F003 Generator 实战发现 + Codex Reviewer signoff 确认。

---

## 7. L1 全绿 ≠ verifying PASS：角色门禁 console 探针（v0.9.21 — BL-065-R1 沉淀）

**背景：** BL-065 verifying 阶段 L1 全绿（lint 0 errors / typecheck PASS / vitest 162 files 1142 tests PASS / Playwright match-fidelity 7 passed / prod read-only audit PASS=7 FAIL=0 WARN=1），但 Evaluator 在本地 admin role 探针时发现 `/en/admin/kol-csv-import` server 端日志含 `FORMATTING_ERROR: variable "imported" was not provided`，HTTP 仍 200 返回 — **server console error 不计入 HTTP 响应码**。

**规则：** L1 全绿不等于 verifying PASS。Evaluator 必须在 L1 自动化之上**手动跑角色门禁探针**：

1. **登录每个角色账号**（admin@kolmatrix.local / marketer@kolmatrix.local / 等），用 Playwright 或浏览器 cookie 直访问角色限定路由
2. **观察 server 端 console / pm2 logs** 是否含 `Error:` / `FORMATTING_ERROR` / `route-not-found` / `next-intl error` 等 runtime 错误 — 这类错误**不影响 HTTP 200/307 状态码**，CI 全绿 + audit script 全 PASS 都不会抓到
3. **覆盖所有角色 + 路由组合**（admin / marketer / platform_admin 等），尤其 batch 新增的角色限定路由（如 BL-065 F003 新增 /admin/kol-csv-import）

**典型抓住的问题：**
- next-intl ICU 模板未绑定占位符（BL-065-R1 案例：`tImport("successTemplate")` 模板含 `{imported}` 但 t-call 未传值）
- React rendering error 但 server fallback 返回上一帧内容
- 模糊的 console.error / TypeError 在 production build minified 后不影响 HTTP
- 角色 enum mismatch（`role === "admin"` vs 实际 `tenant_admin`，导致 hidden link 不渲染但页面正常加载）

**反模式：** 仅 audit HTTP 状态码 + JSON health endpoint，认为「无 5xx = 无错误」— 这种判定漏掉所有 200/307 状态码下的 server console runtime error。

来源：BL-065-R1 Evaluator verifying 实战（2026-05-13 BJT playwright probe）。

---

## 8. motion 批次 a11y 三件套验收（v0.9.24 — BL-078 #1 + #5 合并段）

**背景：** BL-078 landing 视觉精修引入 motion-heavy 视觉效果（view transitions / scroll-driven animations / sticky-parallax 焦点切换 / opacity-based dimming）。BL-078-F005 fix-round 1 实战暴露：单跑 Lighthouse `accessibility ≥ 0.90` 数字 PASS（0.96）不足以兜底 — `color-contrast` 子项 score = 0 / 13 elements fail 仍直接违反 F005 WCAG AA acceptance（Evaluator `verifying` 退回 fixing，详 `docs/test-reports/BL-078-verifying-2026-05-27.md`）。

motion 类 batch 必须把 a11y 拆三件套独立验收，而不是看顶层 `a11y ≥ X` 一个数字。

**三件套验收口径（任一 fail → FAIL）：**

| 件 | 验收维度 | 工具 / 验法 | 通过门槛 |
|---|---|---|---|
| 1️⃣ **contrast WCAG AA** | text fg vs bg 对比 ≥ 4.5:1 (normal) / 3:1 (large ≥ 18px) | Lighthouse `color-contrast` audit `score: 1` + `details.items: []` (axe-core)；任何非 0 items 即 fail | `color-contrast.score = 1` 且 `details.items.length = 0` |
| 2️⃣ **opacity-dimming trap**（BL-078 #1） | parent opacity × text alpha 双重 dimming 不杀 contrast | grep `opacity-[0-9]+` in landing/marketing components；命中 → 算 effective contrast = (parent_opacity × text_alpha × fg_luminance + (1-effective_alpha) × bg_luminance) 验 ≥ 4.5:1 | 任何 inactive 状态 grep 命中处必显式提供 contrast 计算或测一次 axe-core 实测 |
| 3️⃣ **prefers-reduced-motion 守门**（BL-078 #5） | 启用系统选项 (macOS: System Settings → Accessibility → Display → Reduce motion ON) 后 motion 退化静态/瞬时 | DevTools Rendering panel 模拟 `prefers-reduced-motion: reduce` + 抽 3-5 个 motion 路径（hero entrance / sticky-parallax / scroll-driven）实测无 motion 或 ≤ 0.01ms `animation-duration` | 启用 reduce 后全 motion 不再触发 |

**opacity-dimming trap 反例（BL-078-F005 实战）：**

```jsx
// ❌ 反面：parent opacity-50 × text alpha /70 双重 dimming
<div className={`${isActive ? "opacity-100" : "opacity-50"}`}>
  <span className="text-landing-ink-muted/70 line-through">凭经验拍脑袋 50%</span>
</div>
```
- text-landing-ink-muted luminance ~ 0.55, /70 alpha effective ~ 0.39
- parent opacity-50 二次叠加: 0.5 × 0.39 + 0.5 × bg ≈ 0.21
- contrast on bg-surface（lum 0.024）: (0.21+0.05)/(0.024+0.05) ≈ **3.5:1 FAIL**（4.5:1 阈值）

**修复 pattern — 4 重 distinction 替代 opacity-X 状态切换：**

| # | 维度 | active 状态 | inactive 状态 | a11y 影响 |
|---|---|---|---|---|
| 1 | **Icon scale** | `scale-1.12` (放大) | `scale-1.0` (默认) | 0（视觉 size, 不影响 alpha）|
| 2 | **Icon color** | `text-cyan` 高 contrast | `text-landing-ink-muted` 中 contrast | 0（color value 不带 alpha）|
| 3 | **Cell text color** | active 用 accent / inactive 用 ink-muted (full alpha) | full alpha 双状态都 ≥ 4.5:1 contrast |
| 4 | **Progress fill 同步** | scroll-bound 渐进填充 visual cue | 不动 inactive cell 文本 alpha |

**grep 防御：**
```bash
# landing / marketing 组件不允许 inactive 状态用 opacity-X dim
git grep -nE 'opacity-[0-9]+' src/app/[locale]/\(marketing\)/_components/ src/components/landing/
# 命中 → 必须验 effective contrast 或重构为 color hierarchy 模式
```

**prefers-reduced-motion 守门模板（与 `ui-fidelity-guardrail.md` §3.5 现代 CSS 渐进增强段配套）：**

```css
/* 全局 default：尊重用户系统偏好 */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
  }
}

/* component 级精细兜底（重要 motion 路径需显式覆盖）*/
.landing-hero-fade-in {
  animation: hero-fade-in 800ms ease-out both;
}
@media (prefers-reduced-motion: reduce) {
  .landing-hero-fade-in { animation: none; opacity: 1; }
}
```

**与 §1 字体子集 spot check 关系：** §1 验"视觉资源"是否正确加载；§8 验"视觉资源呈现后"是否满足 a11y 阈值。两者正交、互补。

**source ID 追溯：**
- **BL-078 #1** opacity-dimming trap：BL-078-F005 fix-round 1 修复 `commit 7dfb5b9`（删 BeforeAfter `opacity-50` + StickyParallax `opacity-40 → opacity-70` + Features/Trust eyebrow `text-cyan` → `text-landing-cyan-deep`）+ `commit b85d34a`（StickyParallax index `text-cyan/80 → text-cyan` 去 80% alpha）。Lighthouse `color-contrast.score: 0 → 1`，violations `13 → 0`。
- **BL-078 #5** prefers-reduced-motion 守门：BL-078-F002 实物 `src/styles/globals.css` `[data-landing-cinematic]` reduced-motion 段 + `.landing-cta-primary` / `.landing-cta-secondary` component 级 `@media (prefers-reduced-motion: reduce)` 覆盖 + F005 acceptance 含 "启用系统选项后全 motion 退化静态/瞬时切换"。

来源：BL-078-F005 verifying FAIL（Evaluator 2026-05-27 `docs/test-reports/BL-078-verifying-2026-05-27.md`）+ BL-078 #1 + BL-078 #5 ack（用户 2026-05-27）。

---

## 9. Next.js server-action mock 不可行三件套（v0.9.22 #12 + BL-070 #21 合并段）

**Server-action 类测试 mock infeasible** 时的三件套规约（always-skip + unit pure function + staging dogfood）。

**触发场景（两 source 实战）：**

- **(v0.9.22 #12 source)** BL-068 e2e refine-action 测试因 Next.js server action mock 在 vitest/playwright 环境**不可行**（需要真实 Next.js runtime + Redis + Postgres），强行 mock 引入大量 fragility
- **(BL-070 #21 source)** BL-070 F006 4 个 refine e2e case 在 mock fired 后 toast 永远 timeout，根因 = Playwright `page.route.fulfill({body: JSON.stringify(...)})` 返 plain JSON **不满足 Next.js RSC wire format** → client deserialise throw → catch 走 network toast。任何 body shape filter 都救不了

**三件套规约：**

| 件 | 内容 | 适用 |
|---|---|---|
| 1️⃣ **always-skip in CI** | `test.skip(true, SKIP_*_REASON)` 在 spec 文件顶部 always-skip server-action e2e | CI 不可达路径 |
| 2️⃣ **unit pure function** | 抽 server-action 内部纯函数（validation / dedupe / transform）写 vitest 单测覆盖 | Unit-testable 逻辑 |
| 3️⃣ **staging dogfood** | spec acceptance 文档化"该路径由 staging dogfood + audit_log 实测覆盖"+ dogfood checklist 含此路径 | 端到端真实验证 |

**Skip 模板：**
```typescript
// tests/e2e/feature-name.spec.ts
import { test, expect } from "@playwright/test";

const SKIP_SERVER_ACTION_REASON =
  "Next.js server action 在 e2e 不可 mock（RSC wire format 不可由 route.fulfill 满足）。" +
  "本路径由 staging dogfood + audit_log 覆盖 — 见 docs/specs/<batch>-spec.md §6 dogfood checklist。";

test.describe("Feature X", () => {
  test.skip(true, SKIP_SERVER_ACTION_REASON);
  // test cases skeleton kept for documentation
});
```

**反例：** 不应该 `test.skip` 简化 CI 红 — 必须有 dogfood 替代覆盖才能 skip，否则等于无验收。Evaluator 审 spec 时验：每个 always-skip server-action e2e 是否在 spec dogfood checklist 列入对应路径。

**适用判断 checklist：**
- [ ] 测试 mock 复杂度 > 测试价值？ → skip + dogfood
- [ ] 测试 mock 是否可由 `vi.fn()` / `route.fulfill` 简单覆盖？ → 优先 mock
- [ ] CI 跑测试是否需要真实 Next.js runtime + Redis + Postgres？ → 无法 mock，必 skip + dogfood

来源（双 source）：
- BL-067 §8 + BL-068-F006 实战（v0.9.22 #12，用户 2026-05-17 ack）
- BL-070 F006 RSC wire format 不可 mock 实证（v0.9.23 #21，用户 2026-05-25 ack）
- 两条同主题 inline-merge 为单段（per D7 强制合并）

---

## 10. chaos / edge-case acceptance 的 staging-only flag + runbook 模式（v0.9.23 — BL-069 #15 沉淀）

**Chaos test 模式：** 所有"chaos / edge case 实测"类 acceptance（cap 满 / network error / 5xx mock）应有 staging-only env flag + runbook 入 spec acceptance，避免 Evaluator L2 卡壳烧真钱。

**模式核心（BL-069 fix-round 1 B2 case）：**

1. **专用 staging-only env flag**（如 `BRIEF_FORCE_CAP_EXHAUSTED=true`）严格 `=== 'true'` 防 typo
2. **audit 加 `forced=true` 字段**让 dashboard 监控可区分真 cap 满 vs 模拟
3. **runbook 5 步：** 备份 .env → 加 flag tee → pm2 reload → UX 验 → 清理（restore .env + reload）
4. **2 单测保护：** (a) 启用 enable case / (b) `'yes'` / 其他字符串非严格 regression guard

**对比 BL-067 §6 chaos test 模式（改 .env.staging API key）：**

| 维度 | BL-067 §6 模式 | BL-069 #15 staging flag 模式 |
|---|---|---|
| 影响范围 | 整 API key 失效 | 仅当前路径 short-circuit |
| 防 typo | ❌ key 改错全 CI 红 | ✅ 严格 `=== 'true'` |
| Audit 可区分 | ❌ | ✅ `forced=true` 字段 |
| 复杂度 | 简单（改 .env 即可） | 中（需写 flag + runbook + 单测） |

**flag 命名规范：** `<FEATURE>_FORCE_<SCENARIO>=true`（如 `BRIEF_FORCE_CAP_EXHAUSTED` / `KOL_FORCE_FETCH_ERROR` / `AI_FORCE_RATE_LIMIT`）。

**runbook 5 步模板：** 见 `docs/dev/bl069-cap-exhausted-simulation-runbook.md`（备份 + tee + pm2 reload + UX 验 + 清理）。

**Planner 起草端配套：** spec 起草凡列 "chaos test / edge case 实测" 类 acceptance，必含 staging-only flag + runbook + 单测三组件，避免 Evaluator L2 时发现无入口卡壳。

来源：BL-069 fix-round 1 B2 + v0.9.23 #15（用户 2026-05-18 ack）。

---

## 11. 回归守门 advisory test 三件套 + STRICT_MODE 渐进升级（v0.9.24 — 合并段 #3 + #7 + #9）

测试基建对 outbound / 消费侧 / 三向闭环的 advisory 防御 — IA refactor / 路由删除 / i18n ns 改动 / Material Symbols 加 icon 类批次回归守门标配。三 sub-section 按时间序展示 v1 → v2 → STRICT_MODE 渐进升级路径。

### 11.1 v1 三件套基础（v0.9.24 #3 / BL-072 #3，BL-072-F007 落实物）

3 个 advisory unit test 覆盖 outbound 一致性 / 消费侧 wiring / 三向闭环：

| Test 文件 | 覆盖维度 | 探测 pattern |
|---|---|---|
| `tests/unit/link-target-audit.test.ts` | 路由 outbound 链接命中实际路由树 | 扫 `src/` 中 `href="/<path>"` + `router.push("/<path>")` 字面 → 抽 path prefix → 比对路由树 + `IA_REDIRECT_RULES` |
| `tests/unit/material-symbols-coverage-unit.test.ts` | Material Symbols 三向断言 | src JSX 中 `material-symbols-outlined` ligature ⊆ manifest（git-tracked）⊆ woff2 实际 glyph |
| `tests/unit/i18n-page-side-consumption.test.ts` v1 | i18n page-side raw English literal sweep | 扫 `page.tsx` + `*Client/*Panel/*Bar` 主组件 JSX text/attr，命中 raw English 即 advisory warning |

**第一版全 advisory（warning 不 fail）**：避免 false-positive 拦截合法 PR（如 brand 词、unicode 模糊匹配 false-hit）。三测试落地后稳定 1-2 周观察 noise rate，再逐维度 flip 见 §11.3。

来源：BL-072-F007 实物落 3 advisory test 文件 + v0.9.24 #3 用户 2026-05-26 ack。

### 11.2 v2 升级：key existence 检测（v0.9.24 #7 / BL-073 #7，BL-073-F005 实战）

v1 `i18n-page-side-consumption.test.ts` **仅** grep raw English literal 在 JSX text/attr，**不验** page.tsx 调用 `t("<key>")` 时该 key 在 messages JSON 实际 exist。

**反例（BL-073 issue #4A）：** `match.emptyState.body` 5 locale 全 MISSING 但 page.tsx 调 `t("body")` → next-intl prod fallback 返字面 key 字符串显示给用户，CI/lint/v1 advisory 全过。

**v2 增量探测：**

```typescript
// tests/unit/i18n-page-side-consumption.test.ts v2 增量
function extractNamespaceFromFile(filePath: string): string | null {
  const src = readFileSync(filePath, "utf-8");
  // useTranslations("<ns>") / getTranslations({ namespace: "<ns>" })
  const m = src.match(/useTranslations\("([^"]+)"\)|getTranslations\(\s*\{\s*namespace:\s*"([^"]+)"/);
  return m ? (m[1] ?? m[2]) : null;
}

function extractTCalls(filePath: string): string[] {
  const src = readFileSync(filePath, "utf-8");
  // t("<key>") - greedy 抓所有 t("...") 调用
  const matches = [...src.matchAll(/\bt\("([^"]+)"\)/g)];
  return matches.map((m) => m[1]);
}

// 主循环：每个 page.tsx + 主组件
for (const file of glob.sync("src/app/**/page.tsx")) {
  const ns = extractNamespaceFromFile(file);
  if (!ns) continue;
  const keys = extractTCalls(file);
  for (const key of keys) {
    const fullKey = `${ns}.${key}`;
    if (!hasKeyInMessages(enJson, fullKey)) {
      results.push({ file, fullKey, severity: STRICT_I18N ? "fail" : "warn" });
    }
  }
}
```

**关键设计：**
- 扫 `page.tsx` + `*Client/*Panel/*Bar` 主组件（其他低风险组件可豁免）
- namespace 解析支持 `useTranslations` 和 `getTranslations({ namespace })` 两种形态
- 拼 `${ns}.${key}` 后查 `messages/en.json` 是否 exist
- 第一版 advisory（`STRICT_I18N=false`），稳定后 flip strict（详 §11.3）

来源：BL-073-F005 实物落 i18n-page-side-consumption.test.ts v2 + v0.9.24 #7 用户 2026-05-26 ack。

### 11.3 STRICT_MODE 渐进升级路径 — advisory → strict 渐进 flip（v0.9.24 #9 / BL-073 #9，BL-073-F007 实战）

**模式核心：** 三件套首版全 advisory（`STRICT_MODE=false`，warning 不 fail）避免 false-positive 拦合法 PR。**渐进 flip 路径**：稳定 1-2 周 + 0 false-positive 漂移后逐维度 flip strict。

**当前维度状态（BL-073-F007 实战）：**

| Strict 维度 flag | 当前状态 | 触发 flip 条件 | 拦未追例 |
|---|---|---|---|
| `STRICT_MS_ICONS=true` | ✅ 已 strict | Material Symbols subset script + manifest 防御稳定 1 周（BL-072-F005 后） | CI fail 拦未追 manifest 的 icon ligature |
| `STRICT_I18N=false` | ⏸️ 仍 advisory | v2 key existence 实战稳定 1-2 周 + i18n ns refactor 批次频次降低 | 未来 flip 拦未拼齐 5 locale 的 key |
| `STRICT_LINK_TARGET=false` | ⏸️ 仍 advisory | IA refactor / 路由删除批次频次降低 + IA_REDIRECT_RULES 稳定 | 未来 flip 拦 href 指向不存在路由 |

**Flip 标准模板（每次 flip 1 个维度）：**

1. **CHANGELOG marker：** `vX.Y.Z (YYYY-MM-DD): STRICT_<DIM>=true 启用 — 拦未追 <X> 类问题`
2. **planner.md 强制要求：** 加"未来 X 类 feature 必须 Y"行（如"加新 ligature 必更 manifest + 重跑 subset"）
3. **spec acceptance 模板更新：** 相关 feature 起草自动列 `STRICT_<DIM>=true → CI 必绿`
4. **观察 1 周 noise rate：** flip 后 CI 红率 > 5% → 暂退回 advisory，先修 false-positive

**flag 拆分原因：** 避免单 `STRICT_MODE=true` 一刀切（不同维度成熟度不同），按维度独立 flag 允许"Material Symbols 已 strict + i18n + link-target 仍 advisory"混合状态。

来源：BL-073-F007 实物落 STRICT_MS_ICONS flip + v0.9.24 #9 用户 2026-05-26 ack。

### 11.4 配套（advisory test 三件套外延）

- spec acceptance 起草端：详 `planner.md` §"IA refactor / 路由删除批次 outbound 一致性扫描清单"（v0.9.24 #1）
- 路由删除 self-check：详 `web-runtime-patterns.md` §"大型删除/重构批次执行模板" J「删 X 前 grep callers 矩阵」（v0.9.24 #4 扩展 H i18n ns）
- Material Symbols 三向断言细节：详 `material-symbols-pattern.md`

**合并段来源（per D7 强制合并 3 同主题候选）：** BL-072-F007 v1 三件套 + BL-073-F005 v2 key existence + BL-073-F007 STRICT_MODE 渐进 = v0.9.24 #3 + #7 + #9 三 sub-section 合并入本节，避免开三独立段。

---

## 12. 大型删除/重构批次 E2E 选择器与路由断言陷阱（v0.9.23 — BL-070-F004 沉淀）

> 本节是 `web-runtime-patterns.md` §"大型删除/重构批次执行模板"的 E2E 测试侧拆分（同 BL-065/BL-070 批次）：Generator 执行模板主体（本地≠CI / 预扫清单 / atomic delete / grep-callers 矩阵）在 web-runtime；此处收 Evaluator-reader 的两个 E2E 稳定性陷阱。

### 12.1 base-ui Checkbox E2E 选择器陷阱

base-ui Checkbox 渲染 visible `role="checkbox"` button + sr-only aria-hidden `<input type="checkbox">`。`locator('input[type=checkbox]').check()` 会选 helper（卡 viewport 重试超时）；**用 `getByRole('checkbox').click()`** 选 visible widget。

### 12.2 next-intl + `notFound()` HTTP status 不可靠（v0.9.23 #18）

Next.js 15 App Router server component `notFound()` 标准是 404，但 next-intl middleware 包装响应后实际 status 可能 surface 为 200 + not-found body。e2e 验路由废弃时不能严格 `expect(status).toBe(404)`，应用 belt-and-suspenders：

```typescript
// e2e/route-deprecation.spec.ts
const response = await page.goto("/zh/old-route", { waitUntil: "domcontentloaded" });
expect(response?.status()).toBeOneOf([200, 404]);  // next-intl 包装后 status 不可靠
expect(page.url()).not.toContain("/old-route");    // 或验未 redirect 到错误目的地
await expect(page.getByText(/not found|页面不存在/i)).toBeVisible();  // 验 page body
```

来源：BL-070-F004 #1（删显式子路由 fallback 到动态 `[id]/page.tsx`，E2E checkbox 选择器）+ #2（删路由 e2e 验证 status assertion 误判）；主执行模板见 `web-runtime-patterns.md`。

---

## 触发条件速查表（新增 §7-§12 pointer 表）

Evaluator L1/L2 命中下列触发条件时读对应节；本表随 §7 之后新增节滚动维护：

| 触发条件 | 读本文件 |
|---|---|
| feature 含角色限定路由 / next-intl ICU 模板（占位符绑定） | §7 角色门禁 console 探针 |
| feature 含 view-transition / scroll-driven / opacity-based dimming / motion-heavy 视觉 | §8 motion a11y 三件套 |
| 测试需真实 Next.js runtime + Redis + Postgres（server-action mock 不可行） | §9 server-action mock 三件套 |
| spec 列 chaos / edge-case（cap 满 / network error / 5xx）实测 acceptance | §10 staging-only flag + runbook |
| IA refactor / 路由删除 / i18n ns 改动 / 加 icon 批次（回归守门） | §11 advisory test + STRICT_MODE |
| 大型删除/重构批次含 base-ui Checkbox E2E / next-intl 路由废弃断言 | §12 E2E 选择器与路由断言陷阱 |

---

## 版本历史

| 日期 | 修订 | 来源 |
|---|---|---|
| 2026-07-09 | v1.0 重构：自 `harness/evaluator.md` §13-§16 / §18-§19 原文迁出成独立 pattern 文件 | 框架 v1.0 目录分层 |
| 2026-07-13 | KOLMatrix 回流：新增 §7 角色门禁 console 探针（BL-065-R1）、§8 motion a11y 三件套（BL-078 #1/#5）、§9 server-action mock 三件套（v0.9.22 #12 / BL-070 #21）、§10 chaos staging-flag（BL-069 #15）、§11 advisory test + STRICT_MODE（BL-072/073）、§12 E2E 选择器陷阱（BL-070-F004）+ 触发条件速查表 | joyce v0.9.25 evaluator §11.4/§11.6/§13.1-13.4 + generator §11 C/G 迁出 |
