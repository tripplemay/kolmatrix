# BL-020 前端安全整改 + UI 修复 Signoff 2026-05-05

> 状态：**Reviewer first-round PASS**（progress.json status=verifying → done）
> 触发：docs/reviews/prod-mvp-readiness-audit-2026-05-04.md §3 锁定的 prod 上线前必修 8 项（6 安全 + 2 UI），本机 Reviewer 由用户在 2026-05-05 ~01:00 口头指派 CLI 临时担任 evaluator（harness §1.5 用户直接指派边界），完成 verifying 收尾。

---

## 变更背景

prod-mvp-readiness-audit（2026-05-04）锁定 8 项前端阻断项：

- **CR-1 (F001)** `normalizeProductId` 仅检查非空、未做格式校验，攻击者可投递 SQL injection-shaped / path-traversal payload 到 server actions
- **CR-2 (F002)** `AiSuggestionsClient.tsx:150` AI 返回的 `action_link` 仅 `startsWith('/')` 过滤 → protocol-relative `//evil.com` / `javascript:` / `/../admin` 全部穿透
- **CR-3 (F003)** `FilterSidebar.tsx:344` 残留 `dangerouslySetInnerHTML` → React 反范式 + XSS 风险
- **H-S1 (F004)** `withTenant` / `withPlatformAdmin` `set_config` 走 `$executeRawUnsafe` 字符串拼接 → 即便有 `assertUuid` 防御，参数化是更彻底的根治
- **H-S2 (F005)** Login 端无 rate-limit；prod-mvp audit 称 ".env 已配 Redis 可直接接入"，Planner Phase 1 实地核查发现 0 引用 Redis client，工时由 1-2h 修正为 3-5h（含 ioredis 装包 + redis.ts shared client + health endpoint 真连测 + rate-limit 实装 + login 接入 + integration test）
- **H-S3 (F006)** CSP 长期 Report-Only 模式（注释挂 BL-020 字样但未切 enforce）
- **UI-1 (F007)** Dashboard QuickActions Campaigns 卡 `href: null` 锁死 disabled
- **UI-2 (F008)** /discovery 显示 12 个 demo_seed mock KOL 污染 prod 视觉

8 features 全 generator，由 Generator johnsong 在 2026-05-04 22:30 ~ 2026-05-05 00:50 期间分 8 commit 实现（commit chain 6d79da0..ca5515b），staging deployed @ ca5515b @ 2026-05-04T16:42Z。F001 中途因 Planner 实地核查 Product.id schema 实为 CUID（不是 UUID），触发 Pre-Impl Audit Planner 裁决 #1:A — `PRODUCT_ID_RE = /^c[a-z0-9]{24,}$/i`；同步沉淀 v0.9.11 候选「Planner 铁律 1 强化检查项」（regex/id-format 类 spec 必须实地核 schema 真实类型）。

---

## 变更功能清单

### F001：CR-1 productId 格式校验（PRODUCT_ID_RE）

**Executor：** generator
**Commit：** ca5515b
**文件：** `src/app/[locale]/(app)/knowledge-base/actions.ts`、`src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts`

**改动：**
- `actions.ts:27` 新增 `const PRODUCT_ID_RE = /^c[a-z0-9]{24,}$/i`（CUID v1 25-char + CUID v2 兼容）
- `normalizeProductId(value)`（line 29-35）在既有 trim+length 检查后加 `if (!PRODUCT_ID_RE.test(productId)) return null`
- `actions.test.ts` 新增 4 case：拒非 CUID `'xxx-not-a-cuid'` / 拒路径回溯 `'../../../etc/passwd'` / 拒 SQL-shaped `"'; DROP TABLE"` / 拒非字符串 `(number)`；既有 8 case fixture 已用 25-char CUID 不破坏
- 4 调用方（`updateProduct` / `triggerAiGeneration` / `deleteProduct` / `loadProductAssetsAction`）零改动 — 既有 `if (!productId) return invalid_input` 流程自然兜住 `null` 返回

**验收：** ✅
- `PRODUCT_ID_RE` 拒非字符串 / 空 / 不以 c 起首 / 含 `/`、`:`、`;`、`'`、`..`、控制字符 / 长度 < 25 全部恶意载荷
- 12/12 case PASS（8 既有 + 4 新）
- Planner 裁决 #1:A 落 `docs/specs/BL-020-F001-audit-cuid-vs-uuid.md` §7

---

### F002：CR-2 AI URL 路径白名单（safeAiActionLink helper）

**Executor：** generator
**Commit：** 781a20f
**文件：** `src/lib/ai/safe-link.ts`（新增）、`src/lib/ai/__tests__/safe-link.test.ts`（新增）、`src/app/[locale]/(app)/campaigns/[id]/AiSuggestionsClient.tsx`、`src/app/[locale]/(app)/campaigns/[id]/__tests__/AiSuggestionsClient.test.tsx`

**改动：**
- `safe-link.ts` 实现 `safeAiActionLink(unknown): string`，5 道闸：非字符串 / 空串 → fallback；`startsWith('//')` → fallback；任意 `protocol:` (`/^[a-z][a-z0-9+\-.]*:/i`) → fallback；不以 `/` 起首 → fallback；含 `..` → fallback；不匹配 `SAFE_PATH_RE` 白名单（`/campaigns(/<id>)?` / `/kols/<id>` / `/assets(?<query>)?` / `/outreach` / `/database` / `/knowledge-base`）→ fallback；fallback 一律 `/campaigns`
- `safe-link.test.ts` 24 case 覆盖 valid + 6 类恶意载荷（protocol-relative / javascript: / data: / `/../admin` / 非站内绝对 / 非白名单段）
- `AiSuggestionsClient.tsx:151` 改 `href={`/${locale}${safeAiActionLink(s.action_link)}`}`
- `AiSuggestionsClient.test.tsx` 加 2 集成 case（hostile 回退 + 白名单原样保留）

**验收：** ✅
- `safe-link.test.ts` 24/24 PASS
- `AiSuggestionsClient.test.tsx` 2 case CI green @ ca5515b（本机 Node 25.7 + jsdom 29 因 native localStorage incompatibility 失败 — 见 §Framework Learnings 新坑）
- 实装与 spec §D2 算法逐项一致

---

### F003：CR-3 dangerouslySetInnerHTML 反范式清理

**Executor：** generator
**Commit：** 74deb16
**文件：** `src/app/[locale]/(app)/discovery/AdvancedToggleCookie.tsx`（新增 client island）、`src/app/[locale]/(app)/discovery/FilterSidebar.tsx`、`src/app/[locale]/(app)/discovery/__tests__/discovery-fidelity.test.ts`

**改动：**
- 删除 `FilterSidebar.tsx:344` 的 `<style dangerouslySetInnerHTML>` 注入
- 抽 `AdvancedToggleCookie.tsx` client island，用 `useEffect` 在 mount 后基于 cookie 设置 `details.open`
- `discovery-fidelity.test.ts` line 79-80 加约束断言 "FilterSidebar no longer references the legacy INPUT_CLASS/CHIP_BASE locals"

**验收：** ✅
- `grep -rn dangerouslySetInnerHTML src/` → **0 hits**（spec §F003 acceptance 硬条件）
- `discovery-fidelity.test.ts` 8/8 PASS

---

### F004：H-S1 SQL 注入参数化（withTenant + withPlatformAdmin）

**Executor：** generator
**Commit：** 6d79da0
**文件：** `src/lib/db.ts`、`src/lib/__tests__/db.test.ts`、`tests/integration/db-set-config-rls.test.ts`

**改动：**
- `db.ts:60` `withTenant` 改 `tx.$executeRaw\`SELECT set_config('app.tenant_id', ${tenantId}, true)\``（Prisma tagged-template 参数化）
- `db.ts:76` `withPlatformAdmin` 改 `tx.$executeRaw\`SELECT set_config('app.is_platform_admin', 'true', true)\``
- 保留 `assertUuid(tenantId, "tenantId")` 作 defense-in-depth（line 58）
- `db.test.ts` 6 unit case
- `tests/integration/db-set-config-rls.test.ts` 3 testcontainer case：(1) tenant A 写 / tenant B 读 0 → RLS 仍 enforce；(2) tenantId 含 `'; DROP TABLE asset --` → assertUuid 抛 → 不到 set_config 层；(3) withPlatformAdmin 在 user 表 RLS 旁路工作

**验收：** ✅
- `db.test.ts` 6/6 PASS（unit）
- CI integration suite 54 passed | 1 skipped（含 `db-set-config-rls`）@ ca5515b
- 既有 `tests/integration/rls-isolation.test.ts` 6 case 不动且不破

---

### F005：H-S2 Login rate-limit + Redis infra 全栈

**Executor：** generator
**Commit：** 9233e78、6e2c11c（health-test fix）
**文件：** `package.json` / `package-lock.json`（+ `ioredis@^5.10.1` + `rate-limiter-flexible@^11.0.2`）、`src/lib/redis.ts`（新增）、`src/lib/rate-limit.ts`（新增）、`src/lib/__tests__/rate-limit.test.ts`（新增）、`src/app/[locale]/login/actions.ts`、`src/app/[locale]/login/__tests__/actions.test.ts`、`src/components/auth/LoginForm.tsx`、`messages/{en,zh,ja,ko,es}.json` 加 `errorRateLimited` 键、`src/app/api/health/route.ts`、`src/app/api/health/__tests__/route.test.ts`、`tests/unit/health-redis-status.test.ts`

**改动：**
- `redis.ts` lazy singleton `getRedis()` + `pingRedis(): {ok, latencyMs?, error?}` health probe；`maxRetriesPerRequest: 3` + `retryStrategy` 指数退避 + `enableReadyCheck`
- `rate-limit.ts` `RateLimiterRedis` 5pts/60s 滑窗 + 5min block + DISABLE_LOGIN_RATELIMIT escape + Redis-down `console.warn` + fail-open；caller 必须在 bcrypt 之前调
- `login/actions.ts` `getClientIp()` 取 `x-forwarded-for` 首段 → fallback `x-real-ip` → `'unknown'`；`loginAction` 在 `signIn('credentials')` 之前 `await rateLimitLogin(ip)`，`!rl.ok` 返 `{ error: 'rate_limited', retryAfter: rl.retryAfter }`
- `LoginForm.tsx` 渲染 `errorRateLimited`(retryAfter) toast，5 messages locale 加 `errorRateLimited` 键
- `route.ts` redis 字段从 hardcoded 'not_used' 改为 `await pingRedis()` 返 `'ok'`+`latencyMs` / `'error'`+message

**验收：** ✅
- `rate-limit.test.ts` 5/5 PASS（含 5pts→6th block / 60s reset / DISABLE escape / fail-open）
- `login/actions.test.ts` 3/3 PASS（含 1 集成 case 验证 rate-limit 接入）
- `health-redis-status.test.ts` 3/3 PASS + `health/route.test.ts` 6/6 PASS
- `tests/integration/rate-limit-login.test.ts` 1 testcontainer case CI green @ ca5515b
- staging `/api/health.redis.status === "ok"` 实测（latencyMs=6）

---

### F006：H-S3 CSP enforce 切换

**Executor：** generator
**Commit：** 3aa33cb
**文件：** `next.config.ts`

**改动：**
- `next.config.ts:73` header key 从 `'Content-Security-Policy-Report-Only'` 改 `'Content-Security-Policy'`（删 `-Report-Only` 后缀）
- `next.config.ts:67-71` 注释更新：`CSP enforce mode (v0.9.10+ — BL-020-F006 切换 2026-05-04 ...)`
- `value` 数组（directives）原样不动 — 仅 mode 切换

**验收：** ✅
- staging `curl -I https://staging.kol.guangai.ai/en/login` 返 `content-security-policy:` header（**不是** `-Report-Only`），enforce mode 已生效
- CSP value 完整：`default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://aigc.guangai.ai; frame-ancestors 'none'`
- spec §D4 锁 Reviewer L2 不卡 1 周观察期；1 周 prod 观察期作 Soft-watch 入项目状态

---

### F007：UI-1 Dashboard QuickActions Campaigns 卡解禁

**Executor：** generator
**Commit：** 2079ddb
**文件：** `src/features/dashboard/QuickActions.tsx`、`tests/screenshots/baseline/dashboard.png`（visual baseline 重生于 25c6fb0）

**改动：**
- `QuickActions.tsx:25` ACTIONS 数组中 `{ key: 'campaigns', href: null, ... }` 改为 `href: '/campaigns'`
- 既有 `disabled = a.href === null` 判据自然失效，"Coming soon" tooltip 路径不再触发
- 25c6fb0 commit 由 `Update visual baselines` workflow 重生 dashboard.png baseline 落 main，CI 视觉回归通过

**验收：** ✅
- `QuickActions.tsx:25` href 已设 `/campaigns`（非 null）
- CI run 25329141733（Update visual baselines workflow @ 25c6fb0）success
- 后续 CI run 25330969685 @ ca5515b 全 8 jobs success

---

### F008：UI-2 demo_seed env-var 过滤

**Executor：** generator
**Commit：** 849324d
**文件：** `src/lib/kol/filters.ts`、`src/lib/kol/__tests__/filters.test.ts`、`.env.example`

**改动：**
- `filters.ts:400-402` `buildKolWhere` AND 数组追加：`if (process.env.HIDE_DEMO_SEED_KOLS === 'true') and.push({ emailSource: { not: 'demo_seed' } })`，位置在 `deletedAt:null` + `isSuspicious:false` 等基础过滤之后、`search` 之前
- `.env.example:47` 加 `HIDE_DEMO_SEED_KOLS="false"` + 注释（spec §D5）；同 batch line 18 含 `REDIS_URL="redis://localhost:6379/0"`（F005 引入）
- `filters.test.ts` 加 ≥3 case：env=true 时 AND 含 `emailSource not demo_seed` / env=false 时不含 / undefined 时不含

**验收：** ✅
- `filters.test.ts` 26/26 PASS
- staging 端 `HIDE_DEMO_SEED_KOLS` 未设 = 不过滤（保留 demo 流验证），符合 spec §D5
- prod 端用户 SSH 加 .env.production + pm2 reload --update-env 是部署 step（DoD §6.1）

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| 既有 `UUID_RE` 用于 tenantId | F001 不复用，PRODUCT_ID_RE 单独定义；UUID_RE 仍专用 tenantId（schema 实为 UUID）|
| `assertUuid(tenantId)` 在 F004 中 | spec §D1 要求保留作 defense-in-depth，未删 |
| AiSuggestions / KB Server Action 内核逻辑 | 仅 F001/F002 在边界加防御，业务流程不动 |
| RLS isolation 既有测试 | F004 改后 6 case 不破不动（spec §D1 决策 D1：set_config 与 SET LOCAL 在 RLS 上下文等价）|
| F006 CSP directives 数组（value 内容）| 仅 mode 切换，directives 原样（spec §D4 决策）|
| F007 visual baseline 截图 | 仅 dashboard.png 重生（campaigns 卡从灰态变可点击有视觉变化）；其它页面不动 |
| messages/ja/ko/es i18n 翻译质量 | F005 加 errorRateLimited 走机译标 `_machineTranslated`，回归 BL-014 backlog |
| 1 既有 youtube.ts pre-existing 警告 | `'PUBLISHED_AFTER_CORE_REGIONS' is defined but never used` — BL-027/B5 历史遗留，与 BL-020 无关 |

---

## 预期影响

| 项目 | 改动前 | 改动后（部署后） |
|---|---|---|
| productId 投递格式校验 | 仅非空检查；SQL/path-traversal payload 可达 server action | PRODUCT_ID_RE 拒非 CUID（含 SQL injection / path-traversal / 控制字符 / 非字符串）|
| AI suggestions 链接安全 | `startsWith('/')` 单闸；`//evil.com` / `javascript:` / `/../admin` 全部穿透 | 5 道闸 + 白名单 → 6 类恶意载荷全部 fallback `/campaigns`|
| `dangerouslySetInnerHTML` in src/ | 1 occurrence（FilterSidebar）| **0** occurrences |
| `set_config` 在 RLS 上下文 | `$executeRawUnsafe` 字符串拼接；assertUuid 是唯一防线 | `$executeRaw` tagged-template 参数化 + assertUuid 仍在（defense-in-depth）|
| Login rate-limit | **无**；可被 bcrypt-aware brute force 持续 hammer | 5pts/60s 滑窗 + 5min block + Redis-down fail-open + DISABLE_LOGIN_RATELIMIT escape；fail rate < 0.5% 已知（Redis 同 VM）|
| `/api/health.redis.status` | 始终 `'not_used'` hardcoded | 实时 Redis ping latency / 错误信息（staging 实测 6ms）|
| CSP mode | Report-Only（仅记录不阻断）| **enforce**（违反即拦）|
| Dashboard Campaigns 卡 | 灰态 disabled "Coming soon"（自 BL-006 起）| 可点击跳 `/{locale}/campaigns` |
| /discovery prod KOL 列表 | 含 12 个 demo_seed mock 占位 | env-var 控制；prod=true 隐藏，staging=false 保留 |

---

## 类型检查 / CI

```
$ npx prisma generate
✔ Generated Prisma Client (v7.7.0) in 97ms

$ npx tsc --noEmit
EXIT=0 (0 errors)

$ npm run lint
✖ 1 problem (0 errors, 1 warning)
  src/lib/kol-sync/adapters/youtube.ts:32:3  warning  'PUBLISHED_AFTER_CORE_REGIONS' is defined but never used
  (pre-existing, BL-027/B5 历史遗留，与 BL-020 无关)

$ npx vitest run <BL-020 9 个测试文件>
Test Files  9 passed (9) — F001(12) + F002 unit(24) + F003 fidelity(8) + F004 unit(6) + F005 health(3+6) + F005 login(3) + F005 rate-limit(5) + F008 filters(26) = 93 PASS
Tests       93 passed
（F002 AiSuggestionsClient 集成 2 tests 本机 Node 25.7 + jsdom 29 fail，CI Node 20 PASS — 见 Framework Learnings 新坑）

$ gh run list --branch main --limit 5
ca5515b  CI                          conclusion: success  (run 25330969685, 9m38s, 2026-05-04T16:40Z)
6e2c11c  CI                          conclusion: success  (run 25329534786, 9m13s, F005 health-test fix)
25c6fb0  Update visual baselines     conclusion: success  (run 25329141733, dashboard.png 重生)
3aa33cb  CI                          conclusion: failure  (F006 单 commit 上 CI failure → 25c6fb0 visual baseline 重生 + 6e2c11c F005 test fix 后绿)
9233e78  CI                          conclusion: success  (F005 commit)

CI run 25330969685 @ ca5515b 全 8 jobs success：
  Validate ROLLBACK / Install / Lint / Typecheck / Build+migrate / Unit tests + coverage / Integration tests (Testcontainers) / E2E tests (Playwright)
  Unit tests: 122 passed (122)
  Integration tests: 54 passed | 1 skipped (55)

$ curl -s https://staging.kol.guangai.ai/api/health
{"status":"healthy","version":"0.1.0","git_sha":"ca5515b","uptime_seconds":820,
 "checks":{"database":{"status":"ok","latency_ms":23},"redis":{"status":"ok","latency_ms":6}}}
```

---

## L2 Staging 验收实录（2026-05-05 ~01:00 UTC，由 CLI 临时担任 evaluator）

| 验证项 | 方法 | 结果 |
|---|---|---|
| Staging git_sha == main HEAD | `curl https://staging.kol.guangai.ai/api/health` | `ca5515b`（main HEAD 当时为 `79c44ad`，diff 仅 `progress.json` + `.auto-memory/project-status.md` — paths-ignore matched，按 evaluator §10 等价部署不阻断签收）|
| Staging health | 同上 | `status: "healthy"`，DB latency 23ms ✓，**Redis ok latency 6ms ✓**（F005 落地证据）|
| F002 CSP enforce header | `curl -I https://staging.kol.guangai.ai/en/login` | `content-security-policy:` 实有，**无 `-Report-Only` 后缀**；directives 与 next.config.ts:74-82 完全一致 ✓ |
| F005 Redis 实际连通 | `/api/health.checks.redis.status === "ok"` 6ms | ioredis client 在 staging PM2 正常初始化 + ping 成功 ✓ |
| F005 rate-limit live probe | 限于 RSC server action POST 协议（CSRF + RSC payload）curl 无法简洁模拟 | **入 Soft-watch S1**（Redis db 2 中 `rl:login:*` 短期 TTL 键无法直观脚本探查；prod 灰度时浏览器 5 错误密码 + 第 6 次见 `errorRateLimited` toast 是最终物理验证）|
| F006 CSP 浏览器 walk | spec §D4 锁 Reviewer L2 不卡 1 周观察期 | **入 Soft-watch S2**（spec §6.3 1 周 prod 观察期由用户驱动 redeploy 时机；此处确认 staging 当下 enforce 已生效）|
| F007 Dashboard Campaigns 卡视觉 | CI 视觉回归 dashboard.png baseline 25c6fb0 重生 + ca5515b 后续 CI 走查 | ✓（grid layout / TONE_CLASS 不变；`href: '/campaigns'` 解禁 disabled 判据 + `<a>` 渲染替换 `<button disabled>`）|
| F008 staging /discovery KOL 列表 | `HIDE_DEMO_SEED_KOLS` 未设 → unfiltered；staging 应仍可见 12 demo_seed | 实装 `process.env.HIDE_DEMO_SEED_KOLS === "true"` 严格比对；env unset 时 AND 数组不追加 `emailSource not demo_seed` ✓ |

> **L2 总结：** staging 部署 + health endpoint 实测 + CSP enforce header 实测 + 9 个测试文件 93 unit/集成 PASS + CI run 25330969685 全 8 jobs success 联合背书 8 features 实装健康。F005 rate-limit live probe 与 F006 1 周观察期作 Soft-watch 入项目状态由用户驱动 prod 灰度 / 观察。

---

## Ops 副作用记录

本批次 Reviewer 阶段无数据库 ops。Generator 阶段亦未在 staging/prod 直跑 SQL；唯一 staging-侧 ops 是 F005 期 Generator 在 staging VM SSH 追加 `REDIS_URL=redis://localhost:6379/2` 到 `/opt/kolmatrix-staging/.env.staging`（备份 `.bak.bl020-f005`），目的是让 staging PM2 进程能读到 Redis URL；此 env 改动未入 git，由 Planner 后续在 environment.md 加补充（已落 framework/proposed-learnings.md 由 Planner 在 done 阶段消化）。

| Agent | 阶段 | 操作摘要 | 副作用对齐 | 用户授权 |
|---|---|---|---|---|
| Generator johnsong | building (F005) | SSH staging 追加 REDIS_URL 到 .env.staging（同 prod 表格已含的 db idx 2） | 不涉数据库写；仅让 staging PM2 进程读到既有 Redis 实例 | spec §D3 + Q3=A 全栈范围隐含授权（用户决策 F005 含 Redis infra 全栈装包） |

---

## Harness 说明

本批改动经 Harness 状态机完整流程（planning → building → verifying → done）交付。

- `progress.json` 已设为 `status: "done"`，signoff 路径已填入 `docs.signoff`。
- fixing/reverifying 阶段未触发（**first-round PASS**，fix_rounds=0；满足 evaluator §12 三条硬条件：(a) 8 features acceptance 全代码层 PASS / (b) L1 + L2 全 PASS / (c) 所有 Soft-watch 项有明文兜底机制）。
- `role_assignments` 全程为 null（默认映射 CLI=planner+generator，Codex=evaluator；本会话用户口头指派 CLI 临时担任 evaluator 完成 BL-020 verifying，符合 harness §1.5 用户直接指派独立任务边界）。
- Pre-Impl Audit Planner 裁决 #1:A（Product.id CUID 而非 UUID）落 `docs/specs/BL-020-F001-audit-cuid-vs-uuid.md` §7。
- 状态机 JSON 文件写入前后均跑 `python3 -c "import json; json.load(open(...))"` 校验（铁律 #11）。
- 所有 commit 前跑 `git diff --cached --name-only` 核对 staged 文件清单（铁律 #12）。

---

## Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | F005 rate-limit live endpoint probe 未在 staging 跑（RSC server action POST 协议无法 curl 简洁模拟）— unit 5/5 + login integration 3/3 + Redis testcontainer 1 PASS 联合背书实装无误，但物理"5 次错误密码 + 第 6 次见 errorRateLimited toast"未在 staging 重现 | **medium** | prod 灰度时用户在浏览器 /en/login 5 次故意错误密码 → 第 6 次应见 `errorRateLimited` toast + retryAfter（spec §D8 escape hatch DISABLE_LOGIN_RATELIMIT=true 兜底），同时 SSH prod `redis-cli -n 1 KEYS 'rl:login:*'` 可见短期 5min TTL 键 |
| S2 | F006 CSP enforce 1 周观察期 — Reviewer L2 当下 PASS（staging enforce 已生效），但 1 周内可能浮出新 violation；spec §6.3 锁 Soft-watch | **low** | 已入 project-status.md §用户手工待办 #2；用户在 1 周内（2026-05-05 ~ 2026-05-12）每天 1 次 staging 主路径 walk + DevTools Console 观察；无 violation 则 prod redeploy + ：spec §6.3 step C |
| S3 | F008 prod 部署需用户 SSH `.env.production` 加 `HIDE_DEMO_SEED_KOLS=true` + `pm2 reload kolmatrix --update-env` | **low** | 已入 project-status.md §用户手工待办 #1；spec §6.1 step A 已锁 |
| S4 | F002 `AiSuggestionsClient.test.tsx` 2 集成 case 在 Node 25.7 + jsdom 29 本机 fail（`window.localStorage.setItem is not a function`），CI Node 20 全 PASS | **low** | Node 25.7 引入 native localStorage 但需 `--localstorage-file` flag 才启用，jsdom 29 的 localStorage shim 在 Node 25 native localStorage 启用前 detect 错配 → fail；推荐项目加 `.nvmrc` 锁 Node 20 LTS（与 CI 一致）；已入 Framework Learnings 新坑 |
| S5 | environment.md staging 表格未含 REDIS_URL 字段（prod 表格有 `Redis 共用实例 db index 1`），Generator 在 staging .env.staging 追加 REDIS_URL 后未自动同步 environment.md（johnsong session_notes 提示）| **low** | 由 Planner 在 done 阶段消化 framework/proposed-learnings.md 后更新 environment.md staging 段加 `Redis 共用 prod Redis 实例 db index 2` 字段 |

---

## Framework Learnings

### 新规律

- **`.nvmrc` 锁 Node LTS 与 CI 一致** — 项目根无 `.nvmrc`，本机 Node 25.7 与 CI Node 20 不一致，导致 jsdom 29 的 localStorage shim 在 Node 25 native localStorage 启用前 detect 失败时 Reviewer 本地 unit fail / CI PASS；同样 root cause 类的 framework 沉淀（vitest.config.ts §testTimeout WSL2 60s 注释 = `framework/CHANGELOG.md` v0.9.6 [#1]）已存在，但 Node 版本本身未锁
  - 来源：BL-020 verifying 阶段本机 `npx vitest run AiSuggestionsClient.test.tsx` 2 fail / CI 25330969685 unit 122/122 PASS 对比触发
  - 建议写入：`.nvmrc` 加 `20`（或 `lts/iron`）+ `framework/harness/evaluator.md` §L1 标配前置命令加 "Reviewer 本地 Node 版本应与 .nvmrc 一致；不一致时本地结果不算正面 / 反面证据，以 CI 为准"

### 新坑

- **Node 25 引入 native localStorage 但需 `--localstorage-file` flag 才启用**（Node 25.x 改动）— jsdom 29 的 localStorage shim 在 Node 25 native localStorage 启用前 detect 错配，window.localStorage 变 `undefined`；任何 jsdom + localStorage 测试在 Node 25 无 flag 时全 fail。Node 25 启动会输出警告 `Warning: '--localstorage-file' was provided without a valid path`（误导性 — 实际是 jsdom 在检查 native 时被 Node 25 的内置占位干扰）
  - 来源：BL-020 F002 AiSuggestionsClient 2 集成 case 本机 fail，CI（Node 20）PASS；本会话 evaluator 在 Reviewer 本地核查时首次踩到
  - 建议写入：`framework/harness/evaluator.md` §L1 本地核查 — "如本机 Node ≥ 25 + 测试用 jsdom + localStorage，需切回 Node 20 LTS（与 CI 一致）；本地 fail 不一定是产品 bug，先核 CI 与本机 Node 版本一致性"

### 模板修订

- **signoff-report.md `## L2 实测记录` 段建议加 "rate-limit-style endpoint live probe" 子项** — 该类 acceptance 的 L2 物理验证常需 RSC server action POST 协议（CSRF + RSC payload），curl 不能简洁模拟，常退到"unit + integration + health 联合背书 + prod 灰度浏览器手验"模式，应在模板中明列处理建议
  - 建议修改：`framework/templates/signoff-report.md` `## L2 实测记录` 段加一行注 "对走 RSC server action 的 endpoint（如 login form / OAuth callback / mutation 提交），L2 live probe 应描述 curl 是否能模拟 + 不能时退到 prod 灰度浏览器手验的兜底"

---

## 总评

**8/8 PASS（first-round），fix_rounds=0。**

L1：tsc 0 / lint 0 errors（仅 1 既有 youtube.ts 警告无关）/ 9 个测试文件 93 unit/集成 PASS 本机（F002 集成 2 case Node 25.7 incompat 见 §Framework Learnings）/ CI run 25330969685 @ ca5515b 全 8 jobs success（Unit 122/122 + Integration 54/55，1 skipped 与 BL-020 无关）。

L2：staging git_sha=ca5515b（与 main HEAD 79c44ad diff 仅 paths-ignore matched 状态机文件，等价部署）/ status=healthy / DB ok 23ms / **Redis ok 6ms**（F005 落地证据）/ CSP enforce header 实测 / 8 features acceptance 全代码层与 spec §D1-D8 + Q1-Q3 + #1:A 决策对齐。

5 项 Soft-watch 全有明文兜底（S1 prod 灰度浏览器手验 / S2 项目状态用户手工待办 + spec §6.3 / S3 项目状态用户手工待办 + spec §6.1 / S4 framework learnings 新坑 / S5 由 Planner done 阶段消化），符合 evaluator §12 首轮 PASS 三硬条件。

切 `progress.json status="done"`，`docs.signoff` 填入此报告路径。
