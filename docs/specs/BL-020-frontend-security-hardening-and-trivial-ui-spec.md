# BL-020 — 前端安全整改 6 项 + UI 修复 2 项 mini-batch

> 状态：**待 Generator 实现**（progress.json status=building）
> 触发：`docs/reviews/prod-mvp-readiness-audit-2026-05-04.md` §3 锁定的 8 项 prod 上线前必修；2026-05-01 frontend-audit 三 agent 并行审计原始来源。
> Q1-Q3 用户决策（2026-05-04）：CSP 单 commit + 1 周 staging 观察 / rate-limit 仅 login 起步 / F005 含 Redis infra 全栈装 ioredis。

---

## 1. 背景

prod 当前 sha `260d1e4 → 8ef1b22` 已含 BL-025-033 所有功能修，但 audit §3 列出 8 项**对外客户邀请前必修**的安全 / 可用性 gap，全部锁文件:行验证未修：

| 池 | 编号 | 文件 | 影响 |
|---|---|---|---|
| Critical | CR-1 | knowledge-base/actions.ts:19-23 | productId 缺 UUID 格式校验，恶意 ID 可触发 Prisma 异常 / RLS 边界探测 |
| Critical | CR-2 | campaigns/[id]/AiSuggestionsClient.tsx:150 | AI 生成 URL 仅查 startsWith('/')，潜在 open redirect / 路径污染 |
| Critical | CR-3 | discovery/FilterSidebar.tsx:344 | dangerouslySetInnerHTML 反范式（当前常量安全，但留隐患）|
| High | H-S1 | src/lib/db.ts:60 | SQL 注入兜底单点 — assertUuid 验证后才 string-template，跳过 assertUuid 即洞开 |
| High | H-S2 | login/actions.ts | 无 rate-limit；bcrypt cost=12 减缓单点，并发请求可平行投喂 |
| High | H-S3 | next.config.ts:68-71 | CSP 仍 Report-Only（注释 `(BL-020) will flip this to Content-Security-Policy once`）|
| UI | UI-1 | features/dashboard/QuickActions.tsx:25 | Dashboard Campaigns 卡 href:null + Coming soon，但 /campaigns 已上线 |
| UI | UI-2 | src/lib/kol/filters.ts:387 buildKolWhere | 12 demo_seed mock KOL prod /discovery 直接暴露，对外不专业 |

### 1.1 Definition of Done

- [ ] 8 features 全 PASS + Reviewer L1+L2 + prod redeploy
- [ ] CR-1 浏览器手验：/zh/knowledge-base 调编辑 productId 字符串污染 attempt 被服务端拒绝（401 + invalid_input）
- [ ] CR-2 AI suggestions 渲染 attempt URL `//evil.com/path` `javascript:alert(1)` `/../admin` → 全 fallback 到 `/campaigns`
- [ ] CR-3 grep `dangerouslySetInnerHTML` in src/ 返回 0 行
- [ ] H-S1 ✓ withTenant 用 set_config + 参数化；assertUuid 保留作 defense-in-depth；integration 测试 RLS 仍 enforce
- [ ] H-S2 staging 部署后 5 次 login fail/min 后第 6 次返回 429；Redis 通信可见 health endpoint
- [ ] H-S3 staging 部署后 1 周观察 violation report；prod redeploy 后 CSP enforce 生效（DevTools Console 不报新 violation）
- [ ] UI-1 浏览器手验：/zh/dashboard QuickActions Campaigns 卡可点击跳 /zh/campaigns
- [ ] UI-2 prod /discovery 列表不含 12 demo_seed mock KOL（含 emailSource='demo_seed'）；staging 仍可见

---

## 2. 关键设计决策（Planner 已锁，Generator 不得变更）

### D1 — F004 H-S1 SQL 注入参数化技术路径（v0.9.9 铁律 1 实地核查后）

**问题：** `tx.$executeRawUnsafe(\`SET LOCAL app.tenant_id = '${tenantId}'\`)` 字符串模板插值，依赖 assertUuid 兜底。绕过 assertUuid → 注入风险。

**修法：用 PostgreSQL `set_config()` 函数 + Prisma `$executeRaw` 参数化**

```ts
// 当前（src/lib/db.ts:60）：
await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);

// 改为：
await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
//                                                                 ^^^ true = LOCAL scope（事务内）
```

**为什么 set_config 而不是参数化 SET LOCAL：** Postgres `SET LOCAL <name> = <value>` 中 `<name>` 是 SQL 标识符（不能参数化），`<value>` 也只接受字面量；无法用 prepared statement。`set_config(name, value, is_local)` 是 Postgres 内建函数 — 三参数全可参数化（name 也是 text 字符串）。

**等价语义验证：** `set_config('foo', 'bar', true)` 与 `SET LOCAL foo = 'bar'` 在 RLS 上下文中完全等价 — 后续 `current_setting('foo', true)` 都返回 'bar'。

**保留 `assertUuid(tenantId, "tenantId")` 作 defense-in-depth** — 应用层格式校验仍跑，作为第二层防线（参数化 = 第一层 SQL 防线）。

**withPlatformAdmin 同步修法（line 72-79）：** `tx.$executeRawUnsafe(\`SET LOCAL app.is_platform_admin = 'true'\`)` 改 `tx.$executeRaw\`SELECT set_config('app.is_platform_admin', 'true', true)\``。

### D2 — F002 CR-2 AI URL 路径白名单实装

**新建 `src/lib/ai/safe-link.ts`：**

```ts
// 白名单路径 regex（locale prefix 由调用方加）
const SAFE_PATH_RE = /^\/(?:campaigns(?:\/[a-z0-9-]+)?|kols\/[a-z0-9-]+|assets(?:\?[a-zA-Z0-9_=&-]*)?|outreach|database|knowledge-base)$/;

export function safeAiActionLink(actionLink: unknown): string {
  if (typeof actionLink !== "string") return "/campaigns";
  // 拒绝 protocol-relative / absolute external URLs
  if (actionLink.startsWith("//") || /^[a-z]+:/i.test(actionLink)) return "/campaigns";
  if (!actionLink.startsWith("/")) return "/campaigns";
  // 拒绝 path traversal
  if (actionLink.includes("..")) return "/campaigns";
  // 白名单匹配
  if (!SAFE_PATH_RE.test(actionLink)) return "/campaigns";
  return actionLink;
}
```

**调用方改造（AiSuggestionsClient.tsx:150）：**

```tsx
import { safeAiActionLink } from "@/lib/ai/safe-link";
// ...
href={`/${locale}${safeAiActionLink(s.action_link)}`}
```

**测试 ≥ 6 case：** valid /campaigns / valid /campaigns/{cuid} / `//evil.com` fallback / `javascript:alert(1)` fallback / `/../admin` fallback / 空字符串 fallback / 非字符串 fallback。

### D3 — F005 H-S2 Rate-limit 技术栈（含 Redis infra 全栈）

**新增依赖：**

```bash
npm install ioredis rate-limiter-flexible
```

**`ioredis` 选型理由：** self-hosted Redis（per `environment.md`，prod db idx 1 / staging db idx 2）+ TCP 连接最稳；与 BullMQ 兼容（CLAUDE.md tech stack 列了 BullMQ，未来队列也用此 client）。

**`rate-limiter-flexible` 选型理由：** 支持 ioredis backing；sliding-window 算法成熟；fail-open by default 配合自定义 rejection（Redis 挂时不锁死登录路径）。

**新建 `src/lib/redis.ts`（shared client，~30 行）：**

```ts
import IORedis from 'ioredis';

let _client: IORedis | null = null;

export function getRedis(): IORedis {
  if (_client) return _client;
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL not configured");
  _client = new IORedis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => Math.min(times * 200, 2000),
    lazyConnect: false,
    enableReadyCheck: true,
  });
  _client.on('error', (err) => console.error('[redis] error:', err.message));
  return _client;
}

export async function pingRedis(): Promise<{ ok: boolean; latencyMs?: number; error?: string }> {
  try {
    const t0 = Date.now();
    await getRedis().ping();
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "unknown" };
  }
}
```

**`src/app/api/health/route.ts` 修订** — `redis.status` 字段从 hardcoded `"not_used"` 改为调 `pingRedis()`。返回 `"ok" | "error"` + `latencyMs`。

**新建 `src/lib/rate-limit.ts`：**

```ts
import { RateLimiterRedis } from 'rate-limiter-flexible';
import { getRedis } from './redis';

const loginLimiter = new RateLimiterRedis({
  storeClient: getRedis(),
  keyPrefix: 'rl:login',
  points: 5,           // 5 attempts
  duration: 60,        // per 60s
  blockDuration: 300,  // 5min block after limit hit
});

export async function rateLimitLogin(ip: string): Promise<
  | { ok: true; remaining: number }
  | { ok: false; retryAfter: number }
> {
  try {
    const r = await loginLimiter.consume(ip, 1);
    return { ok: true, remaining: r.remainingPoints };
  } catch (rej: any) {
    if (rej && typeof rej.msBeforeNext === 'number') {
      return { ok: false, retryAfter: Math.ceil(rej.msBeforeNext / 1000) };
    }
    // Redis down → fail-open（不锁死登录），但记录告警
    console.warn('[rateLimitLogin] Redis unavailable, failing open');
    return { ok: true, remaining: -1 };
  }
}
```

**`login/actions.ts` 接入：**

```ts
import { headers } from 'next/headers';
import { rateLimitLogin } from '@/lib/rate-limit';

// 在 credentials 校验前
const ip = (await headers()).get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
const rl = await rateLimitLogin(ip);
if (!rl.ok) {
  return { ok: false, error: `Too many attempts. Retry after ${rl.retryAfter}s.` };
}
// 后续 bcrypt 校验...
```

**注意：** rate-limit **在 bcrypt 之前** — 否则 attacker 仍能消耗 CPU。

**测试：integration（用 testcontainer Redis）：**
- 5 连续 fail → 第 6 次返 retryAfter
- 等 60s 后窗口重置
- Redis 模拟 disconnect → fail-open 不锁死

**v0.9.10 evaluator §15 注意：** L1 跑 tsc 前必先 `prisma generate`（虽本批次无 schema 改但保险）。

### D4 — F006 H-S3 CSP enforce 切换 + 部署 2 阶段

**变更（`next.config.ts:68-78`）：**

```diff
-          // (BL-020) will flip this to `Content-Security-Policy` once
-          // we've validated the directives in staging.
+          // CSP enforce mode (v0.9.10+ — BL-020-F006 切换 2026-05-04，
+          // staging 已观察 1 周无 violation)
           {
-            key: "Content-Security-Policy-Report-Only",
+            key: "Content-Security-Policy",
             value: [/* 现有 directives 不动 */].join("; "),
           },
```

**部署 2 阶段（spec §6 详）：**

1. **Step A（Generator commit）：** next.config.ts 切 enforce + 部署 staging
2. **Step B（用户驱动 1 周观察期）：**
   - 用户/Reviewer 在 1 周内多次访问 staging（含管理员 + 普通用户路径），DevTools Console 不应见 CSP violation 报错
   - 若发现 violation：标 fix_rounds++，Generator 调 directives；不影响其它 7 features done 推进
   - 若 1 周无 violation：用户主动 prod redeploy，BL-020 完整闭环
3. **Reviewer 验收策略：** L2 不卡 1 周观察期 — 切 enforce 当下 + staging deploy 健康 + 5min 浏览器主路径 walk 无 violation = PASS。1 周后续观察作 Soft-watch 入项目状态。

### D5 — F008 UI-2 demo_seed 过滤实装（env-var 控制）

**新 env var：** `HIDE_DEMO_SEED_KOLS=true`（prod 必设，staging 不设保留 demo 流）

**`src/lib/kol/filters.ts buildKolWhere`（line 388 AND 数组追加）：**

```ts
if (process.env.HIDE_DEMO_SEED_KOLS === "true") {
  and.push({ emailSource: { not: "demo_seed" } });
}
```

**`.env.example` 加：**
```
HIDE_DEMO_SEED_KOLS="false"  # set to "true" in production to hide demo_seed mock KOLs
```

**用户操作：** Generator commit + push 后，用户 SSH prod：
```bash
ssh tripplezhou@34.180.93.185
sudo -u root sh -c "echo 'HIDE_DEMO_SEED_KOLS=true' >> /opt/kolmatrix/.env.production"
pm2 reload kolmatrix --update-env
```

**测试：** 单测 ≥ 2 case：env=true 时 where AND 含 demo_seed not / env=false 时 AND 不含此条件。

### D6 — F003 CR-3 dangerouslySetInnerHTML 修法

**`src/app/[locale]/(app)/discovery/FilterSidebar.tsx:344`** 检查当前 inline 是 `<style>` 注入还是 HTML 注入：

- 若是 `<style>` 标签注入（如 hover 效果）→ 改用 Tailwind class 或 styled-jsx
- 若是 HTML 文本节点 → 改用 React children
- 若是 SVG raw → 改用 `<svg>` JSX

**Generator 在 building 中读取 line 344 上下文决定具体方式**；spec 不锁实现细节，仅约束"grep dangerouslySetInnerHTML in src/ 0 hits"。

### D7 — F001 / F007 / 既有测试影响

- F001（normalizeProductId 加 UUID_RE）：`knowledge-base/__tests__/actions.test.ts` 既有 case 多数用 valid uuid 不破，但 patch test 加 ≥3 case
- F007（Dashboard Campaigns href）：可能影响 dashboard 既有快照测试，需同步更新

### D8 — F005 Redis 接入风险与回滚

**风险：** `getRedis()` 首次调用阻塞约 100-500ms 等连接（lazyConnect:false 模式）；prod login 路径添加 Redis call 增 ~20-50ms latency（acceptable）；Redis 完全挂 → fail-open 不锁死登录但失保护（这是设计取舍）。

**回滚：** 若 Redis 接入触发 prod 故障，临时用 env var 关闭 rate-limit：

```ts
// rate-limit.ts 加 short-circuit
if (process.env.DISABLE_LOGIN_RATELIMIT === "true") return { ok: true, remaining: -1 };
```

写入 spec 接受此 escape hatch；用户可在 prod .env 加此变量临时禁用。

---

## 3. Files

**新增：**
- `src/lib/ai/safe-link.ts`（F002）
- `src/lib/ai/__tests__/safe-link.test.ts`（F002 — 6+ case）
- `src/lib/redis.ts`（F005）
- `src/lib/rate-limit.ts`（F005）
- `src/lib/__tests__/rate-limit.test.ts`（F005 — testcontainer 4+ case）

**修改：**
- `src/app/[locale]/(app)/knowledge-base/actions.ts`（F001 — normalizeProductId 加 UUID_RE）
- `src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts`（F001 — +3 case）
- `src/app/[locale]/(app)/campaigns/[id]/AiSuggestionsClient.tsx`（F002 — 用 safeAiActionLink）
- `src/app/[locale]/(app)/discovery/FilterSidebar.tsx`（F003 — 删 dangerouslySetInnerHTML）
- `src/lib/db.ts`（F004 — withTenant + withPlatformAdmin 改 set_config 参数化）
- `src/lib/__tests__/db.test.ts`（F004 — RLS 仍 enforce 验证）
- `src/app/[locale]/login/actions.ts` 或同等路径（F005 — rate-limit 接入）
- `src/app/[locale]/login/__tests__/actions.test.ts`（F005 — rate-limit 集成）
- `src/app/api/health/route.ts`（F005 — Redis ping 改 not_used → ok/error）
- `src/app/api/health/__tests__/route.test.ts`（F005 — fixture 改）
- `next.config.ts`（F006 — CSP enforce 切换）
- `src/features/dashboard/QuickActions.tsx`（F007 — campaigns href "/campaigns"）
- `src/features/dashboard/__tests__/QuickActions.test.tsx`（F007 — 快照同步）
- `src/lib/kol/filters.ts`（F008 — env-var 过滤 demo_seed）
- `src/lib/kol/__tests__/filters.test.ts`（F008 — 2+ case）
- `.env.example`（F008 — HIDE_DEMO_SEED_KOLS docstring）
- `package.json` + `package-lock.json`（F005 — 加 ioredis + rate-limiter-flexible）

---

## 4. Out of scope

- F005 多种 rate-limit 维度（仅 login，不含 register / reset / API rate-limit）— Q2=A
- F005 BullMQ 队列基础设施（虽用 ioredis 装好可直接接 BullMQ，但 BL-020 不实装队列任务）
- F006 CSP report-uri 收集 endpoint（当前不需要 — 用户/Reviewer DevTools Console 观察足够；如未来需要，再做独立 batch）
- 其它 BL-020 文档未列的安全项（如 CSRF token / X-Content-Type-Options 等）— 已有的不动，未提的不加
- prod DB seed 状态澄清（已在 environment.md 改）— BL-020 不动

---

## 5. 风险

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| F004 set_config 与 SET LOCAL RLS 不等价（极小概率，Postgres 文档明确等价）| very low | critical（RLS 失效）| integration test 必跑 — withTenant 写 row → 切其它 tenant 读不到；现有 RLS 测试套不改即可发现 |
| F005 Redis 在 prod 接入触发现有 worker / cron / health 副作用 | low | medium | 现有代码 0 个 Redis 引用（确认 grep），新增 wiring 隔离；health endpoint 加监控 |
| F005 rate-limiter-flexible 与 ioredis 版本不兼容 | very low | low | npm install 时锁版本；测试覆盖核心路径 |
| F006 CSP enforce 误伤合法第三方资源（如 Google Fonts / inline scripts）| medium | medium | staging 1 周观察期专门为此；当前 CSP directives 列表已在 next.config.ts，未变只是 mode 切换；通常 Report-Only 已发现的 violation = 切 enforce 后的 violation |
| F007 dashboard 快照测试大批量更新 | low | low | 与 F004 + F005 testing 同同步；fixture 同 commit 改 |
| F008 staging 默认无 HIDE_DEMO_SEED_KOLS 但被误以为生效 | low | low | spec §部署明确两环境 env var 期望值；用户 SSH 时复述 |

---

## 6. 部署顺序（用户操作）

### 6.1 Step A — 1 阶段（与 redeploy）

1. BL-020 done + Reviewer 签收（注意 F006 CSP Reviewer L2 不卡 1 周观察期，标 Soft-watch）
2. SSH prod: 加 `HIDE_DEMO_SEED_KOLS=true` 到 `.env.production`（F008）
3. GitHub Actions → Deploy to Production → main
4. SSH prod: `pm2 reload kolmatrix --update-env`（让新 env var 生效）

### 6.2 Step B — 浏览器 + endpoint 验证

- `/api/health` 返回 `redis.status: "ok"` + `latencyMs` ≤ 5
- /zh/discovery KOL 列表 N <= prev_N - 12（demo_seed 过滤生效）
- /zh/dashboard QuickActions Campaigns 卡可点击 → /zh/campaigns
- 5 次故意输错登录密码 → 第 6 次见 "Too many attempts. Retry after Ns."
- 主路径浏览（/dashboard /knowledge-base /assets /outreach /campaigns /discovery）DevTools Console 无 CSP violation

### 6.3 Step C — F006 CSP 1 周观察期（用户 SSH 监控）

- 在 1 周内多次跑 Step B 主路径
- 若 Console 见 violation，提 fix_rounds++ 让 Generator 调 directives
- 1 周无问题 → 项目状态删除此 Soft-watch，BL-020 完整闭环

---

## 7. v0.9.10 framework checklist 复跑（Planner 起草自查）

- [x] §i18n 命名空间扩展双门 — 不适用（无 i18n 改动）
- [x] §上线前 audit 触发条件 — BL-020 done 后可触发新 audit（在邀请客户前）
- [x] §planner.md 铁律 1 spec 涉及代码细节 — F004 `set_config` Postgres 文档 verify
- [x] §planner.md 铁律 3 spec 写 docs 路径前 ls — 无新 docs 改动
- [x] §planner.md 铁律 5 ops 绕 mutation 副作用 — 不适用（无 ops 步骤）
- [x] §evaluator.md §15 L1 prisma generate 前置 — 已在 Reviewer 接手须知段（progress.json generator_handoff）

来源： `framework/CHANGELOG.md` v0.9.10 全条目。
