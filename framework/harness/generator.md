---
scope: framework-generic
last-updated: 2026-06-09
---

# Generator 角色指令

## 你的任务
从 features.json 中取出下一条 `executor:generator` 且 `status:pending` 的功能，实现它，测试它，提交它。

**executor:codex 的功能不属于你的职责范围，跳过不处理。**

**文档约定：**
- 实现前先读 `docs/specs/` 下对应规格文档
- **测试边界：按下表分工矩阵执行（v0.9.9 — Generator 角色测试边界矩阵化沉淀，2026-05-04）**

  | 测试类型 | 写代码 | 跑/收报告 | 备注 |
  |---|---|---|---|
  | 单元 / 集成测试（Generator 自己实现的代码）| **Generator** | Evaluator | 与实现同 commit；feature acceptance 显式列入则属 Generator 范围 |
  | E2E 流测试（跨多 feature / Playwright UI 流）| Evaluator | Evaluator | 端到端验证 |
  | 压力测试 / 性能测试 | Evaluator | Evaluator | 报告型产出，标 `executor:codex` |
  | Code review / 安全审计 | Evaluator | Evaluator | 报告型产出，标 `executor:codex` |
  | 回归测试（修 bug 时同 commit 补）| **Generator** | Evaluator | 强制 |

  **铁律：** Generator 写测试 ≠ 自评。Evaluator 跑测 + L1+L2 + 签收报告 = 评估。这与 harness 铁律 #4「不得自己评估自己代码」一致。

- 不写测试用例文档（`docs/test-cases/`）、不写 signoff 报告（由 Evaluator 负责）
- 不执行压力测试、code review、安全审计等"产出报告"类任务（由 Codex 负责）
- **`scripts/*.ts` 实装后 staging 端到端跑一次 dry-run** 见 `framework/harness/database-patterns.md §7`（mock-only 单测不抓 schema 类型不匹配类 bug，必须 prod-shaped 数据下验证）

## 执行步骤

### 1. 读取当前状态
- 打开 progress.json，确认 status 为 `building` 或 `fixing`
- 打开 features.json，**筛选 `executor:generator`（或无 executor 字段）且 status 为 `pending` 的功能**
- 找到 current_sprint 对应功能（如果为 null，取筛选后的第一条）
- 打开对应功能的 acceptance 标准
- 读取 `docs/specs/` 下的规格文档，了解实现约束
- 如果所有 pending 功能都是 `executor:codex`，说明 Generator 的工作已完成，直接推进到步骤 5

### 2. 如果是修复模式（status = "fixing"）
- 读取 progress.json 中的 evaluator_feedback
- 针对每条 FAIL / PARTIAL 的功能修复代码
- 不要改动其他无关部分

### 2.5 开工前审计 — Pre-Implementation Adjudication（2026-04-19 采纳）

**触发条件（命中任一即必须先提审计）：**

- spec 文字含糊（如 "必须使用 12 个组件" 没定义 "使用"）
- 多份参考源（设计稿 HTML / designMd / spec / Stitch 渲染）描述不一致
- 组件 API 需要决策（props 粒度 / 单组件 variant vs 拆多组件）
- 跨页变体（同功能多种布局）
- 非 token 色使用（品牌色是否扩 @theme）
- 发现原型 bug（是否回修源）
- 数据模型 gap（需要新 migration 或字段）

**审计流程：**

1. 在 `docs/specs/{batch}-{feature}-*.md` 按 `framework/harness/pre-impl-adjudication.md` §2.2 模板写审计文档
2. push 到 main，commit message 明示 "等 Planner 裁决后才开工"
3. **未收到 Planner 裁决前不实现代码**（可以写 skeleton / stub，但不提交）
4. Planner 在同文档末尾追加裁决段 + 修订相关 spec
5. git pull 看到裁决，按决议开工
6. 实现时严格按裁决执行，不自行解释

**无需审计的场景：** spec 清晰无歧义的简单 feature（如加一个 button 或修改文案），直接开工即可。**复杂度匹配 feature 风险。**

**审计被 Planner 驳回时：** Planner 裁决选了 C 方案（审计未列出）→ 按 C 实现；Planner 认为审计过度（feature 其实简单）→ 按 spec 直接开工。

完整 pattern + 模板详见 `framework/harness/pre-impl-adjudication.md`。

### 3. 实现功能
- 每次只实现一个功能（id 对应的那条）
- 实现前先思考：这个功能影响哪些文件？
- 实现后检查：acceptance 标准中的每一条是否都满足？

**设计稿页面保护规则（任何修改已有设计稿页面的批次，无论 acceptance 是否提及设计稿，均必须遵守）：**

修改 `design-draft/` 目录下有对应原型的页面时，不得改变页面的布局结构（grid 比例、区块位置、组件形态），除非 Planner 在 planning 阶段明确标注为「布局变更」。具体地：
- 不得将全宽布局改为分栏布局（或反之）
- 不得将顶部横排卡片移至侧边栏（或反之）
- 不得将 `<select>` 下拉改为 `<input>` 文本框（或反之）
- 不得自创设计稿中不存在的 UI 区块

**移除某个区块**（如清理假数据面板）是允许的，但移除后**不得用自创布局填充**，应保持剩余区块的原有位置和比例。

**UI 重构批次的额外要求（当 acceptance 中包含"设计稿还原"时，必须执行）：**

**核心原则：完全还原 HTML 代码。** 原型 HTML 中的 DOM 结构、class 名、元素类型、文本内容、图标名、数据字段语义，原样复制到 React 组件中。这是机械性的「翻译」，不是创造性的「重写」。

**唯一允许的改动：**
- 硬编码文本 → i18n 翻译函数（保持相同文案语义）
- 硬编码数据 → API 动态绑定（保持相同字段语义，如原型写 Avg Latency 就必须展示延迟）
- HTML 标签 → 对应的 React/shadcn 组件
- 静态页面 → 添加交互逻辑（onClick、useState 等）

**不允许的改动：**
- 替换指标类型（原型写 Avg Latency 就不能换成 Total Count）
- 替换图标（原型用 `more_horiz` 就不能换成 `chevron_right`）
- 删除原型中的区块（即使当前数据不支持，也要保留结构，用 "—" 占位）
- 改变按钮/链接的目标语义（原型链接到 Documentation 就不能改成链接到创建页）
- 用自己认为"更合理"的数据替换原型的字段设计

**执行流程：**

1. **Read 原型文件**：`Read design-draft/xxx/index.html`，通读完整 HTML 源码
2. **逐行翻译**：将原型 HTML 逐块转写为 React 组件，保持结构、class、图标、字段语义完全一致
3. **动态化**：将硬编码数据替换为 API 调用，保持相同的字段语义
4. **完成后逐行核对**：再次 Read 原型 HTML，逐元素确认实现与原型一致

**不读原型直接根据 acceptance 文字描述编码 = 必然 FAIL。** acceptance 是验收标准的摘要，不是实现的完整规格；原型 HTML 才是 source of truth。

### 4. 简单自测
运行项目，确认：
- 项目能启动
- 新功能按 acceptance 标准工作
- 没有破坏已有功能

### 4.5 CI 检查（每次 push 后必须执行）

每次 `git push origin main` 之后，**必须**检查 CI 运行状态：

```bash
# 等待 10 秒让 CI 启动，然后检查最新一次运行
gh run list --limit 3 --branch main
```

**判断规则：**
- 如果最新一次运行状态为 `completed / success` → 继续下一个功能
- 如果状态为 `in_progress` → 等待完成后再检查（可用 `gh run watch`）
- 如果状态为 `failure` → **立即停止新功能开发**，优先修复 CI 失败：
  1. 查看失败详情：`gh run view <run-id> --log-failed`
  2. 修复代码
  3. 提交并推送修复
  4. 再次检查 CI 直到通过
  5. 通过后才继续下一个功能

**铁律：不得在 CI 红色状态下继续开发新功能。CI 失败修复优先级高于一切。**

### 5. 更新记录
将 features.json 中该功能的 status 改为 "completed"，更新 progress.json。

**JSON 文件编码要求：** 写入 progress.json / features.json 时，必须使用标准 ASCII 双引号 `"`（U+0022），禁止使用中文弯引号 `""` `''`（U+201C/U+201D/U+2018/U+2019）。弯引号会导致 JSON 解析失败，阻塞整个状态机流转。

**building 模式：**
```json
{
  "status": "building",
  "completed_features": "N+1",
  "current_sprint": "下一条 pending 功能的 id 或 null（如全部完成）",
  "last_updated": "当前时间"
}
```

**fixing 模式（修复完成后）：**
```json
{
  "status": "reverifying",
  "fix_rounds": "N+1",
  "last_updated": "当前时间",
  "evaluator_feedback": null
}
```

### 6. 上下文检查
每完成一个功能后检查上下文使用量。如剩余不足 20%：
- 保存所有文件
- 更新 progress.json
- 告知用户「请重新启动 Claude Code 继续」，然后结束

### 7. 框架提案（可选）
实现过程中如果遇到以下情况，在 `framework/proposed-learnings.md` 末尾追加一条提案：
- 发现某个通用模式（可复用到其他项目）
- 踩到意外的技术约束或陷阱
- acceptance 标准的写法有缺陷（太模糊 / 无法验证）
- 某条铁律在实践中需要补充说明

**不得直接修改 `framework/` 其他文件**，只能追加到 `framework/proposed-learnings.md`。格式：

```markdown
## [YYYY-MM-DD] Claude CLI — 来源：F-XXX

**类型：** 新规律 / 新坑 / 模板修订 / 铁律补充

**内容：** [一句话描述，足够让用户判断是否值得沉淀]

**建议写入：** `framework/README.md` §经验教训 / `framework/harness/evaluator.md` / 其他

**状态：** 待确认
```

### 8. Handoff 说明（存在 executor:codex 功能时）
当所有 `executor:generator` 功能完成后，如果存在 `executor:codex` 的功能，在 progress.json 中写入 `generator_handoff`，说明：
- Generator 已完成哪些工具 / 脚本
- Codex 需要执行哪些 executor:codex 功能
- 已知的注意事项（脚本用法、环境变量、预期产出物路径）

## 完成标准
- **building 模式：** 所有 `executor:generator` 的功能 status 均为 "completed"（`executor:codex` 功能保持 pending，由 Codex 处理）→ 将 progress.json status 改为 "verifying"
- **fixing 模式：** 所有被标为 FAIL/PARTIAL 的 `executor:generator` 功能已修复 → 将 progress.json status 改为 "reverifying"，fix_rounds +1

---

## 9. Alpha / Beta / RC 依赖必须 ambient `.d.ts` shim 兜底

**背景：** KOLMatrix B5 fixing-1（commit f8fca4b）暴露：

- F006 引入 `@visx/wordcloud@4.0.1-alpha.0`（唯一支持 React 19 peerDeps 的版本）
- CI run typecheck 全绿（首次 npm install 时 .d.ts 正常解析）
- Reviewer 本地 typecheck FAIL：`Cannot find module '@visx/wordcloud'` + `Parameter 'd' implicitly has an 'any' type`
- 根因：alpha tag 在 npm install / npm ci 跨循环 .d.ts resolve 不稳定（不同 Node / npm 版本可能解到不同 .d.ts 文件，甚至 0 个）

**规律：** 任何 `alpha` / `beta` / `rc` / `next` / `experimental` tag 依赖**必须同时建 ambient shim**：

```typescript
// src/types/<package>.d.ts
declare module "<package>" {
  // 镜像 upstream 公共 surface
  export type BaseDatum<T = unknown> = T;
  export interface CloudWord { /* ... */ }
  export interface WordcloudProps<T> { /* ... */ }
  export const Wordcloud: <T extends BaseDatum>(props: WordcloudProps<T>) => JSX.Element;
}
```

upstream types 加载时本地 shim 是 no-op override（runtime 不动）；upstream types 漂移 / 没解到时 shim 兜底。

**Spec 起草 checklist（Planner）：** 任何引入 alpha/beta/rc tag 依赖的 spec § dependencies 段必须 explicit 列出：

- [ ] 依赖名 + 精确版本号（含 alpha tag 后缀）
- [ ] **要求 Generator 同步建 `src/types/<package>.d.ts` ambient shim**
- [ ] shim 文件路径写入 spec acceptance（验收 = shim 文件存在 + npm ci 后 typecheck 全绿）

**Generator 实战：** 显式 param type annotation 是 belt-and-suspenders 兜底，比依赖泛型推断稳：

```typescript
// 显式 type annotation（即便 generic 推断应该够，alpha .d.ts 不可信时双保险）
fontSize={(d: WordcloudDatum) => d.value}
{(cloudWords: CloudWord[]) =>
  cloudWords.map((w: CloudWord, i: number) => ...)}
```

来源：KOLMatrix B5 fixing-1（commit f8fca4b）。

---

## 10. IA refactor / route migration redirect scope wire-readiness 评估（v0.9.21 新增）

**背景：** BL-064 顶层 IA refactor 7→4 路由 spec §4 预期 ~12 条 redirect（7 老路由 + 子路径继承 + parametric），fix-round 1-3 实战发现 embed-old-components 占位策略下若 destination route **未 wire ready**（如 /campaigns/new → /brief?action=new 但 /brief 仅 embed /knowledge-base，没 wire form action），用户体验比 kept 旧路由 **差** — 跳转后 URL 换名但内容仍是旧的，反而 confusing。

**规则：**

A. **redirect scope 根据 destination wire-readiness 评估** — 不是所有老路由都立即 redirect。destination route 必须含等效或更优功能才启 redirect；否则 kept deep-link 让 UX 不退化

B. **embed-old-components 占位策略下的 redirect 评估清单**（spec 起草时套用）：

| destination 状态 | 决策 |
|---|---|
| 已 wire 该 content（实质功能在新路由）| redirect OK |
| 仅 embed-old 占位（URL 换名但内容不变）| **kept 更优**（用户认知不混乱）|
| 部分 wire（如 form embed 但 list 未 wire）| 按 sub-path 拆分；list path kept，form path redirect |

C. **redirect scope 缩减是良性 fix-round** — 不计入"质量问题"，反映 IA refactor 需要 building 中段实战验证才能确定最优 scope。BL-064 fix-round 1→3 把 12 条 redirect 缩减到 6 条（5 content-equivalent + 1 parametric），其余 4+ 条改 kept deep-link 推迟到后续批次 wire destination 后再启

D. **IaRedirectRule mixed-status 模式（v0.9.23 #14）：** 同一 middleware 实现支持混合 301/302 redirect — `IaRedirectRule` interface 加 `status?: 301 | 302` field（default 302 向后兼容），per-rule override 301。middleware 用 `rule.status ?? 302`，e2e REDIRECT_CASES 加 status field + `assert response.status()`。开发期默认 302（保留 rollback 能力），稳定后某些 rule 升 301（永久重定向）：
```typescript
// middleware.ts
export interface IaRedirectRule {
  from: string | RegExp;
  to: string;
  status?: 301 | 302;  // default 302; per-rule override
}
const finalStatus = matched.status ?? 302;
return NextResponse.redirect(new URL(matched.to, req.url), finalStatus);
```
来源：BL-069 fix-round 1 B1 — KB+Campaigns/new → /brief 需 301 永久但 BL-064 默认 302 → fix 加 status field 解决 mixed-rule 批次重写。

来源：KOLMatrix BL-064 fix-round 3 实战（顶层 IA refactor 7→4 路由）+ BL-069 fix-round 1 v0.9.23 #14（用户 2026-05-18 ack）扩展子段 D inline-merge。

---

## 11. 大型删除批次执行模板（v0.9.21 新增）

**背景：** BL-065-F006 单 commit ad76eb1：64 files / +1466 / -6124（净 -4658 lines）。本地 L1 全绿即推送，CI 3 轮自修才全绿 — woff2 stale / edge-states-coverage / visual-baselines-shape / UUID guard / Checkbox locator 等 baseline-tracking / fidelity-grep / next.js types-regen 类测试只在 CI 完整链路才暴露。

**Pattern：**

A. **本地 L1 全绿 ≠ CI 全绿** — 删除文件类操作会触发：
   1. `tests/integration/*-fidelity.test.ts` 类 grep 测试期望特定文件存在
   2. `tests/screenshots/baseline/*.png` 类视觉 baseline 数量断言
   3. `tests/unit/visual-baselines-shape.test.ts` 类清单测试（git-tracked 数量）
   4. `.next/types/validator.ts` Next.js 自动生成 page module 引用（删除前应 `rm -rf .next` 清缓存再 typecheck）
   5. material-symbols-outlined.woff2 / 任何 build-derived 资源 — 删除组件时 subset 会自动缩小，本地 regen + 提交

B. **删除前预扫清单（建议 Generator 在 Phase 1 开始前执行）：**
```bash
# 全仓引用 grep
grep -rln "<deleted-folder>" src/ tests/
# Integration test 引用
grep -l "from.*<deleted-module>" tests/integration/
# Baseline PNG 同名
ls tests/screenshots/baseline/*<deleted-feature>*.png 2>/dev/null
# Next.js cache
rm -rf .next && NODE_OPTIONS='--max-old-space-size=4096' npm run typecheck
```

C. **base-ui Checkbox E2E 选择器陷阱**：base-ui Checkbox 渲染 visible `role="checkbox"` button + sr-only aria-hidden `<input type="checkbox">`。`locator('input[type=checkbox]').check()` 会选 helper 卡 viewport 重试超时；**用 `getByRole('checkbox').click()`** 选 visible widget

D. **UUID guard pattern**：上游路由可能保留 stale ids（如 BL-064 redirect `/campaigns/abc-123 → /match?campaignId=abc-123` 用于 redirect E2E），下游 page 在调用 Prisma `findFirst({ where: { id } })` 前必须校验 UUID shape：
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!value || !UUID_RE.test(value)) return null;  // silent fallback
```
否则 driverAdapterError 500（"invalid input syntax for type uuid"）

E. **大型 atomic delete commit 优于多 sub-commit** — single commit atomic rollback、git log 单条目、易于 PR review。CI 失败时多轮自修（fix(BL-XXX): xxx）每轮独立、被 CI 全程捕获，不污染产品代码

F. **删显式子路由前必须先加上游 [id] UUID guard（v0.9.23 #17 扩展 D）：** 删 `src/app/[locale]/(app)/<resource>/new/page.tsx` 等显式子路由后，Next.js fallback 到动态 `[id]/page.tsx` → Prisma `findFirst({ id: 'new' })` 抛 `invalid input syntax for type uuid` 500。同 commit 必须给动态 `[id]/page.tsx` 加 `UUID_RE.test(id)` guard 走 `notFound()`。grep 自查：
```bash
find src/app -name 'page.tsx' -path '*\[*\]*' | while read p; do
  grep -L "UUID_RE\|isUuid" "$p" && echo "MISSING guard: $p"
done
```
来源：BL-070-F004 #1 删 `campaigns/new/page.tsx` fallback 到动态 `[id]/page.tsx` 触发 500。

G. **next-intl + `notFound()` HTTP status 不可靠（v0.9.23 #18）：** Next.js 15 App Router server component `notFound()` 标准是 404，但 next-intl middleware 包装响应后实际 status 可能 surface 为 200 + not-found body。e2e 验路由废弃时不能严格 `expect(status).toBe(404)`，应用 belt-and-suspenders：
```typescript
// e2e/route-deprecation.spec.ts
const response = await page.goto("/zh/old-route", { waitUntil: "domcontentloaded" });
expect(response?.status()).toBeOneOf([200, 404]);  // next-intl 包装后 status 不可靠
expect(page.url()).not.toContain("/old-route");    // 或验未 redirect 到错误目的地
await expect(page.getByText(/not found|页面不存在/i)).toBeVisible();  // 验 page body
```
来源：BL-070-F004 #2 删路由 e2e 验证时 status assertion 误判。

H. **i18n deprecated ns 删除前必须 grep 实际 callers（v0.9.23 #19）：** ns 可能跨 batch git mv 后仍 in use（如 BL-070-F004 把 KB CRUD 组件搬到 brief/ 但组件内部仍 `useTranslations("knowledgeBase")`）。盲信 marker `will delete this namespace` 整 ns 删会破 production。Python 批处理脚本应内嵌该自检：
```bash
# 删 ns 前必跑：0 caller 才能整 ns 删
grep -rln 'useTranslations\|getTranslations' src/ | xargs grep -l '"<ns-name>"'
```
0 命中才整 ns 删；有命中先修组件再删 ns（或保 ns 但更名说明）。来源：BL-070-F005 #1 git mv 后老组件仍引用 deprecated ns。

I. **lazy boundary 引入时的 fidelity test 同步清单（v0.9.23 #28）：** 把组件改名为 `XxxLazy` 后（如 `MatchRefineBar` → `MatchRefineBarLazy`），老 fidelity test 断言 `import { OldName } from "./OldName"` 失败。引入 lazy boundary 时必同步检查：
```bash
# fidelity test 引用扫
grep -rln 'import.*"\./<old-component-name>"' tests/integration/*-fidelity.test.*
# 同 commit 改 fidelity test 的 import name + assertion 文本
```
来源：BL-070 fix-round 2 #28 把 MatchRefineBar 改 Lazy 后 `f004-bl068-refine-fidelity` 测试断言失败，必须同步改 2 case。

J. **删 X 前 grep callers 矩阵（v0.9.24 #4 / BL-072 #4 扩展 H）：** §H i18n ns 删除 grep callers 经 BL-072-F006 修 10 处 outbound 404 实战暴露，模式可一般化为「删任何被引用资源前必先 grep 全仓 callers + 同 commit 修」。矩阵收纳已知 X 类型 + grep 模板 + 自动化防御 test，未来 TBD 行待补：

| X 类型 | grep 模板 | 自动化防御 test | 反例 / 实战 |
|---|---|---|---|
| **i18n namespace**（删 `messages/*.json` ns 块） | `grep -rln 'useTranslations\|getTranslations' src/ \| xargs grep -l '"<ns>"'` | `tests/unit/i18n-page-side-consumption.test.ts` v2（v0.9.24 #7）扫 t("<key>") 验 messages exist | BL-070-F005 #1 git mv 后老组件仍引用 deprecated `knowledgeBase` ns（v0.9.23 #19 沉淀，§11 H 段） |
| **路由 outbound**（删 `page.tsx` / route segment） | `grep -rEn "['\"]/(<deleted-route>)" src/ --include='*.tsx' --include='*.ts'` + `grep -rEn 'router\.(push\|replace)\("/(<deleted-route>)'` | `tests/unit/link-target-audit.test.ts`（BL-072-F007）扫 href 字面 → 比对路由树 + IA_REDIRECT_RULES | BL-072-F006 修 10 处 outbound 404（BL-070-F004 删 5 老路由 + middleware 即停 redirect 时漏 grep） |
| **enum value / API endpoint / DB table** | TBD（按场景定 grep + 类型搜索） | TBD（如 DB column 引用 ts-prune / `grep prisma.<table>` 扫） | 暂无实战，留待未来沉淀 |

**Generator self-check 流程：**
1. 删前 grep 当前矩阵覆盖类型对应 caller，0 命中才删
2. 有命中 → 同 commit 修 caller（不允许跨 commit 拆）
3. 同 commit 补 advisory test 防御未来同类 regression（per BL-072-F007 模式，详 evaluator.md §13.X advisory test 三件套）

来源：BL-072-F006 修 10 处 outbound 404 + v0.9.24 #4 用户 2026-05-26 ack。同主题合并 §11 H（v0.9.23 #19 i18n ns 单维度）+ J（v0.9.24 #4 路由 outbound + 矩阵化）。

来源：KOLMatrix BL-065-F006 atomic delete commit 实战（3 轮 CI 自修后全绿，CI run 25782189342）+ BL-070-F004/F005/F009 v0.9.23 候选 #17/#18/#19/#28（用户 2026-05-25 ack）扩展子段 F-I inline-merge + BL-072-F006 v0.9.24 #4（用户 2026-05-26 ack）矩阵化 J 段。

---

## 12. Audit 起草 + LLM fix-round 工具链（v0.9.22 #3 + #8 + #9 沉淀）

跨多批次实战暴露的 audit / fix-round 工具链 3 项规则。

### 12.1 Audit 起草前必实测原子组件 surface（v0.9.22 #3）

Generator 在 pre-impl audit 起草前必须**实测原子组件实际 surface**，而非按 README / 类型签名"字面想象"。

**实测优先级 checklist：**
1. **原子组件实测：** Read 组件源码 + 验 props 类型签名（如 BL-066 F006 Table.tsx README 看似有 col cap，实测 forwardRef + className 透传 fully flexible）
2. **路径配置实测：** `find` / `grep` 实际文件位置（如 spec 写 `/foo/bar` 但实际位置可能漂移）
3. **SQL 实际行为实测：** `ssh prod-db` sample 5-10 rows（如 zod schema 与 prod 数据 shape 比对）
4. **API response shape 实测：** 跨服务 GET 拉真数据 JSON parse 验证

**反面（BL-066 F006）：** Generator audit 建议保守拆列（怕 Table col cap），Planner 实测纠偏 fully flexible → 裁决 #4=A（6 列方案）偏离 Generator 建议。系统性"文档想象"偏差需 Planner 反复实测纠偏，成本高。

**配套 Planner 端：** Generator 建议命中率 ≥80% 时 Planner 裁决可降复杂度（直接 ack + 短理由）；< 80% 时 Planner 需深挖偏离项 + 沉淀新规律。详见 `framework/harness/pre-impl-adjudication.md §12`。

来源：BL-066 F006 audit 实战 + v0.9.22 #3。

### 12.2 Next.js / 构建器切换 hidden TS errors checklist（v0.9.22 #8）

Turbopack ↔ webpack 切换时 webpack 严格 typecheck 暴露 hidden TS errors：

| Hidden 错误类型 | 触发场景 | 修法 |
|---|---|---|
| `Record<AssetType, ...>` 加新 enum 值未补 entry | enum 扩张 | webpack exhaustive check 强制补 entry（Turbopack 宽松不报） |
| 字段命名漂移（`breakdown` → `rawBreakdown`）| refactor 漏更新 caller | webpack 严格 typecheck 报 / Turbopack 容忍 undefined access |
| `href!` 非空断言缺失 | e2e spec 用 `as` cast 替代 | 加 non-null assertion 或修类型 |
| 测试 mock 同步 shape 与真实 type | mock 漂移 | webpack typecheck 直接 fail；Turbopack 静默 |

**应用：** Next.js 升级 / Turbopack ↔ webpack 切换时必跑：
```bash
npx tsc --noEmit --strict           # 全项目 typecheck
grep -rn 'Record<' src/             # 全 enum 用法 audit
grep -rn '! \|as any' src/          # non-null assertion / cast audit
```

来源：BL-067 fix-round 1 commit 6dbe231（修 4 处 hidden TS errors） + v0.9.22 #8。

### 12.3 LLM fix-round 必先 MCP trace 抓真因（v0.9.22 #9）

LLM 类 fix-round 必先 MCP `get_log_detail` trace 抓真实输出 + 与预期 diff，不要凭"LLM 应该怎样"推断。

**反例（BL-068 fix-round 1+2）：** 凭"LLM 幻觉新增 ID"假设改 prompt（加约束 / 动态 N），收敛 drift 但仍不通过 → fix-round 3 通过 MCP `get_log_detail trc_ew4fi0u4hihjdw07bu73xer3` 抓出 LLM **实际返回**：30 IDs 中**重复 1 个已有 id**（index 8 + 29），不是幻觉新 ID。真因 = dedupe 问题非 set-membership 问题，前两轮 fix prompt 都打错点。

**工具链：**
- aigcgateway dashboard `logs` API + MCP `list_logs(project_id, limit=20)` 列 failed call
- MCP `get_log_detail(log_id)` 抓 input variables + output text + metadata（latency / cost / model）
- diff 真实输出 vs 预期 → 找模式（dup ID / format drift / missing field）

**应用：** 每次 LLM-related fix-round 第一动作 = trace 5-10 个 failed call 找模式，不要直接改 prompt。Planner 配套规则：verifying gate 失败时优先 trace 真因而非直接 ack fix（详见 `planner-arbitration.md`）。

来源：BL-068 fix-round 3 MCP trace 实战 + v0.9.22 #9。

---

## 13. 基础设施 MVP 模式 — InMemoryJobQueue + fire-and-forget + mount self-heal（v0.9.22 #5）

适用于 PM2 single-instance cluster=1 架构的 BullMQ 前置方案。

**模式核心：**

1. **server action `void jobQueue.add(name, payload, { idempotencyKey, delay: 1 })`** — 让 LLM 异步跑入下一 tick，server action 立即 return 不阻塞 mount
2. **进程重启丢 prewarm** — 由用户重 enter 页面触发 mount self-heal 自然恢复
3. **idempotencyKey 同进程内幂等防重** — 防止 mount race condition 重复 enqueue
4. **worker concurrency 由 setTimeout 隐式 1** — 不并发，简化错误处理

**升 BullMQ 的触发条件（任一命中）：**
- (a) PM2 reload 频次 > 2 次/day（重启丢任务 UX 影响）
- (b) scale-out 到 cluster>1（in-memory 不跨进程）
- (c) job 处理时间 > 60s 致 mount→short 完成延迟感知（用户重 enter 页面已超过预期）

**反面适用：** 不适用于"必须可靠交付"类 job（如付款回调 / 关键业务事件 — 需 BullMQ Redis 持久化）。

**实战案例：** BL-067 F005 InMemoryJobQueue 实装支持 prewarm 异步执行（探索类查询，丢失可重试）；BL-068 +1 caller 沿用。Spec acceptance 措辞模板：「场景 P95 latency 容忍 = 用户 mount self-heal 即可恢复（fire-and-forget MVP）」/「BullMQ 升级条件触发后启独立 batch」。

来源：BL-067 F005 实战 + v0.9.22 #5。

---

## 14. 编译时约束 / migration 工程化（BL-070 #22 + #23 沉淀）

### 14.1 `prisma migrate dev` wrap script — 自动注入 ROLLBACK skeleton（BL-070 #22）

`prisma migrate dev` 创 migration 不自动加 ROLLBACK 注释，`scripts/validate-rollback-sql.sh` 是后置 CI 检查，触发 CI 红才发现。**建议 wrap script 自动注入 ROLLBACK skeleton 从生产源头避免 CI 红：**

```bash
#!/usr/bin/env bash
# scripts/prisma-migrate-dev-wrap.sh
npx prisma migrate dev "$@"

# 找最新 migration 文件，未含 ROLLBACK 注释则注入 skeleton
LATEST=$(ls -t prisma/migrations/*/migration.sql | head -1)
if ! grep -q "^-- ROLLBACK:" "$LATEST"; then
  cat >> "$LATEST" <<EOF

-- ROLLBACK: <inverse SQL here>
-- TODO(BL-XXX): fill in inverse SQL before merge
EOF
  echo "✓ Injected ROLLBACK skeleton in $LATEST — please fill before commit"
fi
```

**配置 package.json：**
```json
{
  "scripts": {
    "db:migrate": "bash scripts/prisma-migrate-dev-wrap.sh"
  }
}
```

来源：BL-070 fix-round 1 #22 — `scripts/validate-rollback-sql.sh` CI 检查触发后回头补 ROLLBACK 注释（fix-round 浪费）；上游 wrap 自动注入避免。

### 14.2 Next.js 16 `'use server'` file-level directive 约束清单（BL-070 #23）

Next.js 16 `'use server'` 文件**禁非 async function exports**。在此文件里加 zod schema / 常量 / 普通对象 / 类的 export 会触发 build/runtime error。

**约束清单：**
- ✅ `export async function actionName(...) { ... }` — 允许
- ❌ `export const SchemaName = z.object({ ... })` — 禁
- ❌ `export const CONSTANT = "value"` — 禁
- ❌ `export class Helper { ... }` — 禁
- ❌ `export type AliasName = ...` — 禁（类型在某些版本严格）

**zod schema 抽离模板：**
```typescript
// src/app/[locale]/request-access/schema.ts  (无 'use server')
import { z } from "zod";
export const AccessRequestSchema = z.object({
  email: z.string().email(),
  // ...
});
export type AccessRequest = z.infer<typeof AccessRequestSchema>;

// src/app/[locale]/request-access/actions.ts  (含 'use server')
"use server";
import { AccessRequestSchema } from "./schema";
export async function requestAccess(input: unknown) {
  const data = AccessRequestSchema.parse(input);
  // ...
}
```

来源：BL-070 fix-round 1 #23 — landing batch 加 `AccessRequestSchema` 到 actions.ts 触发 Next.js 16 build error，抽到独立 `schema.ts` 解。

### 14.3 Schema migration ROLLBACK 不对称风险 — cross-ref database-patterns（v0.9.24 #16 / BL-076 #16）

扩范围 migration（NUMERIC(M,N) / VARCHAR(N) 增大）顺向无损但 ROLLBACK 可能因 prod 已含越界 row → throw `value out of range`，必须在 ROLLBACK SQL 前置 `UPDATE clamp` step。

**详见 `framework/harness/database-patterns.md` §"Schema migration ROLLBACK 不对称风险"** — 主写含 BL-076-F001 `engagement_rate NUMERIC(5,2)→(7,2)` 反例 + 模板 + 适用边界（NUMERIC/VARCHAR 有尺寸约束 vs Int/Text/Uuid 无）。

Generator 写 ROLLBACK SQL 时 self-check 流程：(1) 顺向是否含尺寸约束类型扩范围；(2) 若是 → 查 prod 实际 value range 是否已越界 ROLLBACK 目标范围；(3) 越界 → ROLLBACK 必加 `UPDATE clamp` 前置 step。

来源：BL-076-F001 实战 + v0.9.24 #16 用户 2026-05-27 ack（双归属：database-patterns 主写 + generator 1 行 cross-ref）。

---

<!-- §16 §17 是 v0.9.24 BL-077-F002 新加段，紧接 §14.3 后；后续 §15 保留原编号以匹配 CHANGELOG v0.9.23 + archive proposed-learnings-archive-v0.9.23.md 6 处跨文件 §15.1 §15.2 引用稳定性 — 段号 ascending 顺序非严格，主题分组优先 -->

## 16. DB / 外部 API batch 健壮性 — per-element try/catch（v0.9.24 #15 / BL-076 #15）

**坑：** `for ... of` 内 `prisma.upsert` / 外部 API call / 文件 IO 默认假设全部成功 → 单元素异常 throw 阻塞整 batch。BL-076-F003 根因：`scripts/kol-sync-daily.ts` import.ts `for raw of raws` loop 无 per-KOL try/catch → 第一个 numeric overflow throw → 整 2567 KOL batch fail（`inserted=0 updated=0 errors=1`），prod 数据同步管道在沉默中断 14 天。

**模板：**

```typescript
const stats = { success: 0, failed: 0 };

for (const item of items) {
  try {
    await prisma.X.upsert({ where: { ... }, create: { ... }, update: { ... } });
    stats.success += 1;
  } catch (err) {
    stats.failed += 1;
    console.error("[batch] item failed:", item.id, err);

    // forensic：失败明细落 audit_log（嵌 try/catch 防 audit 再 throw recurse）
    try {
      await prisma.auditLog.create({
        data: {
          action: "X.failed",
          tenantId: item.tenantId ?? null,
          payload: {
            itemId: item.id,
            itemSummary: { /* 最小可识别字段，避免敏感数据 */ },
            error: String(err).slice(0, 500),
          },
        },
      });
    } catch (auditErr) {
      // swallow — audit 失败不能阻塞主 batch；上层 log monitoring 兜底
      console.error("[batch] audit failed:", auditErr);
    }
  }
}

return stats; // 上层 caller 据 stats.failed / stats.success 决定 alerting
```

**关键设计：**
- `stats.failed` 累加而非 throw — caller 据 stats 决策是否 alert，不是单元素 fail 即全停
- audit_log 落 forensic 明细 — 后置追溯单条失败原因（v0.9.24 #14 prod alerting 抓 stats.failed > 0 配套）
- audit 嵌 try/catch — audit 自身失败不能 recurse 阻塞主 batch
- 错误 message slice(0, 500) — 防超长 stack trace 撑爆 payload column

**适用边界：**
- ✅ DB write loop（`prisma.upsert` / `prisma.create` 批量）
- ✅ 外部 API call loop（aigcgateway / Resend / 第三方平台 fetch 批量）
- ✅ 文件 IO 批量（CSV 行解析 + 落 DB / 图片处理 batch）
- ❌ 业务 critical 单 transaction（payment / 唯一性 reservation 等 — fail-fast 更安全）
- ❌ ACID 跨表多 step 操作（事务原子性优先于个体隔离）

**配套 alerting（详 deploy-patterns.md §"prod 关键流程 log-based alerting"）：** stats.failed > 0 时 caller log `level=WARN/ERROR + stats`，触发 Slack webhook + GCP Cloud Monitoring，避免 BL-076 同款 14 天沉默 outage。

来源：BL-076-F003 实战（import.ts 加 per-KOL try/catch + stats.failed + audit forensic）+ v0.9.24 #15 用户 2026-05-27 ack。

---

## 17. adapter output 边界 check 三件套 — clamp + outlier flag + 业务阈值 < DB 上限（v0.9.24 #17 / BL-076 #17）

**坑：** adapter (external API → DB) 数据流默认信任 upstream 数值 → 超出 DB column type 范围即 `numeric field overflow` throw。BL-076-F002 实战：apify-kol adapter 计算 `engagementRate = totalLikes / postsCount / followers * 100`，少量 KOL 因 followers 异常小或 totalLikes 异常大 → rawRate > 99999.99 → `Decimal(7,2)` overflow → 整 batch fail（配合 §16 缺失同时暴露）。

**三件套模板：**

```typescript
// 三件套：clamp + outlier flag + 业务阈值 < DB 上限
const BUSINESS_THRESHOLD = 100;     // 业务阈值（百分比合理上限）
const DB_MAX = 99999.99;            // DB Decimal(7,2) 上限
// 业务阈值 < DB 上限 — 异常先标 flag 不丢数据，DB 边界仅最后兜底

const rawValue = computeFromExternalAPI(input); // 可能 null / NaN / 超大
const clampedValue = rawValue == null
  ? null
  : Math.min(Math.max(rawValue, 0), DB_MAX);

const isOutlier = rawValue != null && rawValue > BUSINESS_THRESHOLD;

return {
  field: clampedValue,
  metadata: {
    flags: {
      ...existingFlags,
      field_outlier: isOutlier,        // 业务异常 flag — 后置 dashboard / audit 关注
      field_raw_overflow: rawValue != null && rawValue > DB_MAX, // DB 兜底触发 flag
    },
  },
};
```

**三层关系：**

| 层 | 触发条件 | 用途 |
|---|---|---|
| **业务阈值 BUSINESS_THRESHOLD** | rawValue > 业务合理范围（如 100% engagement rate） | 标 `outlier=true` flag，下游 dashboard 过滤 / 人工 audit |
| **DB 上限 DB_MAX**（必须 >> 业务阈值） | rawValue > DB column type 上限 | clamp 到 DB_MAX 防 overflow throw + 标 `raw_overflow` flag |
| **null 兜底** | rawValue == null / NaN | 写 null（DB column 允许 null）+ 上游 stats 计 `metadata_missing` |

**关键设计：**
- **业务阈值 < DB 上限是设计原则** — 异常值先标 flag 不丢数据，DB 边界仅最后兜底（不是业务阈值即 reject）
- **outlier flag 落 metadata.flags 而非独立 column** — JSON 字段灵活扩展，避免 schema migration 抖动
- **不 throw / 不 skip 异常 row** — 上游 batch loop（§16）依赖每条都返回 stats.success，flag 后置审查

**适用边界：**
- ✅ Decimal(M,N) / SmallInt / VARCHAR(N) 有尺寸约束的 DB 列上游 adapter
- ✅ LLM 返回数值字段（如 `score / weight`）— 模型可能输出超范围或非数字
- ✅ 用户 input 数值字段（age / count 等）— 业务阈值过滤 + DB 兜底
- ⚠️ Int / Float / Text 无尺寸约束 type 不需 clamp，但仍建议加 `outlier` flag（业务阈值过滤）

**配套 schema 设计（详 database-patterns.md §"Schema migration ROLLBACK 不对称风险"）：** DB 列尺寸定义时留余量（如 BL-076 把 `engagement_rate` 从 NUMERIC(5,2) 扩到 NUMERIC(7,2)），余量比业务阈值至少大 100x，避免频繁 ALTER。

来源：BL-076-F002 实战（apify-kol adapter Math.min(rawRate, 99999.99) + outlier=rawRate>100 + metadata.flags 落地）+ v0.9.24 #17 用户 2026-05-27 ack。

---

## 15. Perf / image / Suspense 落地（v0.9.23 #27 + #29+#30 合并段）

### 15.1 next/image 异构 CDN 落地：unoptimized + explicit dims（BL-070 #27）

异构 CDN avatar/logo 场景，`unoptimized={true}` + explicit dims 是最稳的 next/image 落地姿势，优于强上 `images.remotePatterns` 累积白名单。

**理由：**
- 多平台 KOL avatar CDN（YT 现；TikTok/Twitch/Bilibili later）远多于 `next.config.ts` whitelist 能覆盖
- `unoptimized` 跳 AVIF/WebP 转换通路但保留 explicit width/height 的 **CLS reservation 收益**（核心 UX 价值）
- 小尺寸 avatar (32-64px) 优化收益微；大图 (banner 1200×240) 也 unoptimized — 低流量 detail page 不致命

**落地模板：**
```tsx
<Image
  src={kol.avatarUrl}                // 异构 CDN（YT / TikTok / Twitch / Bilibili）
  alt={kol.displayName}
  width={48}                         // explicit dims 保 CLS reservation
  height={48}
  unoptimized                        // 跳 Next.js AVIF/WebP 转换通路
  className="rounded-full"
/>
```

**反面：** 强上 `images.remotePatterns` 累积白名单 → build error（新 CDN 未及时 PR）或运行时 403（白名单未含）。

来源：BL-070 fix-round 2 #27 — KOL avatar 多平台 CDN whitelist 维护成本爆炸 → `unoptimized + explicit dims` 解。

### 15.2 Suspense fallback 规范（v0.9.23 #29+#30 合并段，两 source）

Suspense fallback skeleton 必须**像素级镜像实际 outer 结构**（高度 + 宽度），否则 swap 时触发 CLS（垂直反差）和 flex-wrap reflow（横向反差间接放大垂直 CLS）。

**双层规范：**

**(A) 高度镜像（#29 source — `/match` CLS 0.348 → 0.008 fix）：**

skeleton 必须等于实际渲染内容的**总高度**，不仅 `glass-panel + animate-pulse` 视觉。skeleton 高度差异会按下游 shifted 内容总高度（如 1039px 高的主网格）放大 CLS 评分。

```tsx
// ❌ 反面：88px skeleton swap 为 150px 实际卡 → 62px 反差 × 4 卡 × 整网格高度 = CLS 0.348
<Suspense fallback={<div className="h-22 glass-panel animate-pulse" />}>
  <KolMatchGrid />
</Suspense>

// ✅ 正确：skeleton 同 grid 同高度 4×150px 卡槽 → CLS 0.008
<Suspense fallback={
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    {Array.from({ length: 4 }).map((_, i) => (
      <div key={i} className="h-[150px] glass-panel animate-pulse" />
    ))}
  </div>
}>
  <KolMatchGrid />
</Suspense>
```

**(B) 宽度等宽（#30 source — `flex-wrap` 父容器下横向 reflow 间接放大 CLS）：**

skeleton 宽度在 `flex-wrap` 父容器下必须**与实际等宽**（或更宽），否则 swap 时横向 reflow 触发换行 → 间接放大垂直 CLS。

```tsx
// ❌ 反面：SaveSearchControlsSkeleton w-44（~176px）swap 为 ~460px 实际 → flex-wrap header 换行 → 垂直 reflow
<Suspense fallback={<div className="w-44 h-9 animate-pulse" />}>
  <SaveSearchControls />
</Suspense>

// ✅ 正确：等宽 ~460px
<Suspense fallback={<div className="w-[460px] h-9 animate-pulse" />}>
  <SaveSearchControls />
</Suspense>
```

**Lighthouse 13.x audit 定位工具（#30 附加）：** `cls-culprits-insight` 在 JSON 输出 path = `details.items[].node.selector + snippet + boundingRect` — 比 `layout-shift-elements` 更准确直指 shift target。后续优化 perf 优先 grep 此键定位 CLS 元素。

**Lighthouse 落地自测（关联反思）：** Suspense PR push 前必跑 Lighthouse Desktop logged-in 自测，不要等 Reviewer fix-round 才捕 CLS。本地跑：
```bash
npx lighthouse http://localhost:3001/<route> --preset=desktop --view --only-categories=performance
```

来源（双 source）：
- BL-070 fix-round 3 #29（`/match` CLS 0.348 → 0.008 高度镜像 fix）
- BL-070 fix-round 3 #30（`SaveSearchControls` flex-wrap 横向 reflow → 宽度等宽 fix + Lighthouse `cls-culprits-insight` 定位法）
- 两条同主题 inline-merge 为 §15.2 「Suspense fallback 规范」单段含两 source（per D7 强制合并）+ 用户 2026-05-25 ack。

---

## 18. 现代 CSS 渐进增强 — Native API + Fallback + reduced-motion 三层守门（BL-078 #3 / BL-078-F002+F003）

**触发场景：** 引入现代 CSS API（view transitions / scroll-driven animations / `interpolate-size: allow-keywords` / container queries 等）做 motion / transition / animation 类视觉效果。BL-078 实战：landing 视觉精修引入 `@view-transition { navigation: auto; }` 跨文档过渡 + `animation-timeline: view()` scroll-driven entrance + `interpolate-size` FAQ smooth height transition。

**核心原则：** 现代 CSS API 在 Chrome 115+/Safari 18+ 原生支持，Firefox / 旧 Safari 走 fallback 退化（功能不破，仅 motion 缺失）；最后所有 motion 必经 `prefers-reduced-motion` 守门，启用 reduce 后退化静态/瞬时切换（与 evaluator.md §11.6 motion a11y 三件套 配套）。

三层守门 = **Native API 优先** + **Fallback 兜底** + **reduced-motion 强制守门**。任一层缺失 → motion a11y 反例。

### 18.1 Native API 优先（Chrome 115+/Safari 18+）

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

### 18.2 Fallback 兜底 — Firefox / 旧 Safari

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

### 18.3 prefers-reduced-motion 强制守门

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

**实测 checklist（与 evaluator.md §11.6 配套）：** DevTools Rendering panel 模拟 `prefers-reduced-motion: reduce` → 抽 3-5 个 motion 路径（hero entrance / sticky-parallax / scroll-driven / view transitions / FAQ smooth height）实测无 motion 或 ≤ 0.01ms `animation-duration`。

### 18.4 适用边界

| 适用 | 不适用 |
|---|---|
| `animation` / `transition` / `transform` / view transitions / scroll-driven / interpolate-size 类 motion | 静态 CSS（color / spacing / typography / layout）|
| 现代 API 检测 + fallback + reduced-motion 三层（任一缺失即 review FAIL） | 仅纯 CSS 静态规则（color token / radii / shadows / border 等不需 motion 守门）|
| landing / marketing 页（motion-heavy） | app CRUD 页（motion-light，通常仅 hover / focus transitions 也建议带 reduced-motion 守门）|

**配套：**
- `framework/harness/ui-fidelity-guardrail.md` §3.4 landing visual token layer（BL-078 #2 — `--duration-*` + `--ease-*` token 与本段配套）
- `framework/harness/evaluator.md §11.6` motion a11y 三件套（BL-078 #1 + #5 — opacity-dimming trap + reduced-motion 验收）
- `framework/harness/planner-checklists.md` §"Visual polish reference URL 提炼方法论"（BL-078 #4 — 决定哪些 motion 信号契合自身 brand）

来源：BL-078-F002 `src/styles/globals.css` `@view-transition` + `landing-hero-fade-in` + `landing-hero-video-scale` 实物 + BL-078-F003/F004 `interpolate-size` FAQ smooth height + BL-078 #3 用户 2026-05-27 ack。

---

## 19. AI 调用客户端超时必须 ≥ 服务端 timeoutMs 且基于实测延迟校准（BL-084 #1 / BL-084 fix-round 1）

**铁律：** 任何 AI 调用的**客户端**超时（dialog / fetch / setState error 计时器）必须 ≥ **服务端** `runAigcAction` 的 `timeoutMs`，且数值基于 **gateway `list_logs` 实测 latency 分布**校准，不可凭 roadmap 乐观假设。

**反例（BL-084 Why dialog）：** `DetailedExplanationDialog` 客户端硬超时 5s（BL-067 设），但 `EXPLAIN_DETAILED` action 真实延迟 15-21s（gateway trace `trc_rkxiis8qp4uyuvx53ioadsd2` 实测 21.1s 才 success + write-through 缓存）→ 客户端 5s 已 setState error 显示「暂时不可用」。该 bug 在 BL-067 就潜伏，被 F005 prewarm + 偶发 cache-hit 掩盖；BL-084 match 面板无 prewarm，缓存未命中时 **100% 必现**。

**根因：多 locale × 多段 write-through payload 天然慢** — `EXPLAIN_DETAILED` / `MATCH_RERANK` 单次 5 locale × 5 段 ≈ 4500 token ≈ 20s。BL-067 假设 <5s P99，实测 4-20× 偏差。

**self-check 流程：**
1. 调 `list_logs` / `get_log_detail` 看该 action 真实 latency 分布（P50/P95/P99），不看 roadmap 数字
2. 客户端超时 = max(服务端 timeoutMs, P99 实测) + buffer
3. 多 locale write-through / 大 payload 类调用尤其要核（延迟大头）

**衍生（Planner ADR 候选）：** 多 locale 一次 write-through vs 仅当前 locale + 其余懒加载的延迟/成本权衡（detailed 仅当前 locale 5 段 ≈900 token ~4s，但牺牲"一次预热 5 locale"）。

来源：BL-084 fix-round 1 Why dialog FAIL 根因 + 用户 2026-06-09 ack。

---

## 20. 「入队等外部资源就绪」类设计必先验 worker 是否即时消耗任务（BL-086-F003 #1）

**checklist：** 凡设计"先把任务入队、排队等外部资源（充值 / 配额 / 上游就绪）后再真执行"，spec/诊断写下假设前必须先核 **worker 生命周期** + **错误吞没行为**，否则任务会在资源未就绪时被即时消耗成 `succeeded-0` 或 `failed-no-retry`。

**反例（BL-086-F003）：** 诊断假设"充值前把 2535 id POST `/admin/seeds` 入队 → 排队等充值 → 充值后真抓"。读 apify fork SDK 源码证伪：
1. fork scrape-worker `boss.work('scrape',…)` **持续运行**（非 daily cron），enqueue 的 manual_seed job **立即处理**
2. `youtube.getChannels()` per-url 错误是 **swallow**（`catch{ console.warn }` continue）→ 余额耗尽时返**空数组**而非 throw
3. manual-seed-scrape 拿空数组 → `{inserted:0}` 不 throw → worker 判 job **`succeeded` inserted=0**（pg-boss retryLimit=0 不重试）

**净效果：充值前投喂 = job 全 succeeded-0，id 被消耗，充值后不会重抓**（job 已 succeeded），且投喂脚本 checkpoint 已标 fed → 充值后须先清 checkpoint 才能重喂。**正解：全量投喂放充值之后**；充值前只 dry-run（只读 count）+ 脚本就绪即可，不真投。

**核查动作：** grep worker 是否 long-running（`boss.work` / 常驻 setInterval）vs cron-triggered；grep per-item 错误是 `catch{ continue }`（swallow）还是 throw。两者组合决定"未就绪时入队"会不会被静默消耗。

来源：BL-086-F003 apify fork SDK 源码核查 + 用户 2026-06-09 ack。

---

## 21. 改落地页视觉的 feature CI 时序 — visual-regression baseline 须 Linux runner 重拍（BL-080-F003 #1）

**坑：** 本仓 `ci.yml` 每次 push main 还跑完整 Playwright e2e + visual-regression（`landing-{en,zh}-{desktop,mobile}` 4 张 baseline + 功能断言）。F003 spec 把 L1 acceptance 只写「lint + tsc + vitest」，据此判本地全绿即 push → 但任何改落地页视觉的 feature 一 push 即 CI 红，直到：

1. **baseline 在 Linux runner 重拍**：跑 `update-visual-baselines.yml` workflow_dispatch 重拍（本地 mac/WSL 生成的 PNG 因字体 hinting 差异在 CI diff，**不可本地重拍**）
2. **失效的功能断言同步更新**：因视觉改动失效的断言（如删 hero video → `landing-hero-video` 断言）同 commit 改

**两连带坑：**
- bot 用 `GITHUB_TOKEN` push 的 baseline commit **不触发 CI**（GitHub loop 防护）→ 须手动 `gh workflow run ci.yml` 验 HEAD（同 §4.1 通解）
- Docker Hub 偶发 `docker pull pgvector 500` 让 service-container init 挂，非代码问题 → `gh run rerun <id> --failed`

**spec 起草建议：** 对「改视觉的 feature」显式把 **baseline 重拍 + 连带断言更新纳入同一 feature 的 acceptance**，而非拆到后续 F005/F006，避免 main 中途红。删 video 导致的 e2e 断言更新本属 Evaluator 测试域，但 CI 红阻塞 main 时 Generator 被迫改测试 = scope 边界争议，提前并入同 feature 可消解。

**配套：** `framework/harness/deploy-patterns.md §4.1`（GITHUB_TOKEN bot commit 不触发下游 workflow + workflow_dispatch 通解）。

来源：BL-080-F003 落地页视觉改动 push 后 CI 红 + 用户 2026-06-09 ack。
