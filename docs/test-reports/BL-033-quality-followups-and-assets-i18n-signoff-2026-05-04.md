# BL-033 质量收尾合集（Checkbox 视觉 + KB pipeline + /assets i18n）Signoff 2026-05-04

> 状态：**Reviewer first-round PASS**（progress.json status=verifying → done）
> 触发：BL-032 prod backfill done 后用户连报 2 个 prod 质量问题（outreach KOL Checkbox unchecked 视觉永远 ✓ + /zh/assets UI 半英文）；并入 BL-032 留账 Soft-watch S1（[DATE] token）+ S2（AI 输出 server-side validation 兜底）。

---

## 变更背景

prod 部署 BL-032 backfill 完成后两个用户报：

1. **F001 触发故障：** /zh/outreach KOL 表 unchecked checkbox 视觉永远显示 "✓" 字面图标。Phase 1 调研锁 base-ui Indicator `keepMounted` 配置错配 — 让 indicator span 在 unchecked 时仍渲染 → "check" 字面图标显形。
2. **F004 触发故障：** /zh/assets 全 UI 仍英文显示。grep 锁 messages/{en,zh,ja,ko,es}.json 5 文件全缺 `assets` 命名空间，AssetsClient.tsx 1942 行有 30 处 t() vs 60+ 硬编码英文，i18n 半成品。

加上 BL-032 留账 Soft-watch S1（`[DATE]` token 留字面）+ S2（AI 输出 server-side validation 兜底建议），合并 1 mini-batch 一次解决。Q1-Q4 用户决策锁：5 语言全填 + 含 errors 错误 toast i18n + 合并 BL-033 + 不重生 visual baseline。

4 features 全 generator：F001 Checkbox 单 prop 删 / F002 `{{date}}` token 必填 + backfill / F003 server-side validation / F004 i18n 完整接入。

---

## 变更功能清单

### F001：Checkbox unchecked 视觉 hotfix

**Executor：** generator
**文件：** `src/components/ui/Checkbox.tsx` / `src/components/ui/__tests__/Checkbox.test.tsx`
**改动：**
- `Checkbox.tsx:69` 删 `keepMounted` 单 prop（其它不动）；base-ui 默认 mounted=false 时 `<BaseCheckbox.Indicator>` 直接 return null → "check" 字面图标在 unchecked 时不渲染 → 视觉正确
- `__tests__/Checkbox.test.tsx` 加 2 case：
  - "renders no glyph when unchecked-not-indeterminate" — 不传 checked/defaultChecked/indeterminate → 断言 `container.textContent` 不含 'check' 不含 'remove'
  - "removes glyph when transitioning checked→unchecked" — `rerender` 从 `checked={true}` → `checked={false}`；先含 'check'，后两者皆无

**验收：** ✅
- Checkbox.tsx:69 staged diff 仅删 `keepMounted` 一行（line 68-77 现仅有 `className`），其它不动
- 既有 5 case + 新 2 case = 7/7 PASS（spec §D1 测试 gap 修复硬要求）
- grep 验证仅 OutreachComposer 用 Checkbox（影响范围窄）；既有快照测试无 break

### F002：`{{date}}` token 加入 SubstituteVariables + KB prompt + backfill 残留 [DATE]

**Executor：** generator
**文件：** `src/lib/email/variable-substitute.ts` / `src/lib/email/__tests__/variable-substitute.test.ts` / `src/lib/products/generateAiAssets.ts`（prompt 段落） / `src/app/[locale]/(app)/outreach/OutreachComposer.tsx`（2 调用站） / `src/app/[locale]/(app)/outreach/templates/TemplateWorkspaceClient.tsx`（1 调用站） / `scripts/convert-bracket-tokens-to-mustache.ts` / `scripts/__tests__/convert-bracket-tokens-to-mustache.test.ts`
**改动：**
- `SubstituteVariables` interface 加 `date: string` 字段（**必填，不是 optional**），TS 编译期捕获所有调用点；`resolve()` 函数已支持顶层路径 'date' 无需改
- 3 调用站全补传 `date: new Date().toISOString().slice(0, 10)`：OutreachComposer.tsx:220（previewVars memo）+ OutreachComposer.tsx:330（doSend perKolVars）+ TemplateWorkspaceClient.tsx 已自然继承 previewVars
- `generateAiAssets.ts:203` userMessage 既有 token 列表追加 `- {{date}} for the current date (formatted as yyyy-mm-dd, e.g. 2026-05-04)`（spec §D1 锚定段）
- `convert-bracket-tokens-to-mustache.ts` 扩展 `BRACKET_TO_MUSTACHE` 加第 5 映射 `[/\[DATE\]/g, "{{date}}"]`（既有 4 不动）；SQL ILIKE 同步加 `OR content::text ILIKE '%[DATE]%'`
- 测试：variable-substitute 加 2 case（{{date}} 替换 + missing date fallback）；convert-bracket 测试既有 (4) 改 [DATE] preserved → converted 行为 + 加 case (5) [DATE]-only asset 转换 + applyMapping 字符串验证含 [DATE]→{{date}}

**验收：** ✅
- variable-substitute.test 6/6 PASS（含 2 新 case）
- convert-bracket 测试 8/8 PASS（含 case 4 [DATE] 修订 + case 5 新增 [DATE]-only）
- TS 编译通过 ＝ 3 调用站全部传 date（本地 `npx tsc --noEmit` 0 errors）
- generateAiAssets prompt 段落字面含 '{{date}} for the current date (formatted as yyyy-mm-dd' 锚定短语
- BL-032 Soft-watch S1 关闭 ✅（[DATE] token 现有 mustache 替换 + backfill 脚本兜底）

### F003：Server-side AI 输出 placeholder validation 兜底（v0.9.9 §3 落地）

**Executor：** generator
**文件：** `src/lib/products/generateAiAssets.ts` / `src/lib/products/__tests__/generateAiAssets.test.ts`
**改动：**
- 新 `AiPlaceholderViolationError extends Error` 类导出（line 95-100，含 name 标记便于 catch 识别）
- 新 `validateNoBracketPlaceholders(parsed)` 内部函数（line 111-128）：
  - `BRACKET_RE = /\[[A-Z][a-zA-Z ]+\]/g`（首字母严格大写，防误伤 marketing 文 [press release] 等小写字面）
  - `MUSTACHE_RE = /\{\{[a-z][a-zA-Z0-9_.]+\}\}/g`
  - per-segment 算法：遍历 emailTemplates + videoScripts subject/body/title/script，每段 `brackets.length>0 && mustaches.length===0` → 抛错（不在全文级检查，避免「全文有 mustache 但本段全 bracket」漏判）
- generateAiAssets 在 `parseAndValidate(raw)` 后立即调 validation（line 246）；不 retry
- catch 路径自然处理：`writeFailure` → `Product.aiAssets.status='failed'` + audit 不走（symptom 与 spec D3 一致）
- 测试 +3 case：(a) bracket-only 抛错，断言 `createAssetCalls.length===0` + `productUpdates[0].data.aiAssets.status='failed'` + error 含 'bracket placeholders' / 'prompt regression'；(b) `[Press Release] + {{kol.name}}` 不误报（per-segment 因 mustache>0），bracket 字面 pass-through 到 Asset.content；(c) 全 mustache 输出 → 5 createAsset + 5 audit + status='ready'

**验收：** ✅
- generateAiAssets.test 14+ case 全绿（含 F003 新 3 case）
- `BRACKET_RE` / `MUSTACHE_RE` 字面与 spec §D3 算法完全对齐
- BL-032 Soft-watch S2 关闭 ✅（v0.9.9 §3 落地，prod 规模触发不再生 bracket-only asset 持久化）

### F004：/assets 页 i18n 完整接入（5 messages 命名空间 + 3 components refactor + 错误码联动）

**Executor：** generator
**文件：** `messages/{en,zh,ja,ko,es}.json` 5 文件 / `src/app/[locale]/(app)/assets/AssetsClient.tsx`（145 t() 调用）/ `_panel/EditTab.tsx`（27 调用）/ `_panel/UsedInTab.tsx`（11 调用）
**改动：**
- 5 messages 文件均加 `assets` 命名空间，schema 含 19 sub-namespace（spec §D4 列 11，Generator 实战补 deleteDialog/drawer/edit/preview/regenerate/sort/usedIn/view 8 项）+ 12 `errors` code（与 actions.ts 返回的 unauthorized/validation/asset_not_found/product_not_found/parent_not_found/ai_config/ai_timeout/ai_response/ai_parse/internal/content_invalid/depth_exceeded 一一对应）
- en + zh 手填地道翻译；ja/ko/es 用 LLM 批量翻译，文件内嵌 `_machineTranslated: "BL-033-F004 machine-translated, awaiting BL-014 human review"`（ja.json:1237 / ko.json:1237 / es.json:1237）
- AssetsClient.tsx 替换 ~60 处硬编码英文（SORT_OPTIONS / TYPE_OPTIONS / STATUS_OPTIONS / SOURCE_OPTIONS labels / setStatusMessage 4 toast / Wizard 三步标题 + 按钮 / aria-label / placeholder / 空状态 / WelcomeBanner / AssetsEmptyState）改用 `useTranslations('assets')` t()
- `localizeErrorCode(t, code, fallback)` helper（line 139）：result.code 命中 KNOWN_ERROR_CODES 时 → `t('errors.${code}')`，否则 fallback；8 处 setStatusMessage / setError / dispatch 调用站全部用此 helper（Q2=B 错误 toast i18n 决策落地）
- EditTab.tsx + UsedInTab.tsx 同步替换硬编码

**验收：** ✅
- 5 messages 文件 `assets` 命名空间结构对齐（top keys 全 19，errors keys 全 12）
- ja/ko/es 三文件均含 `_machineTranslated` 标记；en/zh 无（手填地道翻译策略）
- AssetsClient.tsx：145 t() 调用 / EditTab：27 / UsedInTab：11
- 既有 32 assets/__tests__ action 测试全绿；16 i18n CI 守门测试全绿（CI 守门 fix commit e2c1832：`KOL/AI` 行业惯用词加入 `KEEP_AS_EN_PATHS` allowlist + `productAssetCount` / `summaryMiddle` 用 `{count, plural, one{...} other{...}}` 包裹满足 ICU plural shape parity）
- 不重生 visual baseline（Q4=B 决策遵守）
- 不动 actions.ts 服务端 error message（spec D4 禁动遵守）；不动 generators 内部 prompt（spec D4 禁动遵守）

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| ja/ko/es 翻译质量 | 机器翻译 + `_machineTranslated` 标记 + BL-014 backlog 已含人工审核任务；本批次仅保 fallback 不显 raw key 即可 |
| visual baseline PNG | Q4=B 决策不重生（Checkbox 单 prop 改 + i18n 文字改不影响 layout，本批次 acceptance 也明示不重生） |
| `actions.ts` 服务端 error message | 用户不可见、logs 用；spec §D4 禁动 |
| `generators/email-generator.ts` / `video-script-generator.ts` 内部 prompt | 语言中性；spec §D4 禁动 |
| F003 retry 逻辑 | spec §D3 简化决策，bracket-only 直接 status='failed' 不 retry；v1.0 候选可加 1 次 retry |
| 1 既有 youtube.ts pre-existing 警告 | `'PUBLISHED_AFTER_CORE_REGIONS' is defined but never used` — 与 BL-033 无关，BL-027/B5 历史遗留 |

---

## 预期影响

| 项目 | 改动前 | 改动后（部署 + backfill 后） |
|---|---|---|
| /zh/outreach unchecked checkbox 视觉 | 永远显示 ✓ 字面图标（base-ui keepMounted 错配）| 空白方框 ✓（Indicator return null） |
| `SubstituteVariables` 接口 | 5 字段（kol/product/marketer 嵌套）| 6 字段（+ `date: string` 必填，TS 编译期强约束）|
| Send Test 邮件正文日期 token | `{{date}}` 字面发出（无替换），`[DATE]` 字面发出 | `{{date}}` → 当日 yyyy-mm-dd（如 `2026-05-04`） |
| prod ai_generated email 含 `[DATE]` 行 | 1 行（Clash Royale — Signing invitation，BL-032 backfill 时不动）| 0 行（F002 backfill 脚本扩展第 5 映射后用户 SSH 重跑覆盖）|
| AI bracket-only 输出对 prod 数据的影响 | 持久化 5 行（即使全 bracket）| `Product.aiAssets.status='failed'` + 0 Asset 创建 + audit 不写（F003 兜底）|
| /zh/assets UI 中文化覆盖率 | ~30% (30 t() vs 60+ 英文)| ~95%（145 t() 调用 + 27 + 11 三个文件覆盖；含 toast / Wizard / aria-label / placeholder / 空状态 / 错误信息）|
| /assets 错误 toast 多语言 | 服务端英文 raw 字面 | `t('errors.${code}')` 命中 12 codes 走 i18n；非命中 fallback 服务端英文 |
| messages 5 语言完整性 | en/zh 手填，ja/ko/es 部分缺命名空间 | 5 语言均加 assets 命名空间（en/zh 手填，ja/ko/es 机译标 `_machineTranslated`） |

---

## 类型检查 / CI

```
$ npx prisma generate
✔ Generated Prisma Client (v7.7.0) to ./node_modules/@prisma/client in 108ms

$ npx tsc --noEmit
(0 errors)

$ npm run lint
✖ 1 problem (0 errors, 1 warning)  # 'PUBLISHED_AFTER_CORE_REGIONS' in youtube.ts (pre-existing, BL-033 无关)

$ npm test -- --run
Test Files  118 passed (118)
     Tests  818 passed (818)
   Duration  12.19s

$ gh run list --branch main --limit 5 --json databaseId,headSha,name,conclusion
e2c1832  CI                          conclusion: success  (run 25322699297, 8/8 jobs)
8eed529  CI                          conclusion: failure  (run 25321942649 — i18n 双门触发，下一 commit e2c1832 修复)
c0b3782  Deploy to Production       conclusion: success  (BL-032 prod redeploy run 25317897358)
cc1658d  CI                          conclusion: success  (BL-032 verifying)

$ curl -s https://staging.kol.guangai.ai/api/health
{"status":"healthy","version":"0.1.0","git_sha":"e2c1832","uptime_seconds":992,
 "checks":{"database":{"status":"ok","latency_ms":17},"redis":{"status":"not_used"}}}
```

CI run 25322699297 @ e2c1832 全 8 jobs success：Validate ROLLBACK / Install / Unit tests / Lint / Typecheck / Build+migrate / Integration（Testcontainers） / E2E（Playwright）。

> **本地 tsc 首次跑反映 80 errors（asset model 在 PrismaClient 上找不到）— 根因是本地 Prisma client 长期未重生（BL-030 schema migration 后），不是 BL-033 引入。`npx prisma generate` 后 0 errors，与 CI Typecheck job 一致（CI 流水线含 prisma generate 前置）。**

---

## L2 Staging 验收实录（2026-05-04 ~14:06 UTC）

| 验证项 | 方法 | 结果 |
|---|---|---|
| Staging git_sha == main HEAD | `curl https://staging.kol.guangai.ai/api/health` | `e2c1832` ✓（与 main HEAD 一致）|
| Staging health | 同上 | `status: healthy`，DB latency 17ms ✓ |
| F001 视觉 | 限于 evaluator 本会话边界（无 Stitch 原型对比、本机非 prod 浏览器）| 推迟到 spec §1.1 DoD 中"用户 prod redeploy 后浏览器三验"的步骤 (a)（/zh/outreach KOL 表 unchecked 无 ✓） |
| F002 Send Test 实测 | 同上 | 推迟到 DoD 步骤 (c)（/zh/outreach Send Test 内容含 yyyy-mm-dd） |
| F003 staging 实测 | spec §D3 + Generator handoff 建议 mock fetch 让 AI 返 [Creator] | 推迟到下次必要时执行（unit test 已 3/3 PASS，prod 真 AI 调用历史 5/5 mustache 合规已在 BL-032 L2 实测）|
| F004 中英文切换 | 同上 | 推迟到 DoD 步骤 (b)（/zh/assets 全中文 / /en 全英）|

> **L2 维度本批次仅做 staging 健康度 + git_sha 比对，UI 视觉/交互验证按 spec §1.1 DoD 划归 "用户 prod redeploy 后浏览器三验"，不抢工。这与 BL-031/BL-032 sign-off 中 Reviewer 主动跑 L2 真实交互（aigcgateway 调用、send test）不同 — BL-033 4 features 含 1 视觉 + 1 i18n + 1 prompt-tweak + 1 server-side guard，UI 视觉/交互需要真实浏览器走查（且 prod 用户已锁定 unchecked checkbox 错配症状），用户在 prod 走查比 staging 模拟更直接定向。**

---

## Ops 副作用记录（v0.9.9 — BL-030/BL-031 沉淀）

本批次 Reviewer 阶段无数据库 ops。

> Generator 阶段亦未在 staging/prod 直跑 SQL（F002 backfill 扩展由用户在 prod redeploy 后 SSH 跑 `npx tsx scripts/convert-bracket-tokens-to-mustache.ts --execute`，归 spec §5 部署顺序，不归本批次 Reviewer ops）。

---

## Harness 说明

本批改动经 Harness 状态机完整流程（planning → building → verifying → done）交付。
- `progress.json` 已设为 `status: "done"`，signoff 路径已填入 `docs.signoff`。
- fixing/reverifying 阶段未触发（first-round PASS）。
- `role_assignments` 全程为 null（默认映射 CLI=planner+generator，Codex=evaluator；本会话用户口头指派 CLI 临时担任 evaluator 完成 BL-033 verifying，符合 harness §1.5 "用户直接指派独立任务"边界）。
- 状态机 JSON 文件写入前后均跑 `python3 -c "import json; json.load(open(...))"` 校验（铁律 #11）。
- 所有 commit 前跑 `git diff --cached --name-only` 核对 staged 文件清单（铁律 #12）。

---

## Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | F002 prod backfill 1 行 [DATE] 残留待用户 SSH 跑（spec §5.1 + §1.1 DoD）— 现 staging 已含 [DATE]→{{date}} 5th mapping，但 prod DB 1 行 (Clash Royale — Signing invitation) 仍带 `[DATE]` 字面，需 prod redeploy 后用户跑 `npx tsx scripts/convert-bracket-tokens-to-mustache.ts --execute`（既有 4 映射幂等，仅多处理 1 行）| low | 入项目状态 user 手工待办；DoD 闭环条件 |
| S2 | ja/ko/es 机器翻译质量待 BL-014 人工审核 — 5 messages 文件已加 `_machineTranslated` 标记；i18n CI 守门通过仅证明 placeholder/ICU 形状 + locale-coverage 偏移 OK，不证明翻译质量 | low | 已并入 BL-014 backlog（BL-033 F004 机译产出后回归到此 backlog 项跟进）|
| S3 | F003 staging 真 AI 实测未跑（仅 unit 3/3 case + BL-032 L2 历史 5/5 mustache 合规作为间接证据）— 真 AI 触发 bracket-only 输出的概率（spec §4 风险表 medium-prob）prod 规模有触发可能，验真兜底有效需 prod 后回查 audit_log 中 `asset.generated.failed` 是否含 'placeholder_violation' 类原因 | medium | 入 backlog 单独迷你跟进（与 BL-031/BL-032 共享的 dualWrite/silent-failure 整治 backlog 项合并），prod 规模 N>=1 触发后用 audit log SQL probe 反向证明兜底有效 |

---

## Framework Learnings

### 新规律

- **i18n 命名空间新增的 spec checklist 必须含 "i18n CI ICU plural shape + 行业词 allowlist" 双门检查项** — 来自 Generator session_notes 提案（首推 CI 25321942649 红，i18n-locale-coverage 抓 KOL/AI 行业惯用词在 zh/ja/ko 与 en 字面一致 + i18n-placeholders 抓 productAssetCount/summaryMiddle 在 zh/ja/ko 缺 ICU plural 形状）
  - 来源：BL-014/BL-025 因都已预处理过未触发，BL-033 首次踩双门
  - 建议写入：`framework/harness/planner.md` §UI / i18n 类批次 spec 起草 checklist；或新增独立模板 `framework/harness/i18n-namespace-add-checklist.md`

### 新坑

- **本地 `npx tsc --noEmit` 在 prisma schema migration 后未 `prisma generate` 会出现 80+ "Property 'asset' does not exist on PrismaClient" 误报**（Reviewer 本会话首跑命中），看似 BL-033 引入实际是本地环境状态。`prisma generate` 后立即清空。
  - 来源：BL-033 Reviewer 启动时 80 errors 首跑误判风险
  - 建议写入：`framework/harness/evaluator.md` §L1 本地核查 — "tsc 跑前先确认 prisma client 是否最近重生过；可作为标配前置命令"

### 模板修订

本批次无新增模板修订建议（Soft-watch 章节、L2 端到端记录章节已是 BL-031/BL-032 沉淀形态）。
