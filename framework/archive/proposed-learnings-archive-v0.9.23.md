# Framework Proposed Learnings — v0.9.23 归档

> **沉淀日期：** 2026-05-25
> **沉淀来源：** BL-071-harness-cleanup 5-day phased（A0 audit + A1 12 决策 lock + B 重组 F001-F007 + C 31 条 sediment F008 + D 收尾 F009 + E Reviewer F010）
> **31 条 source：** v0.9.22 archive 13 + BL-069 user-acked 3 + BL-070 user-acked 12 + BL-071 audit §5 缺失 3
> **沉淀模式：** 深度沉淀 — 31 条全文 + framework/harness/*.md 实际段落 inline-merge（~693 LOC 新内容） + CHANGELOG v0.9.23 段 + 本归档
> **用户 ack 时间：** 2026-05-15 / 2026-05-16 / 2026-05-17 / 2026-05-18 / 2026-05-25（各批次 done 阶段 inline ack）
> **关联：** docs/specs/BL-071-harness-cleanup-spec.md / docs/test-reports/BL-071-harness-audit-2026-05-25.md

---

## §1 v0.9.22 archive 13 条（BL-066 + BL-067 + BL-068）

详见 `framework/archive/proposed-learnings-archive-v0.9.22.md` 全文。本归档不重复，仅列写入位置：

| # | 1-line | 写入位置（v0.9.23 实际落地）|
|---|---|---|
| #1 | 批次级多 audit 串联 | `pre-impl-adjudication.md §11` |
| #2 | 量化 verifying gate criterion 设计（语义 vs 字面）| `evaluator.md §13.1` |
| #3 | Generator audit 起草前实测原子组件 surface | `generator.md §12.1` |
| #4 | Next.js 16.x Turbopack BUILD_ID bug + --webpack 防御 | `deploy-patterns.md §7` |
| #5 | InMemoryJobQueue + fire-and-forget + mount self-heal MVP | `generator.md §13` |
| #6 | aigcgateway caller SDK 抽象层 ≥3 重复门槛 | `ai-action-contract.md §5` |
| #7 | Generator 建议命中率作为 audit 质量信号 | `pre-impl-adjudication.md §6.4` |
| #8 | Next.js / 构建器切换 hidden TS errors checklist | `generator.md §12.2` |
| #9 | LLM fix-round 必先 MCP trace 抓真因 | `generator.md §12.3` |
| #10 | LLM 输出 dedupe-then-validate 模式 | `ai-action-contract.md §3.4` |
| #11 | Prompt 自检 § + 末尾 reminder 双层强化 | `ai-action-contract.md §3.5` |
| #12 | mock 不可用三件套（与 BL-070 #21 合并）| `evaluator.md §13.2` |
| #13 | verifying gate 失败优先 trace 真因 | `planner-arbitration.md §P5.3` |

---

## §2 BL-069 user-acked 3 条（2026-05-18）

### #14 middleware IaRedirectRule mixed-status 模式

**类型：** 新规律
**来源：** BL-069 fix-round 1 B1 / Generator + Planner johnsong
**用户 ack：** 2026-05-18

**全文：** middleware IaRedirectRule 加 optional `status` field 模式 — 向后兼容（default 302）+ per-rule override 301，让同一 middleware 实现支持混合 301/302 redirect。BL-069 fix-round 1 案例：BL-064 IA refactor 时全部 redirect 默认 302（开发期保留 rollback 能力），BL-069 spec 要求 KB+Campaigns/new → /brief 用 301 永久。Reviewer L2 验出 302，fix-round 1 修：`IaRedirectRule` interface 加 `status?: 301 | 302` field（default 302），BL-069 3 条 rule 设 status=301，middleware.ts 用 `rule.status ?? 302`，e2e ia-refactor-redirects.spec.ts REDIRECT_CASES 加 status field + `assert response.status()`。

**应用：** 未来 IA refactor 类批次 redirect 设计时，spec 内显式规定 status，middleware 实现端 optional field + default 安全；避免"全 302"或"全 301"硬编码导致 mixed-rule 批次重写。

**写入位置：** `framework/harness/generator.md §10D「IaRedirectRule mixed-status 模式」`

---

### #15 staging-only chaos test env flag + runbook

**类型：** 新规律 / 模板修订
**来源：** BL-069 fix-round 1 B2 / Generator + Planner johnsong
**用户 ack：** 2026-05-18

**全文：** staging-only env flag + runbook 让 Reviewer 可执行受控 chaos test 模式。BL-069 fix-round 1 案例：F002 spec acceptance 含 cap 满 silent fallback 路径，但 Reviewer L2 时发现无 staging-only 模拟入口（dev only 路径用 mock，staging 真实跑需触发真 cap 满即烧真钱）→ Reviewer 标 B2 medium blocker。fix-round 1 修：(1) 加 `BRIEF_FORCE_CAP_EXHAUSTED=true` staging-only env flag（严格 `=== 'true'` 防 typo / audit `forced=true` 字段标记）短路 cap 检查；(2) 写 `docs/dev/bl069-cap-exhausted-simulation-runbook.md`（备份 + tee + pm2 reload + UX 验 + 清理 5 步）；(3) 2 单测（启用 enable / `'yes'` 非严格 regression guard）。

**对比 BL-067 §6 chaos test 模式（改 .env.staging API key）：** 本模式更安全 — 专用 flag 不破坏全 API key；runbook 显式 + 严格 `=== 'true'` 防 typo；audit `forced` 字段让 dashboard 监控可区分真 cap 满 vs 模拟。

**应用：** 所有"chaos/edge case 实测"类 acceptance（cap 满 / network error / 5xx mock）都应用此模式 — spec 内显式规定 staging-only flag + runbook 路径，避免 Reviewer L2 卡壳。

**写入位置：** `framework/harness/evaluator.md §13.3「staging-only env flag + runbook 让 Reviewer 可执行受控 chaos test」`

---

### #16 fix-round 类型分类：A implementation-gap vs B LLM-behavior

**类型：** 新规律 / 反面案例对比
**来源：** BL-068 vs BL-069 fix-rounds 对比 / Planner johnsong
**用户 ack：** 2026-05-18

**全文：** BL-068 fix-rounds=3 vs BL-069 fix-rounds=1 — **数量差 3x，原因 = fix-round 类型不同**。

**类型 A: implementation-gap fix-round**（BL-069 B1+B2）— Generator 实装与 spec 字面有差距（302 vs 301 / 缺 chaos flag），Reviewer L2 报，Generator 直接修代码即可，**1 轮通过**。

**类型 B: LLM-behavior fix-round**（BL-068 B5-B6）— LLM 实际输出与 prompt 预期不一致（凑足 N / 重复 ID），需要 MCP trace 抓真因（v0.9.22 #9）+ server-side fallback（dedupe-then-validate v0.9.22 #10）+ prompt 强化（自检 § v0.9.22 #11），**多 fix-round 才收敛**。

**应用：** Planner 在 Reviewer 报 verifying 失败时先分类（A or B），A 直接 ack Generator 修代码 + 推估 1 fix-round 通过；B 必先 trace（v0.9.22 #13）+ 推估 2-3 fix-round 通过。预期 fix_rounds 数 = 1 + N(B 类 blockers)。

**沉淀价值：** 帮助 Planner 起草 batch 计划时按 LLM 类批次 vs 静态实装类批次区分预期 fix_rounds 数（影响排期 + 用户期望管理）。

**写入位置：** `framework/harness/planner-workflow.md §D12 fix_rounds 计数语义扩展段「fix-round 类型分类」`

---

## §3 BL-070 user-acked 12 条（2026-05-25）

### #17 删显式子路由前必加上游 [id] UUID guard

**类型：** 新坑（扩展 v0.9.21 BL-064-F006 沉淀范围）
**来源：** BL-070-F004 #1 / Generator johnsong
**用户 ack：** 2026-05-25

**全文：** 删 `src/app/[locale]/(app)/campaigns/new/page.tsx` 后 Next.js fallback 到动态 `/campaigns/[id]/page.tsx` → Prisma `findFirst({ id: 'new' })` 抛 `invalid input syntax for type uuid` 500。同 commit 必须给动态 `[id]/page.tsx` 加 `UUID_RE.test(id)` guard 走 `notFound()`。grep 自查：`find src/app -name 'page.tsx' -path '*\[*\]*'` 列动态路由后逐个查是否已有 guard。

**写入位置：** `framework/harness/generator.md §11F「删显式子路由前必加上游 [id] UUID guard 检查清单」`

---

### #18 next-intl + notFound() HTTP status 不可靠

**类型：** 新坑
**来源：** BL-070-F004 #2 / Generator johnsong
**用户 ack：** 2026-05-25

**全文：** Next.js 15 App Router server component `notFound()` 标准是 404，但 next-intl middleware 包装响应后实际 status 可能 surface 为 200 + not-found body。e2e 验路由废弃时不能严格 `expect(status).toBe(404)`，应 `expect(status).toBeOneOf([200, 404])` + 验 Location header 不含错误目的地（或验 page body 含 "not found" 文案 + URL 未变化）。

**写入位置：** `framework/harness/generator.md §11G「next-intl + notFound() HTTP status 不可靠」`

---

### #19 删 i18n deprecated ns 前必须 grep 实际 callers

**类型：** 新坑
**来源：** BL-070-F005 #1 / Generator johnsong
**用户 ack：** 2026-05-25

**全文：** BL-070-F004 git mv 把 KB CRUD 组件搬到 brief/ 但组件内部仍 `useTranslations("knowledgeBase")`。盲信 marker `will delete this namespace` 整 ns 删会破 production。Python 批处理脚本应内嵌该自检：`grep -rln 'useTranslations|getTranslations.*"<ns>"' src/` 0 caller 才能整 ns 删。

**写入位置：** `framework/harness/generator.md §11H「i18n deprecated ns 删除前的 caller-grep 自检」`

---

### #21 e2e server-action mock 不可用 — RSC wire format

**类型：** 新坑
**来源：** BL-070 fix-round 1 #21 / Generator johnsong
**用户 ack：** 2026-05-25

**全文：** BL-070 F006 4 个 refine e2e case 在 mock fired 后 toast 永远 timeout，根因 = Playwright `page.route.fulfill({body: JSON.stringify(...)})` 返 plain JSON 不满足 Next.js RSC wire format → client deserialise throw → catch 走 network toast。任何 body shape filter 都救不了。必须 `test.skip(true, SKIP_*_REASON)` always-skip + unit suite + staging dogfood 覆盖。同 brief-flow.spec.ts cases 3-5 历史 precedent。

**写入位置（合并段）：** `framework/harness/evaluator.md §13.2「mock 不可用三件套：always-skip + unit pure function + staging dogfood」` — 与 v0.9.22 #12 合并为单段含两 source（BL-068 + BL-070 实证）。

---

### #22 prisma migrate dev wrap script — 自动注入 ROLLBACK skeleton

**类型：** 模板修订
**来源：** BL-070 fix-round 1 #22 / Generator johnsong
**用户 ack：** 2026-05-25

**全文：** `prisma migrate dev` 创 migration 不自动加 ROLLBACK 注释，`scripts/validate-rollback-sql.sh` 是后置 CI 检查，触发 CI 红。建议 `prisma migrate dev` wrap script 自动注入 ROLLBACK skeleton（`-- ROLLBACK: <inverse SQL here>`），从生产源头避免 CI 红。

**写入位置：** `framework/harness/generator.md §14.1「prisma migrate dev wrap script — 自动注入 ROLLBACK skeleton」`

---

### #23 Next.js 16 'use server' file-level directive 约束

**类型：** 新坑
**来源：** BL-070 fix-round 1 #23 / Generator johnsong
**用户 ack：** 2026-05-25

**全文：** Next.js 16 `'use server'` file-level directive 禁非 async function exports。在 `'use server'` 文件里加 zod schema/常量/普通对象/类的 export 会触发 build/runtime error。zod schema/常量必须独立到 `schema.ts` / `constants.ts` 等无 `'use server'` 的模块。BL-070 fix-round 1 实证：landing batch 加 `AccessRequestSchema` 到 actions.ts 触发，必须抽到 `src/app/[locale]/request-access/schema.ts`。

**写入位置：** `framework/harness/generator.md §14.2「Next.js 16 'use server' file-level directive 约束清单」`

---

### #24 github-actions[bot] commit 不 cascade CI — workflow_dispatch 通解

**类型：** 模板修订
**来源：** BL-070 fix-round 1 #24 / Generator johnsong
**用户 ack：** 2026-05-25

**全文：** `github-actions[bot]` 默认 `GITHUB_TOKEN` commit 不 cascade CI workflow — 这是 GitHub 默认安全行为（防止 bot commit 触发无限 CI 循环）。`ci.yml` 必加 `workflow_dispatch` trigger 才能在 bot commit 后手动重跑 CI；类似 `deploy-staging.yml` / `deploy-prod.yml` / `update-visual-baselines.yml` 也应检查并加 `workflow_dispatch`。

**写入位置：** `framework/harness/deploy-patterns.md §4.1 扩展段「github-actions[bot] commit cascade CI workflow_dispatch 通解」` — 与 v0.9.6 GITHUB_TOKEN push 不触发下游 workflow 同主题 inline-merge。

---

### #25 perf 量化门槛入 acceptance — 反 retrofit 模式

**类型：** 新规律
**来源：** BL-070 Planner Kimi 反思 / Planner Kimi
**用户 ack：** 2026-05-25

**全文：** 对外上线 ready checklist 中 Lighthouse perf 类硬门槛，必须在 spec 起草阶段就列入 acceptance。本批次 F008 §10 #8 在 batch end-stage（F001-F007 全 done 后）才发现 perf 75-78 < 80 触发 fix-round 2 perf 攻关（+3 features F009/F010/F011 + 2 fix-rounds CI 自修），延期 ~2 day。应用：后续 IA refactor / 重客户端组件类 batch 在 features.json 起草时即把 perf score / TBT / LCP / CLS 量化门槛列为 acceptance，Generator 实装时同步用 `next/dynamic` + `next/image` + Suspense 模式；不要 batch 末尾才 retrofit perf。

**写入位置（合并段）：** `framework/harness/planner-checklists.md §perf 段尾「perf 量化门槛入 acceptance + client/server 分类」` — 与 #26 合并为单段含两 source。

---

### #26 perf acceptance 区分 client vs server 组件

**类型：** 新规律
**来源：** BL-070 fix-round 2 #26 / Generator Kimi
**用户 ack：** 2026-05-25

**全文：** spec perf optimization 类 acceptance 必须分类 client component (chunk-split 靶) vs server async (Suspense 靶)，不该混在一条 `ssr:false` acceptance line 里。BL-070 F009 spec acceptance 列出 reach 5 组件 `ssr:false` 懒载，但其中 4 个（SendingPerformanceChart/RecentRepliesCard/RecentlySentTable/TopTemplatesCard）为 server 组件 — 零 client JS 贡献，不该走 `ssr:false`（违 spec §5 不变量 #5）。实际只 OutreachComposer 走 `ssr:false`，其余 4 个 server 组件的 SSR 延迟由 F011 Suspense 治理。

**写入位置（合并段）：** `framework/harness/planner-checklists.md §perf 段尾` — 与 #25 合并为单段含两 source。

---

### #27 next/image 异构 CDN 落地：unoptimized + explicit dims

**类型：** 新规律
**来源：** BL-070 fix-round 2 #27 / Generator Kimi
**用户 ack：** 2026-05-25

**全文：** 异构 CDN avatar/logo 场景，`unoptimized={true}` + explicit dims 是最稳的 next/image 落地姿势，优于强上 `images.remotePatterns` 累积白名单导致 build error / 运行时 403。多平台 KOL avatar CDN（YT 现；TikTok/Twitch/Bilibili later）远多于 next.config.ts whitelist 能覆盖，`unoptimized` 跳 AVIF/WebP 转换通路但保留 explicit width/height 的 CLS reservation 收益。小尺寸 avatar (32-64px) 优化收益微；大图 (banner 1200×240) 也 unoptimized — 在低流量 detail page 不致命。

**写入位置：** `framework/harness/generator.md §15.1「next/image 异构 CDN 落地：unoptimized + explicit dims」`

---

### #28 lazy boundary 引入时的 fidelity test 同步清单

**类型：** 新坑
**来源：** BL-070 fix-round 2 #28 / Generator Kimi
**用户 ack：** 2026-05-25

**全文：** 引入 lazy boundary 时必须检查并同步老 fidelity test importer 名。BL-070 F009 把 `MatchRefineBar` 改为 `MatchRefineBarLazy` 后，老 `f004-bl068-refine-fidelity` 测试断言 `import { MatchRefineBar } from "./MatchRefineBar"` 失败，必须同步改 2 case，否则 fidelity grep 报误警。

**写入位置：** `framework/harness/generator.md §11I「lazy boundary 引入时的 fidelity test 同步清单」`

---

### #29 Suspense fallback skeleton 像素级镜像（高度）

**类型：** 新规律
**来源：** BL-070 fix-round 3 #29 / Generator Kimi
**用户 ack：** 2026-05-25

**全文：** Suspense fallback skeleton 必须像素级镜像实际 outer 结构，不仅 `glass-panel + animate-pulse` 视觉。skeleton 高度差异会按下游 shifted 内容总高度（本批 1039px 高的主网格）放大 CLS 评分。本次 88px → 150px 的 62px 反差直接造成 `/match` 0.348 CLS 评分。修复 = skeleton 重写为同 grid + 4×150px 卡槽，CLS 跌至 0.008。**关联反思：** F011 Suspense PR push 前未做 Lighthouse 本地 dry-run → Reviewer fix-round 2 才捕 CLS → 沉淀：Suspense 落地必配 Lighthouse Desktop logged-in 自测。

**写入位置（合并段两 source）：** `framework/harness/generator.md §15.2「Suspense fallback 规范」(A) 高度镜像段`

---

### #30 Suspense fallback 宽度等宽（flex-wrap 父容器）+ Lighthouse cls-culprits-insight 定位法

**类型：** 新规律
**来源：** BL-070 fix-round 3 #30 / Generator Kimi
**用户 ack：** 2026-05-25

**全文：** Suspense fallback 宽度在 `flex-wrap` 父容器下必须与实际等宽（或更宽），否则 swap 时横向 reflow 触发换行 → 横向 reflow 间接放大垂直 CLS 评分。本次 `SaveSearchControlsSkeleton` 从 `w-44`（~176px）改为 ~460px 等宽 SaveSearchControls 实际渲染宽度，消除 flex-wrap header 横向 reflow。**Lighthouse 13.x audit 定位工具：** `cls-culprits-insight` 在 JSON 输出 path = `details.items[].node.selector + snippet + boundingRect` — 比 `layout-shift-elements` 更准确直指 shift target，后续优化 perf 优先 grep 此键。

**写入位置（合并段两 source）：** `framework/harness/generator.md §15.2「Suspense fallback 规范」(B) 宽度等宽段 + Lighthouse cls-culprits-insight 定位法`

**合并段决策（per D7 inline-merge）：** #29 + #30 同主题（Suspense fallback skeleton 规范）合并为 §15.2 单段含两 source（高度镜像 + 宽度等宽），保留两条 source 信息便于追溯。

---

## §4 BL-071 audit §5 缺失 3 条（BL-071 audit 起草发现）

### audit §5.1 staging deploy 前置 git pull --ff-only 硬要求

**类型：** 模板修订
**来源：** BL-071 audit §5 缺失（5/25 audit 深读发现实践已成形但 framework 未明示）
**用户 ack：** 5/25 12 决策 lock 同期 ack

**全文：** BL-070 BL-069 等批次实战已确立"staging deploy 第一步必跑 `git pull --ff-only origin main`"作硬要求 — 远端可能在本地 generator 推 commit 后又被其他 agent 推 chore/state，本地 staging 路径若不 pull 则 build 出来的 git_sha 落后 main HEAD，切 verifying 时 Reviewer SHA 对齐 fail 触发死循环。但 framework deploy-patterns.md §3.2 step 2 未明示此硬要求理由（仅 `git pull --ff-only origin main` 没注释为何必跑），audit §5.1 标缺失。

**写入位置：** `framework/harness/deploy-patterns.md §3.2 step 2 注释补全`（D7 inline-merge — 修订段内文字，加 `⚠️ git pull --ff-only 是硬要求` + 失败案例链接到 §3.4）

---

### audit §5.2 session_notes 写作惯例

**类型：** 模板修订
**来源：** BL-071 audit §5 缺失
**用户 ack：** 5/25 12 决策 lock 同期 ack

**全文：** BL-070 fix-round 1-4 实战已形成 session_notes 写作约定：(1) 顶部一行 `[YYYY-MM-DD HH:MM TZ Role agent-id — 一句话标题]`；(2) 覆盖不追加；(3) 段落建议 "本次完成" / "决策点" / "踩到的坑" / "下一步"；(4) 禁忌：不写 todo / 不写 commit 摘要 / 不写设计决策。但 framework harness-rules.md §5b 仅说"覆盖写自己的条目"，audit §5.2 标缺失格式 / 段落建议 / 禁忌细则。

**写入位置：** `framework/harness/planner-workflow.md §5b 补全段「session_notes 写作惯例」` — D8 inline-merge 入 planner-workflow.md 现有 §5b。

---

### audit §5.3 commit message 格式规范 + 铁律 #10 commit-tag 一致性

**类型：** 模板修订
**来源：** BL-071 audit §5 缺失
**用户 ack：** 5/25 12 决策 lock 同期 ack

**全文：** BL-066-BL-070 各批次 commit message 已稳定使用 `<type>(<batch>-F<num>): <一句话>` 格式 + 多段 body，但 framework 未明文规范。audit §5.3 缺失：type 取值清单 / body 三段建议 / 禁忌（不写 attribution / 不写 progress 性内容）/ 与铁律 #10 commit-tag 一致性的关系。

**写入位置：** `framework/harness/planner-workflow.md §commit message 格式规范` — 新增独立段，明示与铁律 #10 commit-tag 一致性的关系。

---

## §5 11 项结构变更 detailed before/after（D1-D12 lock）

### D1：framework/harness/harness-rules.md 双副本漂移修复

**Before：** framework/harness/harness-rules.md 与项目根 harness-rules.md 内容漂移（前者缺铁律 #12，铁律 #11 含项目特定 commit hash b44b79d）。无 banner 说明 template 性质。

**After：**
- 顶部加 `<!-- TEMPLATE FILE -->` banner 说明：agent 运行时只读项目根 harness-rules.md，本文件不参与运行时加载；新铁律演进路径 4 步
- 同步铁律 #12（git diff --cached 验 staged）抽象版（去 commit hash）
- 铁律 #11 同步抽象化（去 commit b44b79d 引用，保留"实战曾出现 N 小时未发现"通用原则）
- 防漂移流程见 framework/README.md §「新规则演进流程」

**Decision lock 引用：** BL-071 spec §1.2 D1 = B 保 framework/harness/harness-rules.md 原名 + 顶部 banner + 同步内容 + framework/README.md 加防漂移流程

---

### D2：framework/memory/ 5 文件 banner

**Before：** framework/memory/MEMORY.md / project-status.md / environment.md / user-role.md / reference-docs.md 5 文件无 banner，bootstrap 后维护者不知道这是 template，可能误改 framework/memory/ 当 agent 运行时记忆。

**After：** 5 文件顶部加 `<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh — agent 运行时读 .auto-memory/<file>，本文件不参与运行时加载 -->` HTML 注释 banner。

**Decision lock 引用：** BL-071 spec §1.2 D2 = B 保原名 + README banner + 每文件顶部 frontmatter

---

### D3：cowork 死文档全清

**Before：**
- framework/cowork-constraint-design.md 整文件 90 LOC（早期 Cowork = Claude Desktop 时代设计决策，文档自述 "Cowork 不再参与"已与现实脱节）
- framework/bootstrap.sh line 100 防御性 mv 引用 cowork-constraint-design.md
- framework/README.md line 88-95 §「历史说明」段提及 cowork
- .auto-memory/project-status.md A1 lock 描述含 "D3 cowork 全清" 字样

**After：**
- git rm framework/cowork-constraint-design.md（保 git history）
- 删 bootstrap.sh line 100 防御性 mv 整行
- 删 README.md §「历史说明」段（cowork 历史交给 CHANGELOG v0.7.0 + framework/archive/proposed-learnings-archive-v0.5.md 承担）
- 改 .auto-memory/project-status.md "D3 cowork 全清" → "D3 死文档全清"（避免活规则 grep 命中）
- grep -i cowork 仅命中 3 历史保留（framework/CHANGELOG.md + framework/archive/proposed-learnings-archive-v0.5.md + docs/specs/BL-071-harness-cleanup-spec.md）

**Decision lock 引用：** BL-071 spec §1.2 D3 = 全清

---

### D4：planner.md 拆 3 文件

**Before：** framework/harness/planner.md 625 LOC 单文件混合 3 类内容（启动流程 / Pre-impl 裁决 / spec 起草 checklist）超出易读阈值。

**After：**
- 拆为 4 文件：planner-workflow.md（217 LOC）+ planner-arbitration.md（160 LOC）+ planner-checklists.md（321 LOC）+ planner.md（24 LOC 索引页）
- 原 planner.md 改为索引页指 3 子文件 + 拆分背景说明
- 同步 .auto-memory/role-context/planner.md cross-ref + framework/harness/{pre-impl-adjudication, evaluator, generator, ui-fidelity-guardrail}.md 内部 cross-ref 改指新文件
- git tag bl071-before-planner-restructure 留 rollback 锚点

**Decision lock 引用：** BL-071 spec §1.2 D4 = B 3 文件拆分

---

### D5：evaluator.md 按 topic 重组

**Before：** framework/harness/evaluator.md 432 LOC 含 §10-§20 11 段时间序（chronological-append §N，反 v0.9.23 D7 lock 后强制规则），§3 §4 §7 编号撞车。

**After：**
- §1-§9 核心 workflow 编号撞车清理
- §10 L1 验收前置：prisma generate + .nvmrc + lint warnings 矩阵
- §11 L2 验收手段：fire-and-forget audit + E2E suite + SQL RLS + 手动角色探针 + 字体子集 spot check
- §12 验收口径：SHA 对齐 chore-only 容许 + Smoke checklist 文本陈旧 + 首轮 PASS 硬条件
- §13 测试设计（F008 补全：量化 criterion + mock 不可用三件套 + staging chaos test）
- 11 段原 sediment 全保留无内容丢失，每条在新结构能找到归宿
- git tag bl071-before-evaluator-restructure 留 rollback 锚点

**Decision lock 引用：** BL-071 spec §1.2 D5 = B 按 topic 重组单文件

---

### D6：scope tag frontmatter

**Before：** framework/harness/*.md 无 scope 标注，未来复用时无法筛选哪些可整文件 cp / 哪些需人工改造。

**After：** 14 文件全加 YAML frontmatter scope tag：
- framework-generic（10 个）：harness-rules / planner / planner-workflow / planner-arbitration / planner-checklists / generator / evaluator / pre-impl-adjudication / ai-action-contract / ui-fidelity-guardrail
- mixed（2 个）：deploy-patterns（project-specific-sections: §1.6 §1.7 §3.2 §5.1）/ database-patterns（project-specific-sections: §2）
- project-specific（2 个）：checklists/material-symbols-pattern + checklists/i18n-namespace-add-checklist
- framework/README.md 新增 §「scope tag 用法说明」段 28 LOC

**Decision lock 引用：** BL-071 spec §1.2 D6 = A frontmatter scope tag

---

### D7：sediment inline-merge 强制规则

**Before：** sediment 写入框架时多用 chronological-append `## §N. 新规律 X` 时间序追加（如 evaluator.md §10-§20 即此模式），结果 framework/harness/*.md 越长越散，跨多批次的同主题规则不收敛。

**After：** framework/proposed-learnings.md 顶部新增 §「写入流程」段 69 LOC，含 4 步流程（propose → ack → inline-merge → archive）+ D7 强制规则（禁 chronological-append §N，优先级：合并矩阵行 → 加子段 → 修订段内文字 → 开新 topic 最后手段）+ sediment 类型分类 + 写入位置决策树。

**首次实战示范：** deploy-patterns.md §1.7（PM2 reload 不重读 .env）合并 inline-merge 到 §1.6（env_file anti-pattern）同主题段。

**Decision lock 引用：** BL-071 spec §1.2 D7 = A 强制 inline-merge

---

### D8：sediment workflow doc 入 proposed-learnings.md header

**Before：** sediment workflow 散落在 generator.md §7 + evaluator.md §9 + planner.md done 收尾 §2 三处，无统一入口。

**After：** framework/proposed-learnings.md 顶部 §「写入流程」段（D7 lock 配套）单一入口，详细 4 步流程 + 类型分类 + 决策树。

**Decision lock 引用：** BL-071 spec §1.2 D8 = B 合并入 proposed-learnings.md header

---

### D9：3 层入口 banner + 新规则演进流程

**Before：** framework/README.md 无 banner 说明三层入口（CLAUDE.md → harness-rules.md → .auto-memory/），新维护者可能误以为 agent 运行时读 framework/。无新规则演进流程文档化。

**After：**
- framework/README.md 顶部加 banner：agent 运行时读项目根 CLAUDE.md / harness-rules.md / .auto-memory/，不读 framework/
- 新增 §「新规则演进流程（防漂移）」段 21 LOC：4 步（落地 → 评估 → 回流 → 登记）+ 3 禁忌 + 回流粒度提示

**Decision lock 引用：** BL-071 spec §1.2 D9 = A 保 3 层 + banner

---

### D10：checklists/ subdir

**Before：** framework/harness/material-symbols-pattern.md（98 LOC）+ i18n-namespace-add-checklist.md（121 LOC）项目特定 case checklist 与顶层通用文件（planner / generator / evaluator）混排，未来复用时层级不清。

**After：**
- 新建 framework/harness/checklists/ subdir
- git mv 2 文件到 subdir（保 git history）
- framework/README.md 新增 §「checklists subdir 用法」段 19 LOC：分层逻辑 + 新增 checklist 决策树 + bootstrap.sh 同步说明 + 当前内容快照
- planner-checklists.md / evaluator.md 内部 cross-ref 提前预指向 checklists/ 新路径（F003 + F004 时落地）

**Decision lock 引用：** BL-071 spec §1.2 D10 = B 移 checklists/ subdir

---

### D11：5-day phased 全做

**Before：** 用户选项有 (A) 全做 5-day + (B) 拆 BL-072 分批。

**After：** 用户 ack 选 A — A0 audit + A1 lock + B 重组 F001-F007 + C sediment F008 + D 收尾 F009 + E Reviewer F010 一气呵成。

**Decision lock 引用：** BL-071 spec §1.2 D11 = A 全做 5-day phased

---

### D12：fix_rounds 计数语义

**Before：** fix_rounds 字段在 harness-rules.md / planner.md 多处提及但无明确语义定义，实战中存在歧义（按 commit 数 vs 按 reverifying 入口数）。

**After：** planner-workflow.md 新增 §「阶段转换 + fix_rounds 计数语义」段 含明确定义表（5 个状态转换事件 fix_rounds 动作）+ BL-070 反例（commit 数 6+ vs 实际 reverifying 入口数 4）+ latent bug exposure 二维统计扩展 + fix-round 类型分类 A vs B（F008 sediment 入）。

**Decision lock 引用：** BL-071 spec §1.2 D12 = B fix_rounds 计数语义入 planner-workflow.md

---

## §6 framework/harness/* 沉淀状态（v0.9.23 最终）

| 文件 | LOC（vs 拆分前）| 新内容 |
|---|---|---|
| harness-rules.md | 359（+8 banner + 铁律 #12）| F001：banner + 铁律 #12 抽象版 |
| planner.md | 24 索引页（拆前 625）| F003：拆 3 文件 + 索引页 |
| planner-workflow.md | 285（新建）| F003 + F008：§D12 fix-round 计数 + fix-round 类型 + §5b session_notes + §commit |
| planner-arbitration.md | 199（新建）| F003 + F008：Pre-impl P1-P5 + Generator 越界界定 + §P5.3 verifying trace |
| planner-checklists.md | 376（新建）| F003 + F008：7 铁律 + spec 起草 checklist + §perf 合并段 |
| generator.md | 586（+233 sediment）| F008：§10D + §11 F-I + §12-§15 共 6 顶段 + 4 子段 |
| evaluator.md | 464（重组后，原 432）| F004 重组 + F008：§13 测试设计 3 子段（量化 + mock + chaos）|
| pre-impl-adjudication.md | 425（+12 编号 + 50 新段）| F007 + F008：§6.4 命中率 + §11 多 audit 串联 |
| deploy-patterns.md | 504（+47 #4 Turbopack + #24 bot + §3.2 注释）| F007 + F008：§3.2 git pull 注释 + §4.1 扩展 + §6 编号 + §7 Turbopack |
| ai-action-contract.md | 484（+137 #6 #10 #11）| F008：§3.4 dedupe + §3.5 prompt 自检 + §5 SDK |
| database-patterns.md | 395（+3 frontmatter）| F005：scope mixed + §2 project-specific |
| ui-fidelity-guardrail.md | 200（+4 frontmatter）| F005：scope framework-generic |
| checklists/material-symbols-pattern.md | 102（+4 frontmatter）| F005 + F006：scope project-specific + git mv |
| checklists/i18n-namespace-add-checklist.md | 125（+4 frontmatter）| F005 + F006：scope project-specific + git mv |
| **合计** | **4530 LOC**（+ ~700 LOC sediment + 230 LOC 重组 / cleanup） | |

---

## References

- `framework/CHANGELOG.md` v0.9.23 段（31 条 1-line summary + 11 结构变更 + 编号修 + cowork 清理）
- `framework/proposed-learnings.md` v0.9.23 沉淀完成 marker
- `docs/specs/BL-071-harness-cleanup-spec.md` （520 LOC spec + 12 决策点 D1-D12 + 10 features F001-F010）
- `docs/test-reports/BL-071-harness-audit-2026-05-25.md` （Phase A0 426 LOC 深度审计 + 5 结构问题）
- BL-066 done commit `46e803a`（v0.9.22 3 条来源 — 在 v0.9.22 archive）
- BL-067 done commit `472f650`（v0.9.22 5 条来源 — 在 v0.9.22 archive）
- BL-068 done commit `a204556`（v0.9.22 5 条来源 — 在 v0.9.22 archive）
- BL-069 fix-round 1 commit（3 条来源 BL-069 #14 #15 #16 — 在本归档 §2）
- BL-070 fix-round 1-3 commits（12 条来源 BL-070 #17-30 — 在本归档 §3）
- BL-071 audit doc 2026-05-25（3 条 audit §5 缺失 — 在本归档 §4）
- git tag bl071-before-planner-restructure（F003 rollback 锚点）
- git tag bl071-before-evaluator-restructure（F004 rollback 锚点）
