# BL-035 后端 HIGH + UX + AI 服务端协调 Signoff 2026-05-05

> 状态：**Reviewer first-round PASS**（progress.json status=verifying → done）
> 触发：`docs/reviews/backend-full-scan-2026-05-04.md` §2 (HIGH 11 项) + 用户 2026-05-05 报 KOL Discovery mock 沉底 UX (F012) + BL-034 F005 partial 后 Planner 14:00 裁决方案 A 推入 (F013)
> Reviewer：Codex L2 staging 实证（commit `6d70816` `docs/test-reports/BL-035-verifying-2026-05-05.md`）+ Planner johnsong 临时担任 evaluator 完成 signoff（用户 2026-05-05 ~22:30 口头授权方案 A，harness §1.5 + 铁律 6 session_notes 记账；与 BL-020 / BL-034 同模式）

---

## 变更背景

backend-full-scan-2026-05-04 audit §2 锁定 14 项 HIGH，BL-020 / BL-034 已覆盖 3 项剩 11 项 + 用户 2026-05-05 报 mock 沉底 UX (F012) + BL-034 F005 partial 推入 (F013) = **13 features**。本批次为 prod 上线对外（计划 2026-05-13）前最后一波后端应用层完整性收尾。

13 features 全 generator，由 Generator Kimi 在 2026-05-05 ~17:00 ~ 21:07 期间分 13 commit（按 spec §7 推荐顺序）实装，commit chain `6266bc6..c9cfed3`，附加 2 个修复 commit（`c99f94a` test flake + `c9cfed3` deploy-staging override NODE_ENV=development，撞 BL-034 F002 prod-seed-guard 边界用例的实地修），staging deployed @ c9cfed3 @ 2026-05-05T13:07Z。

---

## 变更功能清单

### F010：CQ-H1 fetchWithRetry 抽 src/lib/aigc/fetch-with-retry.ts 共享 + jitter

**Executor：** generator
**Commit：** `6266bc6`
**文件：** `src/lib/aigc/fetch-with-retry.ts`（新增）、`src/lib/aigc/__tests__/fetch-with-retry.test.ts`（新增）、5 处 caller（campaigns/suggestions / email/customize / kol-database/intelligence / roi/insights / weekly-report/generate）

**改动：**
- export `fetchWithRetry(url, init, opts={timeoutMs, retryOn5xx, retryDelayMs})` + `resolveAigcV1BaseUrl()`
- retry 含 jitter (0, 250)ms（v0.9.12 dogfood — audit §AI-M4 thundering herd 防御）
- 5 处 caller 删本地定义改 import 共享

**验收：** ✅
- `grep -rn "function fetchWithRetry" src/` → 仅 `fetch-with-retry.ts` 1 hits
- 单测 ≥4 case：成功直返 / 5xx 重试一次后 PASS / timeout 抛 / jitter 范围正确

---

### F003：API-H1 AI endpoint rate-limit 6 处（v0.9.11 §rate-limit dogfood）

**Executor：** generator
**Commit：** `57ef99e`
**文件：** `src/lib/rate-limit-ai.ts`（新增）、`src/lib/rate-limit-batch.ts`（新增）、`src/lib/__tests__/rate-limit-ai.test.ts`（新增）、`src/lib/__tests__/rate-limit-batch.test.ts`（新增）、6 处 endpoint 接入

**改动：**
- `rateLimitAi(tenantId)` — 10 req/min/tenantId 滑动 + 100/day/tenant 固定 两层叠加（v0.9.11 §rate-limit AI 类）
- `rateLimitBatchSend(userId)` — 20/min/userId（v0.9.11 §rate-limit mutation 类）
- 6 endpoint 全接入预检（POST /api/kols/smart-match / generateRoiInsightsAction / generateDatabaseInsightsAction / generateWeeklyReportAction / generateAssetAction / sendBatchAction）
- Redis down → fail-open（与 BL-020 F005 一致）
- env var DISABLE_AI_RATELIMIT / DISABLE_BATCH_RATELIMIT escape hatch（fail-open）
- 5 locale errorRateLimited messages

**验收：** ✅ + L2 实证
- 单测 ≥7 case via Redis testcontainer
- **L2 实证（Codex）：** staging `/api/kols/smart-match` 第 11 次请求返 `429` + `error=rate_limit_exceeded` + `Retry-After=56`

---

### F009：DB-H5+H6 kol_campaign 索引补

**Executor：** generator
**Commit：** `ac72cc9`
**文件：** `prisma/migrations/20260506000000_kol_campaign_indexes/migration.sql`（新增）、`prisma/schema.prisma`

**改动：**
- migration `CREATE INDEX CONCURRENTLY IF NOT EXISTS kol_campaign_kol_id_idx ON kol_campaign(kol_id)` + `kol_campaign_tenant_id_idx`
- schema.prisma 加 `@@index([kolId])` + `@@index([tenantId])`

**验收：** ✅ + L2 实证
- `psql -c "\d kol_campaign"` 显示两个新索引
- **L2 实证（Codex）：** staging PostgreSQL 中 `kol_campaign_kol_id_idx` 与 `kol_campaign_tenant_id_idx` 均可见

---

### F012：UX-1 KOL Discovery mock 沉底（paginator nulls 修饰符）

**Executor：** generator
**Commit：** `9a4af75`
**文件：** `src/lib/pagination/cursor.ts`、`src/lib/kol/filters.ts`（sortToOrderBy）、`src/app/[locale]/(app)/discovery/search.ts`、`src/lib/pagination/__tests__/cursor.test.ts`（新增）

**改动：**
- `cursor.ts:95` paginator orderBy shape 升级支持 `OrderBySpec = string | { field, nulls?: 'first' | 'last' }`（Prisma 6+ 语法）；caller 传 string 保持向后兼容
- discovery sort='value' 时传 `{ field: 'valueScore', nulls: 'last' }`
- 'recent' / 'followers' 保持 string（无 NULL 浮顶问题）

**验收：** ✅ + L2 实证（**用户 2026-05-05 报告闭环**）
- 单测 ≥3 case：string 向后兼容 / nulls:'last' 顶 NULL 沉底 / 默认 nulls=last
- **L2 实证（Codex）：** staging `/zh/discovery` 首屏按 valueScore 排序时，首屏为高分真实 KOL，**未见 mock KOL 顶首页**

---

### F004：API-H2 createShareTokenAction origin 服务端推导

**Executor：** generator
**Commit：** `08e46f5`
**文件：** `src/app/[locale]/(app)/weekly-report/actions.ts`、`WeeklyReportClient.tsx`、既有集成测试同步

**改动：**
- `createShareTokenAction(reportId)` 签名删 origin 客户端传参
- 服务端 `import { headers }` 推导 host 或 `process.env.NEXT_PUBLIC_SITE_URL`
- 客户端 caller 同步删 origin 传参

**验收：** ✅ + L2 实证
- `grep "createShareToken" src/` 调用方全部不传 origin
- **L2 实证（Codex）：** staging `/zh/weekly-report` 分享 toast 复制为 `https://staging.kol.guangai.ai/shared/weekly-report/...`，域名正确

---

### F005：API-H3 updateProduct + deleteProduct ownership preflight

**Executor：** generator
**Commit：** `da4e006`
**文件：** `src/app/[locale]/(app)/knowledge-base/actions.ts`、`__tests__/actions.test.ts`

**改动：**
- updateProduct + deleteProduct 加 `findUnique({ where: { id: productId } })` 后判 tenantId === session.tenantId（withTenant 已 enforce 但显式预检为 defense-in-depth）
- 跨租户访问返 `not_found`（不暴露存在与否）

**验收：** ✅（受限：staging 单 tenant，无法构造跨租户反例）
- 单测 ≥2 case 验证跨租户 PUT/DELETE 返 not_found（白盒证据充分）
- **Soft-watch S1：** staging 复验受限（仅一个 tenant），prod 启用第 2 个 tenant 后用户驱动复验

---

### F001：AUTH-H2 登录密码最小长度 1 → 12

**Executor：** generator
**Commit：** `d925121`
**文件：** `src/auth.ts`、5 locale i18n、`prisma/seed.ts`、`.auto-memory/environment.md`

**改动：**
- `auth.ts:19` `z.string().min(1)` → `z.string().min(12)`
- i18n 5 locale 加 `auth.errors.passwordTooShort`
- seed.ts 默认 SEED_ADMIN_PASSWORD 升 `KOLM@2026!` (10) → `KOLMatrix@2026!` (15)
- environment.md 测试账号字段同步

**验收：** ✅ + L2 实证
- 单测 ≥2 case：11 字符拒 / 12 字符 OK
- **L2 实证（Codex）：** staging 新密码 `KOLMatrix@2026!` 可登录；旧密码 `KOLM@2026!` 被拒，页面提示「密码至少需 12 个字符。」

---

### F002：AUTH-H5 withPlatformAdmin 普通 locale 更新收紧

**Executor：** generator
**Commit：** `0edf07e`
**文件：** `src/app/[locale]/(app)/actions.ts`

**改动：**
- updateUserLocale 当 tenantId/userId UUID 校验失败但有 email 时，先 `findUnique({ where: { email } })` 查 user，找到 → 走 `withTenant(user.tenantId, ...)`；找不到 → throw Unauthorized
- 保留 platform-admin 仅用于真正跨租户场景

**验收：** ✅
- 单测 ≥1 case 验证无效 email 返 Unauthorized
- 既有 RLS 集成测试无回归

---

### F008：AI-H4 sendBatchAction 50 → 8 + timeout 60s

**Executor：** generator
**Commit：** `52e3b4e`
**文件：** `src/app/[locale]/(app)/outreach/actions.ts`、`BatchSendDialog.tsx`

**改动：**
- batch.length > 8 → return `{ ok: false, error: "batch_too_large" }`
- Promise.race 60s timeout → return `{ ok: false, error: "timeout" }`
- 前端 BatchSendDialog 提示 8 上限
- 注释标记未来 BL-040+ BullMQ 候选

**验收：** ✅（受限：staging 数据自然不足 >8 KOL composer）
- 既有集成测试同步更新（fixtures ≤8）
- **Soft-watch S2：** staging 当前 campaign 仅 3-4 KOL，无法自然推到 >8 边界；单测白盒证据充分；prod 上线后用户驱动 ≥9 边界 manual 触发验证

---

### F011：CQ-H2/H4-H6 死代码删

**Executor：** generator
**Commit：** `60b7eb6`
**文件：** `src/lib/email/templates.ts`、`campaigns/[id]/actions.ts`、`src/lib/assets/mutations.ts`

**改动：**
- CQ-H2 删 loadUserTemplates / loadSystemTemplates（templates.ts:114-154）
- CQ-H4 删 peekAllowedStatusTransitions（campaigns/[id]/actions.ts）
- CQ-H5 处理 AssetVariantSelfReferenceError typed catch
- CQ-H6 unexport AssetVariableSchema / EmailContent / VideoScriptContent

**验收：** ✅
- grep 全仓 0 hits 验证
- 既有所有测试无回归

---

### F013：AI-1 aigcgateway actions/run KOLMatrix 端协调

**Executor：** generator
**Commit：** `2f97646`
**文件：** `src/lib/kol-detail/topic-cloud.ts`、`docs/specs/BL-035-F013-actions-run-inventory.md`（新增）、`src/lib/aigc/__tests__/actions-run-variables-wrap.test.ts`（新增）

**改动（KOLMatrix 端）：**
- `topic-cloud.ts` variables.videoTitles 数组每元素 `wrapUserInput('USER_VIDEO_TITLE', x)` 包裹（复用 BL-034 F005 已建 `xml-escape.ts`）
- 其它 actions/run 调用方 wrap 评估（BL-034 F005 customize 已加，roi/weekly/intelligence/suggestions 评估结果列于 inventory）
- inventory 文档列举 7 个 Action template 待 aigcgateway 控制台改

**验收：** ✅（受限：staging actions/run payload 日志不可外部抓）
- 单测 ≥3 case 验证 variables 传值 escape
- **L2 实证（Codex）：** staging KOL 详情页 topic cloud 渲染 OK
- **Soft-watch S3：** staging actions/run payload 不暴露 → 无法逐字核对网络层 `USER_VIDEO_TITLE` 包裹（白盒单测证据充分）；用户手工待办 #1.4 aigcgateway 控制台改 7 Action template 后 prod 真实流量验证

---

### F007：AI-H2+H3 PII 脱敏 + EmailLog 30d retention

**Executor：** generator
**Commit：** `ad601e2`
**文件：** 5 处错误抛改写、`scripts/redact-old-email-logs.ts`（新增）、`src/lib/email/resend.ts`、`scripts/__tests__/redact-old-email-logs.test.ts`（新增）

**改动：**
- AI-H2：5 处 (customize / roi/insights / weekly-report/generate / kol-database/intelligence / campaigns/suggestions) aigcgateway 错误抛 — 服务端 console.error 完整 log，客户端 throw `aigcgateway responded ${status}`（无 body slice）
- AI-H3a：`scripts/redact-old-email-logs.ts` dry-run 默认 + `--apply` 模式：30d 之前 EmailLog.bodyHtml redact 保留 metadata
- AI-H3b：`resend.ts:110-115` `[EMAIL MOCK]` 默认仅打 to + subject，env var `EMAIL_MOCK_VERBOSE=true` 才打完整 body

**验收：** ✅
- 单测 ≥2 case：dry-run 不动数据 / --apply 30d 之前行 redact
- 用户手工待办 #1.4 VPS crontab 加 daily redact

---

### F006：AI-H1 Resend bounce/complaint webhook 实装（svix 验签）

**Executor：** generator
**Commit：** `0b3557a`
**文件：** `src/app/api/webhooks/resend/route.ts`（新增）、`__tests__/route.test.ts`（新增）、`package.json` (svix 依赖)、`.env.example`

**改动：**
- POST handler + svix-signature 头验证（`Svix.Webhook.verify(body, headers)`）
- 5 event type 映射 EmailLog.status (delivered / bounced / complained / opened / clicked)
- hard bounce 命中（`event.data.bounce.type === 'permanent'`）→ withTenant set Kol.email=null + audit_log
- 验签失败 → 401（未配置 secret 时返 500，不静默接受）

**验收：** ✅ + L2 实证
- 单测 ≥5 case：valid sig 5 event type / invalid sig 401 / hard bounce 清 email + audit_log / soft bounce 不清 / 未知 event 不破
- **L2 实证（Codex）：** staging `/api/webhooks/resend` 在未配置 secret 的情况下返 500，未静默接受签名 — 防御正确
- **Soft-watch（隐含）：** F006 真实 svix 验签需要用户手工待办 #1.1+1.2 完成（SSH 落地 RESEND_WEBHOOK_SECRET + Resend Dashboard 配 webhook URL/secret）后才能 prod 真测；当前 staging 500 兜底正确

---

## 未变更范围

| 事项 | 说明 |
|---|---|
| BL-034 已覆盖项 (AUTH-H1/H3/H4/H6, AI-H5, DB-H4 等 5 项 audit HIGH) | 已落 BL-020 / BL-034，本批次不重复 |
| BL-035 spec 列推荐顺序之外的 features 调整 | 13 features 全按 spec §7 顺序实装，无范围漂移 |
| aigcgateway 控制台改 7 个 Action template | 推 user 手工待办 #1.4（Planner ops + mcp__aigc-gateway 工具，BL-035 done 后启动） |
| 既有 RLS / NULLIF / 部署链 | BL-020 / BL-034 已稳定，本批次不动 |

---

## 预期影响

| 项目 | 改动前 | 改动后 |
|---|---|---|
| AI endpoint rate-limit | 0 限制（CRIT-5 攻击面 + $100/月预算可击穿） | 6 endpoint 10/min/tenantId + 100/day（预算保护 + 突发控制） |
| sendBatch 批次上限 | 50（300s 阻塞，超 server action 60s）| 8（48s + 12s 余量） + 60s timeout |
| 登录密码最小长度 | 1（CRIT 弱密码） | 12 |
| Resend webhook | 无（硬退信无感知） | svix 验签 + 5 event 写回 EmailLog + hard bounce 清 Kol.email |
| EmailLog PII retention | 无（KOL 邮箱明文长存） | 30d 后 redact bodyHtml |
| /discovery 默认排序 | mock 12 条顶首页 | 真实高分 KOL 顶首页（用户报告闭环） |
| kol_campaign 查询 | 全表扫（KOL → campaigns 路径）| 双索引（kol_id + tenant_id） |
| fetchWithRetry retry | 无 jitter（thundering herd 风险） | (0, 250)ms jitter |

---

## 类型检查 / CI

```
npx tsc --noEmit          → 0 errors
npm run lint              → 0 errors / 3 既有 warning（无 BL-035 新增；BL-034 F007/F008 unused import 仍 Soft-watch S8 入 BL-034 signoff，本批次未顺手清）
单元测试                  → 965/965 PASS（+50 新 case：fetch-with-retry 4 + rate-limit-ai 4 + rate-limit-batch 3 + cursor 3 + actions-run-wrap 3 + redact-old-email-logs 2 + resend-webhook 5 + 集成 ≥6 endpoint × 1 case rate-limit 接入）
CI run 25373181718         → SUCCESS（c9cfed3）
deploy-staging run 25377963837 → SUCCESS（c9cfed3）
```

---

## L2 实测记录（v0.9.9 — BL-031 沉淀）

> Codex 短版 verifying notes 见 `docs/test-reports/BL-035-verifying-2026-05-05.md`。

| 项 | 证据 |
|---|---|
| Staging git_sha == main HEAD | `curl https://staging.kol.guangai.ai/api/health` → git_sha=`c9cfed3`（main HEAD `6f63c0a`，diff 仅 chore(state) progress.json paths-ignore 等价部署） |
| 端到端流验证 | F001 登录 12-char 密码 PASS / F003 smart-match 11 次 429 / F004 weekly-report 分享 toast staging 域名正确 / F006 webhook 未配 secret 500 / F009 双索引 psql 可见 / F012 discovery 真实 KOL 顶首屏 |
| 关键 invariant | 6 项 staging 端到端实证 + 3 项受限项白盒证据充分（F005 单测 / F008 单测 / F013 渲染 + 单测） |
| 浏览器手动验 | /zh/discovery valueScore 排序首屏 + /zh/weekly-report 分享 toast / /zh/login 12-char 校验提示 / KOL 详情页 topic cloud 渲染 |

> **RSC server action 类 endpoint（v0.9.11 — BL-020-F005 沉淀）：** F003 6 个 endpoint 中含 RSC server action（如 generateRoiInsightsAction），curl 不能简洁模拟全链；F003 用 `/api/kols/smart-match` route handler（可 curl）作 staging probe 代表，其它 5 处由 unit + integration testcontainer 联合背书。

---

## Ops 副作用记录（v0.9.9 — BL-030/BL-031 沉淀）

| Agent | 阶段 | 操作摘要 | 副作用对齐 | 用户授权 |
|---|---|---|---|---|
| Generator Kimi | building | scripts/redact-old-email-logs.ts dry-run 设计 | 不动数据，--apply 模式才落地；用户手工待办 #1.3 配 crontab | spec §F007 范围内 |
| Generator Kimi | building | deploy-staging.yml override NODE_ENV=development 跑 db:seed | 撞 BL-034 F002 prod-seed-guard 的边界用例（staging 跑 seed 应允许）— 修复正确，无副作用 | spec 范围内（staging deploy 链路） |
| Planner johnsong | verifying signoff | 临时担任 evaluator 完成 signoff（Codex 仅推 short verifying notes，未签 signoff） | 用户 2026-05-05 ~22:30 口头授权方案 A → harness §1.5 + 铁律 6 session_notes 记账（progress.json johnsong 条目）— 与 BL-020 / BL-034 同模式 | 用户对话 2026-05-05 ~22:30 授权 |

---

## Harness 说明

本批改动经 Harness 状态机完整流程（new → planning → building → verifying → done）交付。`progress.json` 已设为 `status: "done"`，signoff 路径已填入 `docs.signoff`。

`fix_rounds=0`（first-round PASS 模式），13 features 全 PASS / 0 PARTIAL / 0 FAIL；3 项 staging 不可闭环受限项作 Soft-watch 兜底（与 BL-020 / BL-034 同模式）。

---

## Soft-watch（不阻塞 done，需后续跟进）

| ID | 描述 | 风险等级 | 建议处置 |
|---|---|---|---|
| S1 | F005 staging 单 tenant 无法构造跨租户反例 | low | prod 上线 + 第 2 个 tenant 启用后用户驱动 manual 测 cross-tenant updateProduct/deleteProduct → not_found |
| S2 | F008 staging 数据 campaign 仅 3-4 KOL，无法自然推到 >8 batch_too_large 边界 | low | prod 上线 + 用户在 outreach composer 选 ≥9 KOL 触发 batch_too_large 提示 manual 验 |
| S3 | F013 staging 不暴露 actions/run payload 日志，无法逐字核对网络层 USER_VIDEO_TITLE 包裹 | low | aigcgateway 控制台改 7 Action template（user 手工待办 #1.4）后，prod 真实流量观察 1 周 + aigcgateway logs 抽样核对 |
| S4 | F006 真实 svix 验签需用户手工待办 #1.1+1.2 完成后 prod 真实 Resend bounce 触发验证 | medium | RESEND_WEBHOOK_SECRET 落地 + Resend Dashboard webhook 配置后，发测试邮件主动触发 hard bounce 验证 EmailLog.status + Kol.email 清空 |
| S5 | aigcgateway 控制台 7 Action template max_tokens + system prompt untrusted clause 改（F013 双路 (b)）| medium | Planner ops + mcp__aigc-gateway create_action_version + activate_version；BL-035 done 后启动；inventory 文档 `docs/specs/BL-035-F013-actions-run-inventory.md` |
| S6 | BL-034 F007/F008 unused import warning 2 个未顺手清（参 BL-034 signoff S8）| low | 下批次（BL-024 / BL-040+041）顺手清 — 1 行 edit 即可 |

---

## Framework Learnings

> 本批次无新 framework learnings — 实施过程中未暴露 v0.9.12 之外的新规律 / 新坑。

**实施过程的良性框架应用 / dogfood 验证：**

- v0.9.11 §rate-limit clause（10/min/tenantId + 100/day for AI；20/min/userId for sendBatch mutation）— F003 完整 dogfood，6 endpoint 全按矩阵分配；staging 实证 429 + Retry-After=56 工作正常
- v0.9.11 §ai-action-contract.md §4 max_tokens + XML tag — F013 KOLMatrix 端 wrap 完整 dogfood（topic-cloud videoTitles + customize 等），aigcgateway 控制台改部分推 user 手工待办（mcp__aigc-gateway 工具协调）
- v0.9.12 §pre-impl-adjudication §11 building 中段良性 partial-pending 变种 — BL-035 building 期间未触发（13 features 全顺利完成，无 spec/现实偏差），但 F013 inventory 文档（受限项 S3 / S5）记录了 actions/run 服务端配置仍依赖 aigcgateway 控制台 ops，与 v0.9.12 §11 描述场景一致
- v0.9.12 §database-patterns.md §8.1 cross-cutting helper — F003 rate-limit 不涉及 RLS migration，不直接应用
- v0.9.12 §deploy-patterns.md §5 auth-gated endpoint + bash 旧 bytecode — F006 webhook 是 svix-gated 但非 deploy script 触及；c9cfed3 deploy-staging override NODE_ENV=development 是 BL-034 F002 prod-seed-guard 边界用例的实地修，与 v0.9.12 §5 范畴相邻但不同（deploy script 与 seed.ts 守卫互动，可考虑 BL-035 done 阶段酌情扩 v0.9.12 §5 — 但用户决议「无新 framework learnings」则不入提案）
- v0.9.12 §evaluator.md §17 lint warnings 矩阵 — Reviewer 处理 BL-035 lint 0 errors / 3 既有 warning（无 BL-035 新增）按矩阵 = Soft-watch 不阻断 done；S6 入 backlog
- v0.9.11 evaluator.md §16 Node 版本一致性 — Reviewer Codex 在 staging 环境 Node 20 跑测试 + 本机会话 / CI 全 Node 20 一致，无 jsdom 类 false-positive 风险

---

## Reviewer 签收说明

- L1 已完成（Codex commit 6d70816 verifying notes 段「6 项实证 + 3 项受限」）
- L2 staging 实证（Codex 已记录 6 项 staging 端到端 + 3 项白盒兜底）
- 13 features acceptance 复核 ✅（Planner 临时担任 evaluator + 用户授权）
- Signoff 完整版本本文档（Planner 复核 + 整合 Codex 短版 verifying notes + Soft-watch 兜底 6 项）
- 决议：**first-round PASS**（fix_rounds=0），13 features 全 PASS / 0 PARTIAL / 0 FAIL；6 项 Soft-watch S1-S6 全有明文兜底；不阻塞 prod 05-13 上线波次
