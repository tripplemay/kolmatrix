# BL-035 后端 HIGH 收尾 + UX + AI 服务端协调批次 — Spec

> **状态：** Planner draft → 待 Generator 开工
> **触发：** `docs/reviews/backend-full-scan-2026-05-04.md` §2 (HIGH 14 项 - BL-020 已含 3 项 - BL-034 已含 1 项 = 11 项) + F012 用户 2026-05-05 报 KOL Discovery mock 沉底 UX + F013 BL-034 F005 partial 后 Planner 14:00 裁决方案 A 推入
> **作者：** Planner johnsong @ 2026-05-05 14:30
> **依赖：** BL-034 done @ 07a6db4 / BL-020 F005 Redis infra 复用
> **预估：** 5-7 day building + 1 day verifying（audit §6 Sprint 1 范围 + F012 1.5h + F013 2-3h）
> **批次类型：** 普通批次（13 features 全 `executor:generator`）→ status 流转 `new → planning → building → verifying → done`

---

## 1. 背景与目标

KOLMatrix prod 上线对外（计划 2026-05-13）前必修的应用层完整性收尾。来源 backend-full-scan §2 HIGH 14 项 - BL-020 + BL-034 已覆盖 3 项 = 11 项，加 F012 (UX) + F013 (BL-034 F005 服务端协调) = **13 features**。

**11 项 HIGH 池子（修复方向矩阵）：**

| ID | 范畴 | 简述 |
|---|---|---|
| AUTH-H1 → BL-020 F005 | 认证 | login rate-limit（已覆盖） |
| AUTH-H2 = F001 | 认证 | 密码最小长度 1 → 12 |
| AUTH-H3 → BL-020 F006 | 认证 | CSP enforce（已覆盖） |
| AUTH-H4 → BL-034 F007 | 认证 | health git_sha token gate（已覆盖） |
| AUTH-H5 = F002 | 认证 | withPlatformAdmin 过权调用收紧 |
| AUTH-H6 → BL-034 F008 | 认证 | is_platform_admin NULLIF（已覆盖） |
| API-H1 = F003 | API | AI endpoint rate-limit 6 处（v0.9.11 §rate-limit dogfood） |
| API-H2 = F004 | API | createShareToken origin 服务端推导 |
| API-H3 = F005 | API | updateProduct/deleteProduct ownership preflight |
| AI-H1 = F006 | AI/Email | Resend bounce/complaint webhook 实装 |
| AI-H2+H3 = F007 | AI/Email | PII 脱敏（错误体 / EmailLog.bodyHtml retention / mock log） |
| AI-H4 = F008 | AI/Email | sendBatchAction 50→8 + timeout 60s |
| AI-H5 → BL-034 F006 | AI | placeholder-guard 共享（已覆盖） |
| DB-H1 → AUTH-H5 | DB | 同 AUTH-H5（合并） |
| DB-H2+H3 → BL-034 F004 | DB | embedAllKols softdel（已覆盖） |
| DB-H4 → BL-034 F008 | DB | platform_admin NULLIF（已覆盖） |
| DB-H5+H6 = F009 | DB | kol_campaign 索引补 |
| CQ-H1 = F010 | 代码质量 | fetchWithRetry 共享 |
| CQ-H2/H4-H6 = F011 | 代码质量 | 死代码删 |

**新加 2 项：**
- **F012 UX-1** (用户 2026-05-05 报)：KOL Discovery mock 沉底 — paginator nulls 修饰符支持
- **F013 AI-1** (BL-034 F005 partial 推入)：aigcgateway actions/run 服务端协调（max_tokens + 第 4 wrap + system prompt untrusted）

**Definition of Done（DoD）：**
- 13 features 全 PASS by Reviewer L1 + L2
- prod 上线前 user 手工动作完成（spec §6.1）
- v0.9.11 §rate-limit + §max_tokens dogfood 应用（F003 + F013）
- v0.9.12 §pre-impl-adjudication §11 building 中段变种知道（如 F013 触发 actions/run 服务端真实结构与 spec 偏差时）

---

## 2. 功能清单（13 features 全 generator，按推荐实装顺序）

### F010 · CQ-H1 fetchWithRetry 抽共享（先做 — F003 依赖）

**Executor:** generator
**Priority:** high（先做，建立共享基础供 F003 复用）
**预估工时:** 1.5h

**Audit 引用：** 5 处重复（`campaigns/suggestions.ts` + `email/customize.ts` + `kol-database/intelligence.ts` + `roi/insights.ts` + `weekly-report/generate.ts`）

**改动：**
1. **新建 `src/lib/aigc/fetch-with-retry.ts`：** export `fetchWithRetry(url, init, opts?)` + `resolveAigcV1BaseUrl()`：
   ```ts
   export interface FetchWithRetryOpts {
     timeoutMs?: number;       // default AIGC_TIMEOUT_MS env or 10_000
     retryOn5xx?: boolean;     // default true
     retryDelayMs?: number;    // default 500 + jitter [0, 250)
   }
   export async function fetchWithRetry(
     url: string,
     init: RequestInit,
     opts: FetchWithRetryOpts = {}
   ): Promise<Response>
   ```
2. **5 处替换：** 删本地 fetchWithRetry / baseUrl 定义，从 `@/lib/aigc/fetch-with-retry` import
3. **加 jitter（v0.9.12 dogfood — audit §AI-M4 thundering herd 风险预防）：** `retryDelayMs + Math.random() * 250`

**Acceptance：**
- [ ] `src/lib/aigc/fetch-with-retry.ts` 存在，导出 `fetchWithRetry` + `resolveAigcV1BaseUrl`
- [ ] 5 处 caller 全 import 共享（grep `function fetchWithRetry` in src/ → 0 hits 除新建文件）
- [ ] retry 含 jitter ([0, 250) ms)
- [ ] 新增 `src/lib/aigc/__tests__/fetch-with-retry.test.ts` ≥4 case：成功直返 / 5xx 重试一次后 PASS / timeout 抛 / jitter 范围正确
- [ ] `npm run lint + tsc + test` 全绿

---

### F003 · API-H1 AI endpoint rate-limit 6 处（v0.9.11 §rate-limit dogfood）

**Executor:** generator
**Priority:** high
**预估工时:** 3-4h（含 6 endpoint 接入 + Redis testcontainer 集成测试）

**Audit 引用：** API-H1 — 6 个 AI endpoint 全无速率限制：
- `POST /api/kols/smart-match`（route handler）
- `generateRoiInsightsAction`（roi/actions.ts）
- `generateDatabaseInsightsAction`（kol-database/actions.ts）
- `generateWeeklyReportAction`（weekly-report/actions.ts）
- `generateAssetAction`（assets/actions.ts）
- `sendBatchAction`（outreach/actions.ts）

**v0.9.11 §rate-limit 矩阵 dogfood：**
- AI 调用类 → `10 req/min/tenantId` + `100/day/tenant`
- Mutation（sendBatch）→ `20 req/min/userId`

**改动：**

1. **复用 BL-020 F005 Redis 基础：** `src/lib/redis.ts` getRedis() singleton + `src/lib/rate-limit.ts` 已有 `rateLimitLogin(ip)` 模式
2. **新建 `src/lib/rate-limit-ai.ts`：** export `rateLimitAi(tenantId): Promise<{ok:true} | {ok:false, retryAfter}>`（10/min sliding window + 100/day fixed window 两层）
3. **新建 `src/lib/rate-limit-batch.ts`：** export `rateLimitBatchSend(userId): {ok:true} | {ok:false, retryAfter}`（20/min/userId）
4. **6 endpoint 接入：** 调用前 `await rateLimitAi(tenantId)` 或 `rateLimitBatchSend(userId)`，超限返 `{ ok: false, error: "rate_limit_exceeded", retryAfter }`
5. **Escape hatch：** env var `DISABLE_AI_RATELIMIT=true` / `DISABLE_BATCH_RATELIMIT=true`（与 BL-020 F005 `DISABLE_LOGIN_RATELIMIT` 同模式）
6. **i18n 5 locale：** errorRateLimited 同 BL-020 F005 模式（en/zh/ja/ko/es）

**Acceptance（v0.9.11 §rate-limit clause 完整版）：**
- [ ] `src/lib/rate-limit-ai.ts` 存在，10/min/tenantId 滑动 + 100/day/tenant 固定
- [ ] `src/lib/rate-limit-batch.ts` 存在，20/min/userId 滑动
- [ ] 6 endpoint 全接入预检（grep `rateLimitAi\|rateLimitBatchSend` → 6 hits）
- [ ] Redis down → fail-open（与 BL-020 F005 一致）
- [ ] env var DISABLE_AI_RATELIMIT / DISABLE_BATCH_RATELIMIT 短路 fail-open
- [ ] 5 locale errorRateLimited messages 字符串
- [ ] 新增 `src/lib/__tests__/rate-limit-ai.test.ts` ≥4 case via Redis testcontainer：连续 11 fail / 等 60s 重置 / day 上限 fail / DISABLE 短路
- [ ] 新增 `src/lib/__tests__/rate-limit-batch.test.ts` ≥3 case
- [ ] 6 endpoint 集成测试加 ≥1 case 验证 rate-limit 接入
- [ ] `npm run lint + tsc + test` 全绿 + CI 全绿

---

### F012 · UX-1 KOL Discovery mock 沉底（paginator nulls 修饰符支持）

**Executor:** generator
**Priority:** medium
**预估工时:** 1.5h building + 0.5h Reviewer

**用户 2026-05-05 报：** /discovery 默认 sort='value' (valueScore desc) 时 12 条 mock KOL（valueScore=NULL）因 Postgres `ORDER BY ... DESC` 默认 `NULLS FIRST` 顶到首页，2245 条真实 KOL（80-100 分）被压沉底。

**改动：**

1. **修 `src/lib/pagination/cursor.ts:95` paginator orderBy shape：**
   ```ts
   // 现状（line 95）：
   orderBy: [{ [orderBy]: direction }, { id: direction }]

   // 改为接受可选 nulls 配置（向后兼容 string）：
   type OrderBySpec = string | { field: string; nulls?: 'first' | 'last' };
   const oby = typeof orderBy === 'string'
     ? { [orderBy]: direction }
     : { [orderBy.field]: { sort: direction, nulls: orderBy.nulls ?? 'last' } };
   findManyArgs.orderBy = [oby, { id: direction }];
   ```
2. **修 `src/app/[locale]/(app)/discovery/search.ts:87`：** `orderBy` 传 `{ field: 'valueScore', nulls: 'last' }` 当 sort='value'；'recent' / 'followers' 保持 string（无 NULL 浮顶问题）
3. **修 `src/lib/kol/filters.ts:549 sortToOrderBy`：** 返回值改为支持 OrderBySpec
4. **同步评估 `database/search.ts` + `campaigns/search.ts`：** 若它们 sort 字段可 NULL（如 `lastEmailedAt` / `firstSeenAt`），同步加 nulls:'last'

**Acceptance：**
- [ ] `cursor.ts:95` orderBy shape 升级支持 `{ field, nulls }`
- [ ] discovery sort='value' 时实测 mock 12 条不顶首页（手工 staging 验证 + 自动测试）
- [ ] 既有 string-form orderBy 调用（database/campaigns）向后兼容（不报错 + 行为不变）
- [ ] 新增 `src/lib/pagination/__tests__/cursor.test.ts` ≥3 case：string 向后兼容 + nulls:'last' 顶 NULL 沉底 + 默认 nulls=last
- [ ] discovery search 集成测试加 1 case：seed 1 NULL valueScore + 1 高分 → 高分排首
- [ ] `npm run lint + tsc + test` 全绿

---

### F004 · API-H2 createShareTokenAction origin 服务端推导

**Executor:** generator
**Priority:** high
**预估工时:** 1h

**Audit 引用：** `weekly-report/actions.ts:158-199` — `createShareTokenAction(reportId, origin)` 接受客户端传 `origin` → 攻击者可生成指向 `attacker.com` 的分享 URL → 钓鱼。

**改动：**
1. **签名改为 `createShareTokenAction(reportId)`：** 删 `origin` 参数
2. **服务端推导：** `import { headers } from 'next/headers'; const origin = (await headers()).get('host')` 或 `process.env.NEXT_PUBLIC_SITE_URL`
3. **客户端调用方同步：** WeeklyReportClient.tsx 等不再传 origin

**Acceptance：**
- [ ] `createShareTokenAction` 签名只剩 `reportId`
- [ ] 服务端推导 origin（headers().get('host') 或 env var）
- [ ] 客户端调用方 grep "createShareToken" 全部不传 origin
- [ ] 既有 weekly-report E2E / 集成测试同步更新
- [ ] `npm run lint + tsc + test` 全绿

---

### F005 · API-H3 updateProduct + deleteProduct ownership preflight

**Executor:** generator
**Priority:** high
**预估工时:** 1h

**Audit 引用：** `knowledge-base/actions.ts:129` — updateProduct / deleteProduct 未在应用层做 ownership 预检（RLS 单一防线，加 findUnique 防御纵深）。

**改动：**
1. **`updateProduct(productId, ...)`** 实现内调用 `prisma.product.findUnique({ where: { id: productId } })` 后判 `tenantId === session.tenantId`（withTenant 已 enforce 但显式预检）
2. **`deleteProduct(productId)`** 同
3. **失败 → return `{ ok: false, error: "not_found" }`**（不暴露 product 是否存在）

**Acceptance：**
- [ ] updateProduct + deleteProduct 含 ownership findUnique preflight
- [ ] 跨租户访问返 not_found（与 RLS 行为一致）
- [ ] 测试 `__tests__/actions.test.ts` 加 ≥2 case 验证跨租户 PUT/DELETE 返 not_found
- [ ] `npm run lint + tsc + test` 全绿

---

### F001 · AUTH-H2 登录密码最小长度 1 → 12

**Executor:** generator
**Priority:** high
**预估工时:** 30min

**Audit 引用：** `src/auth.ts:19` `z.string().min(1)` 改 `min(12)`。

**改动：**
1. **`src/auth.ts:19`** `password: z.string().min(1)` → `password: z.string().min(12)`
2. **i18n** 加 `auth.errors.passwordTooShort`（5 locale）
3. **既有用户密码：** seed 用户 `KOLM@2026!` 长度 10 < 12 → 测试可能破。改 fixture 或同步给 seed.ts 默认密码补长度

**Acceptance：**
- [ ] auth.ts password schema min(12)
- [ ] login form 短密码立即返 passwordTooShort（前端 + 后端双校验）
- [ ] 5 locale 错误消息字符串
- [ ] seed.ts 默认 SEED_ADMIN_PASSWORD 改 `KOLMatrix@2026!`（13 char ≥ 12）+ environment.md 同步
- [ ] 测试加 ≥2 case：11 字符拒 + 12 字符 OK
- [ ] `npm run lint + tsc + test` 全绿

---

### F002 · AUTH-H5 withPlatformAdmin 过权调用收紧

**Executor:** generator
**Priority:** high
**预估工时:** 30min

**Audit 引用：** `src/app/[locale]/(app)/actions.ts:25` — withPlatformAdmin 用作普通 locale 更新（user 表 email 全局唯一所以安全，但属过权调用模式）。

**改动：**
1. **`actions.ts:20-30`** 当 `tenantId/userId UUID 校验失败但有 email` 走 platform-admin 路径前，先 `findUnique({ where: { email } })` 查 user，找到 → 走 `withTenant(user.tenantId, ...)`；找不到 → throw Unauthorized（不再过权用 platform-admin）
2. **保留 platform-admin 路径仅用于真正跨租户场景**

**Acceptance：**
- [ ] actions.ts updateUserLocale 不再用 platform-admin 路径处理 locale 更新
- [ ] 找不到 user → Unauthorized
- [ ] 测试加 1 case 验证无效 email 返 Unauthorized
- [ ] `npm run lint + tsc + test` 全绿

---

### F009 · DB-H5+H6 kol_campaign 索引补

**Executor:** generator
**Priority:** medium
**预估工时:** 1h

**Audit 引用：** `schema.prisma:281-307` kol_campaign 缺 `kolId` 单字段索引 + `tenantId` FK 独立索引。

**改动：**
1. **新建 prisma migration `20260506000000_kol_campaign_indexes`：**
   ```sql
   CREATE INDEX CONCURRENTLY IF NOT EXISTS kol_campaign_kol_id_idx ON kol_campaign(kol_id);
   CREATE INDEX CONCURRENTLY IF NOT EXISTS kol_campaign_tenant_id_idx ON kol_campaign(tenant_id);
   ```
2. **`schema.prisma`** model KolCampaign 加 `@@index([kolId])` + `@@index([tenantId])`
3. **CONCURRENTLY 注意（与 BL-034 F004 同坑）：** prisma migrate dev 不允许事务内 CONCURRENTLY，--create-only + 手工调整 BEGIN/COMMIT；prod 大表执行短锁可接受（kol_campaign ≤ 10K 行）

**Acceptance：**
- [ ] migration 文件存在 + 本地 migrate dev PASS
- [ ] `psql -c "\d kol_campaign"` 显示两个新索引
- [ ] schema.prisma 含 @@index 声明
- [ ] 既有集成测试无回归
- [ ] `npm run lint + tsc + test` 全绿

---

### F006 · AI-H1 Resend bounce/complaint webhook 实装

**Executor:** generator
**Priority:** high
**预估工时:** 3-4h

**Audit 引用：** AI-H1 — `src/app/api/webhooks/resend/` 不存在；硬退信 KOL 仍会被一遍遍发，伤 sender reputation。

**改动：**
1. **新建 `src/app/api/webhooks/resend/route.ts`：** POST handler + svix-signature 验签（Resend 用 svix 标准）
2. **依赖：** `npm install svix`（验签库）
3. **写回 EmailLog.status：** 按 webhook event type 写 'bounced' / 'complained' / 'delivered' / 'opened' / 'clicked'
4. **Hard bounce 命中清 Kol.email：** event.type === 'email.bounced' && event.data.bounce.type === 'permanent' → withTenant set Kol.email=null + 写 audit_log
5. **i18n / .env.example：** 加 `RESEND_WEBHOOK_SECRET`（svix 签名密钥）

**Acceptance：**
- [ ] `/api/webhooks/resend/route.ts` 存在 + POST handler
- [ ] svix 签名验证（`Svix.Webhook.verify(body, headers)`）
- [ ] 5 event type 映射到 EmailLog.status
- [ ] hard bounce → Kol.email=null + audit_log
- [ ] 验签失败 → 401
- [ ] `.env.example` 加 RESEND_WEBHOOK_SECRET
- [ ] 新增 `src/app/api/webhooks/resend/__tests__/route.test.ts` ≥5 case：valid signature + 5 event type / invalid signature 401 / hard-bounce email 清空 / soft bounce 不清
- [ ] `package.json` 含 svix 依赖
- [ ] `npm run lint + tsc + test` 全绿

---

### F007 · AI-H2+H3 PII 脱敏（错误体 + EmailLog retention + mock log）

**Executor:** generator
**Priority:** high
**预估工时:** 2-3h（含 retention cron 脚本）

**Audit 引用：** 三处：
- AI-H2: `customize.ts:165` 等 5 处把 aigcgateway 错误体 200 char 抛回客户端
- AI-H3: `EmailLog.bodyHtml` 全量替换后正文存 KOL 真实姓名/邮箱无 retention
- mock：`resend.ts:110-115` `[EMAIL MOCK]` 默认打全 PII 到 stdout

**改动：**
1. **错误体脱敏（5 处 + 任何 fetchWithRetry 调用方）：** 服务端 `console.error('[aigcgateway full]', ...)` 完整 log，客户端 throw `aigcgateway responded ${status}`（无 body slice）
2. **EmailLog retention：** 新建 `scripts/redact-old-email-logs.ts` 定时跑（cron 每日 02:00 UTC），找 `created_at < NOW() - 30 day` 的 EmailLog 行 update bodyHtml='[REDACTED 30d retention]' + 保留 metadata
3. **mock log：** `src/lib/email/resend.ts:110-115` `[EMAIL MOCK]` 默认仅打 to + subject，env var `EMAIL_MOCK_VERBOSE=true` 才打 body

**Acceptance：**
- [ ] 5 处 customize/insights 等错误抛仅 status，不含 body slice
- [ ] `scripts/redact-old-email-logs.ts` 存在 + dry-run 默认 + `--apply` 落地
- [ ] cron 集成（VPS crontab @ 02:00 UTC，user 手工待办）
- [ ] resend.ts mock 默认仅 to + subject；EMAIL_MOCK_VERBOSE=true 完整体
- [ ] `.env.example` 加 EMAIL_MOCK_VERBOSE=false
- [ ] 新增 `scripts/__tests__/redact-old-email-logs.test.ts` ≥2 case：dry-run 不动数据 / apply 30d 之前行 redact
- [ ] `npm run lint + tsc + test` 全绿

---

### F008 · AI-H4 sendBatchAction 50 → 8 + timeout 60s

**Executor:** generator
**Priority:** high
**预估工时:** 1h

**Audit 引用：** AI-H4 — sendBatchAction 阻塞 50 × 6s = 300s，超 Next 16 默认 server action 30-60s 超时。

**改动：**
1. **`src/app/[locale]/(app)/outreach/actions.ts sendBatchAction`：** 批次 cap 50 → **8**（Zod schema `.max(8)` 或 server-side slice）
2. **总超时：** 60s（Promise.race with timeout）
3. **错误返回：** "batch_too_large" 当用户传 ≥9（前端拆批提示）
4. **未来 BullMQ 实装时迁队列异步**（注释标记 BL-040+ 候选）

**Acceptance：**
- [ ] sendBatchAction batch.length > 8 → return `{ ok: false, error: "batch_too_large" }`
- [ ] Promise.race 60s timeout → return `{ ok: false, error: "timeout" }`
- [ ] 既有集成测试同步更新
- [ ] 前端 BatchSendDialog 提示 8 上限
- [ ] `npm run lint + tsc + test` 全绿

---

### F011 · CQ-H2/H4-H6 死代码删

**Executor:** generator
**Priority:** medium
**预估工时:** 1h（5 处 grep + delete）

**Audit 引用：** CQ-H2/H4-H6 — 4 项零调用方导出 + 1 项 typed catch 缺位。

**改动：**
1. **CQ-H2:** 删 `loadUserTemplates` / `loadSystemTemplates`（`src/lib/email/templates.ts:114-154`）
2. **CQ-H4:** 删 `peekAllowedStatusTransitions` server action（`campaigns/[id]/actions.ts`）
3. **CQ-H5:** 把 `AssetVariantSelfReferenceError` 在 createAsset 调用方加 typed catch（既然已存在错误，应被处理）— 或如确认无意义则一并删
4. **CQ-H6:** unexport `AssetVariableSchema` / `EmailContent` / `VideoScriptContent`（移到文件内部）

**Acceptance：**
- [ ] 4 项删除（grep 全仓 0 hits）
- [ ] 1 项 typed catch 增（或确认无意义后删）
- [ ] CI 全绿（无回归 — 这些是死代码，删不应破任何测试）
- [ ] `npm run lint + tsc + test` 全绿

---

### F013 · AI-1 aigcgateway actions/run 服务端协调（v0.9.11 §4 dogfood 完整版）

**Executor:** generator（部分） + Planner ops（aigcgateway 控制台改）
**Priority:** medium
**预估工时:** 2-3h building + 0.5h verifying

**触发：** BL-034 F005 partial → Planner 14:00 方案 A 推入。详见 `docs/specs/BL-034-...spec.md §F005 fix-round 1 决策依据`。

**改动（双路并行）：**

**(a) aigcgateway 控制台改（Planner ops + mcp__aigc-gateway tool）：**
   - Generator 列出 actions/run 调用方对应 action_id 清单（grep `runAction\|action_id` in src/lib/）
   - Planner 用 `mcp__aigc-gateway create_action_version` 改 7 个 Action template：
     - kol-email-customize（customize.ts）→ max_tokens=2000 + system prompt 加 untrusted clause
     - roi-insights → max_tokens=4000 + same
     - weekly-report-for-client → max_tokens=4000 + same
     - kol-database-intelligence → max_tokens=1000 + same
     - kol-campaign-suggestions → max_tokens=1000 + same
     - kol-topic-extract → max_tokens=500 + same（同时改 prompt template 用 `<USER_VIDEO_TITLE>` 包裹）
     - kol-email-generator（如 actions/run 路径）→ max_tokens=2000 + same
   - 每个 Action `activate_version` 切到新版本

**(b) KOLMatrix 端 wrap（Generator 代码）：**
   - `src/lib/kol-detail/topic-cloud.ts` variables.videoTitles 数组每元素 `wrapUserInput('USER_VIDEO_TITLE', x)`
   - 其它 actions/run 调用方（customize / roi-insights / weekly-report 等）同步检查 variables 传值是否需 wrapUserInput（先做 grep 调用方清单）
   - `src/lib/embedding/client.ts:151` 复核（Generator BL-034 评估为 embeddings 端点跳过；F013 二次复核）

**Acceptance：**
- [ ] Generator 列举 actions/run 调用方清单 + action_id 映射（push 到 `docs/specs/BL-035-F013-actions-run-inventory.md`）
- [ ] aigcgateway 控制台 7 个 Action template 改 + activate（Planner ops，mcp tool 调用 + 用户确认）
- [ ] topic-cloud.ts videoTitles wrap（grep `wrapUserInput.*USER_VIDEO_TITLE` → ≥1 hit）
- [ ] 其它 actions/run 调用方 wrap 评估（generator_handoff 列）
- [ ] embedding/client.ts 复核结论（push 到 BL-035 signoff Soft-watch）
- [ ] 新增 `src/lib/aigc/__tests__/actions-run-variables-wrap.test.ts` ≥3 case
- [ ] `npm run lint + tsc + test` 全绿

---

## 3. 变更文件清单（高层）

```
prisma/migrations/
  20260506000000_kol_campaign_indexes/migration.sql                F009 NEW
prisma/schema.prisma                                               F009 EDIT (@@index)

src/lib/aigc/fetch-with-retry.ts                                   F010 NEW
src/lib/aigc/__tests__/fetch-with-retry.test.ts                    F010 NEW
src/lib/aigc/__tests__/actions-run-variables-wrap.test.ts          F013 NEW

src/lib/rate-limit-ai.ts                                           F003 NEW
src/lib/rate-limit-batch.ts                                        F003 NEW
src/lib/__tests__/rate-limit-{ai,batch}.test.ts                    F003 NEW

src/lib/pagination/cursor.ts                                       F012 EDIT (orderBy shape)
src/lib/pagination/__tests__/cursor.test.ts                        F012 NEW
src/lib/kol/filters.ts                                             F012 EDIT (sortToOrderBy)

src/auth.ts                                                        F001 EDIT (password.min(12))
src/app/[locale]/(app)/actions.ts                                  F002 EDIT (withPlatformAdmin 收紧)

src/app/[locale]/(app)/discovery/search.ts                         F012 EDIT (orderBy nulls:'last')

src/app/[locale]/(app)/weekly-report/actions.ts                    F004 EDIT (createShareToken origin)
src/app/[locale]/(app)/weekly-report/WeeklyReportClient.tsx        F004 EDIT (caller)

src/app/[locale]/(app)/knowledge-base/actions.ts                   F005 EDIT (ownership preflight)
src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts    F005 EDIT

src/app/api/webhooks/resend/route.ts                               F006 NEW
src/app/api/webhooks/resend/__tests__/route.test.ts                F006 NEW
package.json + package-lock.json                                   F006 EDIT (svix dep)

src/lib/email/customize.ts (+roi/insights / weekly-report / kol-database/intelligence / campaigns/suggestions / topic-cloud)
                                                                    F003 + F010 + F007 EDIT (rate-limit + fetchWithRetry shared + 错误脱敏)
src/lib/email/resend.ts                                            F007 EDIT (mock log redact)
scripts/redact-old-email-logs.ts                                   F007 NEW
scripts/__tests__/redact-old-email-logs.test.ts                    F007 NEW

src/app/[locale]/(app)/outreach/actions.ts                         F008 EDIT (sendBatch 50→8 + timeout)
src/app/[locale]/(app)/outreach/BatchSendDialog.tsx                F008 EDIT (前端 8 上限提示)

src/lib/kol-detail/topic-cloud.ts                                  F013 EDIT (videoTitles wrap)
src/lib/email/templates.ts                                         F011 EDIT (CQ-H2 删 dead)
src/app/[locale]/(app)/campaigns/[id]/actions.ts                   F011 EDIT (CQ-H4 删 dead)
src/lib/assets/mutations.ts                                        F011 EDIT (CQ-H5 typed catch / unexport)

docs/specs/BL-035-F013-actions-run-inventory.md                    F013 NEW（Generator 起草）

.env.example                                                       F003 + F006 + F007 EDIT (3 env vars)
i18n locales (en/zh/ja/ko/es).json                                 F001 + F003 EDIT (4-5 keys)
```

---

## 4. 关键设计决策

### D1 (F010) — fetchWithRetry 共享后加 jitter（v0.9.12 dogfood 防 thundering herd）
audit §AI-M4 列 5 处 retry 无 jitter；F010 共享时同步加 (0, 250)ms jitter — MEDIUM 项顺手做掉。

### D2 (F003) — AI rate-limit 用 v0.9.11 §4 dogfood 默认值矩阵
10 req/min/tenantId + 100/day/tenant（AI 类）；20 req/min/userId（mutation/sendBatch）。两层叠加：分钟级控制突发 + 日级控制总量。

### D3 (F003) — 6 endpoint 接入按 tenantId 维度（除 sendBatch 用 userId）
sendBatch 是 user-driven mutation，userId 维度更合理（防止单个 user 钓 sender reputation）；其它 5 处 AI 调用按 tenantId 维度（控制租户级总成本）。

### D4 (F006) — Resend webhook svix 验签
svix 是 Resend 标准（unkey/clerk 等也用），第三方库 `svix` 5.x 版本 API 简洁。新依赖。

### D5 (F006) — hard bounce 永久退信清 Kol.email
`event.data.bounce.type === 'permanent'` 时清 Kol.email + audit_log；soft bounce 不清（暂时 inbox 满 / 出差等）。

### D6 (F007) — EmailLog retention 30 day
30d 后 redact bodyHtml='[REDACTED 30d retention]' 保留 metadata（subject / to / status / providerMessageId）。retention period 与 prod-mvp-readiness audit 推荐一致。Cron 用户手工配置。

### D7 (F008) — sendBatch 50 → 8（不 7 不 10）
8 × 6s = 48s ≤ Next 16 默认 server action 60s 超时；保留 12s 余量给 RPC overhead + Resend API 延迟。审计建议 8 / 转 BullMQ；本批次先取保守 8，BL-040+ 评估 BullMQ 实装。

### D8 (F012) — paginator nulls:'last' 默认（向后兼容）
caller 传 string 时仍用旧 shape `{ field: direction }`（向后兼容），传 OrderBySpec 时套新 shape。Migration 路径无破坏。F012 仅迁移 discovery sort='value'，其它（recent/followers/database/campaigns）按需评估。

### D9 (F013) — aigcgateway 控制台改 + KOLMatrix 端 wrap 双路（合并 review）
Planner ops（mcp tool 改 7 个 Action）+ Generator wrap 代码必须同 sprint 完成 — 单路改对、另一路漏改 = 防御不完整。Planner 在 BL-035 done 阶段确认 7 个 Action 全 activated（mcp__aigc-gateway list_actions 验证）。

---

## 5. v0.9.11 + v0.9.12 框架新规 dogfood 应用

| 新规 | 应用位置 |
|---|---|
| v0.9.11 §rate-limit 默认值矩阵 | F003 (10/min/tenantId + 100/day; 20/min/userId for sendBatch) — 完整 dogfood |
| v0.9.11 §database-patterns.md §8 RLS template | F009 不新增 RLS 表（仅加索引），不直接应用；既有 RLS 不动 |
| v0.9.11 §ai-action-contract.md §4 max_tokens + XML tag | F013 完整版（aigcgateway 控制台改 7 Action + KOLMatrix 端 wrap） |
| v0.9.11 铁律 1 regex/id-format 检查矩阵 | 无直接应用（无新 regex） |
| v0.9.11 evaluator §16 Node 版本 .nvmrc | Reviewer L1 启动 nvm use 20 |
| v0.9.12 §pre-impl-adjudication §11 building 中段变种 | F013 高概率触发（aigcgateway 服务端真实结构与 spec 偏差时 Generator 主动停 + Planner 短格式裁决） |
| v0.9.12 §database-patterns.md §8.1 cross-cutting helper | 无直接应用（无新 RLS migration） |
| v0.9.12 §deploy-patterns.md §5 auth-gated endpoint | F006 webhook 是 svix-gated 但非 deploy script 触及 — 不直接应用 |
| v0.9.12 §evaluator.md §17 lint warnings 矩阵 | Reviewer reverifying 时按矩阵处理 |

---

## 6. Definition of Done

### 6.1 用户手工待办

| # | 操作 | 触发时机 |
|---|---|---|
| 1 | SSH prod + staging 落地 `RESEND_WEBHOOK_SECRET`（Resend Dashboard 生成 svix secret）+ `EMAIL_MOCK_VERBOSE=false` + `DISABLE_AI_RATELIMIT` / `DISABLE_BATCH_RATELIMIT` 留空（默认 enabled） | F003 + F006 + F007 PR merge 后 |
| 2 | Resend Dashboard 配 webhook URL `https://kol.guangai.ai/api/webhooks/resend` + svix secret | F006 PR merge 后 |
| 3 | VPS crontab 配 `0 2 * * * cd /opt/kolmatrix && npx tsx scripts/redact-old-email-logs.ts --apply >> /var/log/kolmatrix-redact.log 2>&1` | F007 PR merge 后 |
| 4 | aigcgateway 控制台 7 个 Action template 已通过 mcp tool 改 + activate 验证（Planner 在 BL-035 done 阶段验证） | F013 在 BL-035 building 期间 |

### 6.2 Reviewer L1 + L2 联合背书

- **L1：** lint + tsc + 全套 npm test PASS（含新增 ≥30 测试 case）+ CI 全绿
- **L2：** staging 部署 + git_sha 对齐 + health endpoint OK + 6 个 AI rate-limit endpoint manual 触发验证 + Resend webhook test event 验证（Resend Dashboard 工具）+ /discovery 默认 sort='value' 真实 KOL 占首屏（F012 验证）

### 6.3 Soft-watch（不阻塞 done）

- F006 webhook 实际发挥作用需要真 Resend bounce 触发 → 入 Soft-watch 入 prod redeploy 后 1 周观察期
- F008 sendBatch 8 上限是保守值；prod 实际 latency 数据后再评估升 12 / 转 BullMQ → 入 BL-040+ 候选
- F013 aigcgateway 控制台改后实际 max_tokens 截断行为 → 入 prod 1 周观察期

---

## 7. 推荐实装顺序（Generator 接手参考）

```
1. F010 fetchWithRetry 共享         （建立基础，~1.5h）
2. F003 AI rate-limit 6 处          （依赖 F010 + BL-020 Redis，~3-4h）
3. F009 kol_campaign 索引           （独立，~1h）
4. F012 paginator nulls 修饰符      （UX 独立，~1.5h）
5. F004 + F005 share token + ownership （API 收紧，~2h）
6. F001 + F002 password + withPlatformAdmin （auth 收紧，~1h）
7. F006 Resend webhook              （新模块，~3-4h）
8. F007 PII 脱敏 + retention        （依赖 F010 fetchWithRetry，~2-3h）
9. F008 sendBatch 50→8              （独立，~1h）
10. F013 aigcgateway 协调           （建议倒数，依赖 F010 fetchWithRetry + F003 rate-limit 完成后再做服务端配置改）
11. F011 死代码删                   （收尾，~1h）

总计：~20-25h building + 1 day verifying
```

> **Spec lock：** Planner johnsong @ 2026-05-05 14:30。Generator 开工前如发现 spec 偏差按 `framework/harness/pre-impl-adjudication.md` §1-§10 提交 audit 文档；如 building 中段发现良性偏差按 §11 building 中段变种处理。
