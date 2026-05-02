---
name: BL-020-security-mini-batch
description: 前端审计 6 条安全整改 + 1 条 trivial UI 修复 mini-batch（CR-1/2/3 + H-S1/2/3 + UI-1）— 上线对外客户前最后硬门槛
status: drafted, awaits BIx-mvp-polish-pass done + CSP Report-Only 一周观察期满
created_by: johnsong (Planner)
created_at: 2026-05-02
estimated_effort: ~0.5-1 day Generator + 0.25 day Reviewer
features_count: 7
prerequisites:
  - BIx-mvp-polish-pass done（含 F005 perf 六件套 + CSP Report-Only 落地）
  - CSP Report-Only 一周观察期满 + violation log 收集（H-S3 切 enforce 前提）
  - prod redeploy BIx 完成（F003 error.tsx + F005 安全头基础就位）
trigger: BIx done + CSP 一周观察期满 + 用户决定启动（建议 ~2026-05-13）
---

# BL-020 — 前端审计 6 条安全整改 + 1 条 trivial UI 修复 mini-batch

## 1. 背景与目标

### 1.1 来源

- `docs/reviews/frontend-audit-2026-05-01.md`（三 agent 并行前端审计：typescript-reviewer / security-reviewer / general-purpose-performance；约 37,500 行 TS/TSX，325 文件）
- `backlog.json` BL-020（用户 2026-05-01 决议 14：6 项不进 BIx-mvp-polish-pass，单 mini-batch 排期；γ-2 决议：6 项合 1 条 backlog 条目）
- Planner 2026-05-02 全 prod (6f33a55) 排查报告（UI-1 顺手并入）

### 1.2 目标

把 2026-05-01 前端审计标定的 6 项安全 Critical/High 全部闭环 + 顺手修 1 项 trivial UI 误导，**让产品达到对外客户接触的安全底线**（OWASP 防御链 + 多租户 SaaS 隔离机制 + 登录限流 + CSP enforce）。

**Definition of Done：**
- 6 项安全（CR-1/2/3 + H-S1/2/3）全修，每项有守门 test 兜底
- UI-1 Dashboard QuickActions Campaigns 卡片可点击，无虚假 'Coming Soon' badge
- staging + prod 都 redeploy 完毕，烟测 30+ 条 checklist 全 PASS
- CSP 从 Report-Only 切 enforce，violation log 0
- signoff 报告明示「6 项安全 Critical/High + 1 项 UI 全部闭环」

### 1.3 非目标

- ❌ 安全审计余项（M-S* / L-S* 等中低优先级）—— 等真客户合规 review 触发
- ❌ /shared/weekly-report token 过期 + 撤销机制（→ BL-017）
- ❌ 跨租户 RLS audit 全代码 sweep —— 当前抽查 + assertUuid + tenantId 校验已合格，全 sweep 等审计公司介入再做
- ❌ 渗透测试 / 漏扫工具集成 —— Post-MVP infra
- ❌ 登录 2FA / SSO（产品决策，非安全债）

### 1.4 范围对照

| 项 | 类别 | 优先级 | 估时 |
|---|---|---|---|
| F001 CR-1 | productId UUID 校验 | Critical | ~30min |
| F002 CR-2 | AI 生成 URL open redirect 白名单 | Critical | ~1h |
| F003 CR-3 | dangerouslySetInnerHTML 改 client component | Critical | ~1h |
| F004 H-S1 | SQL 参数化（`$executeRaw` 替 Unsafe） | High | ~30min |
| F005 H-S2 | 登录限流（@upstash/ratelimit + Redis） | High | ~2h |
| F006 H-S3 | CSP Report-Only → enforce 切换 | High | ~1.5h |
| F007 UI-1 | Dashboard QuickActions Campaigns 修复 | Trivial | ~10min |

**总估时：** ~6.5h Generator + 2h Reviewer = ~1 day 走完

---

## 2. Features

### F001 — CR-1 productId UUID 格式校验

**Executor：** generator
**估时：** ~30min

**当前问题：**
`src/app/[locale]/(app)/knowledge-base/actions.ts:22-25` 的 `normalizeProductId()` 仅检查非空，未调 `UUID_RE.test()`。RLS 兜底 productId 不属本租户的情况，但畸形 productId 仍能进 `tx.product.update/delete`，可能触发 Prisma 异常 / 探测 schema。

**修复方案：**
```ts
// src/app/[locale]/(app)/knowledge-base/actions.ts
import { UUID_RE } from "@/lib/validation"; // 统一 UUID 校验
function normalizeProductId(raw: unknown): string {
  if (typeof raw !== "string" || !raw) {
    throw new Error("productId required");
  }
  if (!UUID_RE.test(raw)) {
    throw new Error("productId must be a valid UUID");
  }
  return raw;
}
```

**Acceptance：**
- normalizeProductId 加 UUID_RE 校验
- 守门 test：`src/app/[locale]/(app)/knowledge-base/__tests__/actions.test.ts` 加 case：非 UUID 字符串（'abc', '../../etc/passwd', SQL 注入字符串）全部 throw
- 影响面：updateProduct / deleteProduct / generateAiSuggestions 三处调用确认行为不变（合法 UUID PASS）

---

### F002 — CR-2 AI 生成 URL open redirect 白名单

**Executor：** generator
**估时：** ~1h

**当前问题：**
`src/app/[locale]/(app)/campaigns/[id]/AiSuggestionsClient.tsx:150` 把 `s.action_link`（来自 AI 响应 + localStorage 反序列化）直接渲染成 `<a href>`。攻击面：
1. AI prompt injection → 输出 `action_link: "https://evil.com/steal-session"` → 用户点击跳转钓鱼站
2. localStorage 同源 XSS 投毒（如果未来出现）→ 注入恶意 link

**修复方案：**
```ts
// src/lib/ai/safe-link.ts (新建)
const ALLOWED_PATHS = ["/campaigns", "/discovery", "/database", "/outreach"] as const;

export function sanitizeAiActionLink(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // 必须以白名单路径起头（不允许任何 absolute URL / protocol-relative / javascript:）
  for (const prefix of ALLOWED_PATHS) {
    if (raw === prefix || raw.startsWith(`${prefix}/`) || raw.startsWith(`${prefix}?`)) {
      return raw;
    }
  }
  return null; // fallback：调用方渲成纯文本 / 不渲 link
}
```

**AiSuggestionsClient.tsx 改造：**
- import sanitizeAiActionLink
- `<a href={s.action_link}>` → `{safeLink && <Link href={safeLink}>...</Link>}`
- safeLink 为 null 时渲纯文本 + tooltip "Link unavailable"

**Acceptance：**
- 新建 `src/lib/ai/safe-link.ts` + `__tests__/safe-link.test.ts`（≥ 8 case：4 白名单 PASS / 4 攻击 vector REJECT — `https://evil.com` / `//evil.com` / `javascript:alert(1)` / `/api/admin`）
- AiSuggestionsClient.tsx 全部 action_link 走 sanitize
- 守门 integration test：构造恶意 AI 响应，assert UI 不渲恶意 link
- localStorage 反序列化时也走 sanitize（防投毒）

---

### F003 — CR-3 dangerouslySetInnerHTML 改 client component

**Executor：** generator
**估时：** ~1h

**当前问题：**
`src/app/[locale]/(app)/discovery/FilterSidebar.tsx:344-347` 用 `dangerouslySetInnerHTML` 注入内联 script 来 toggle `<details>` 同步 cookie。当前注入常量字符串安全，但**反范式** —— 任何未来 refactor 改成动态 cookie 名（如读自 props）就直接 XSS。

**修复方案：**
- 拆出 `src/app/[locale]/(app)/discovery/FilterSidebarToggleSync.tsx`（'use client'）
- 在 client 组件用 `useEffect` 监听 `<details>` toggle 事件，写 cookie 走 `document.cookie`
- FilterSidebar.tsx 删 dangerouslySetInnerHTML，import 新 client 组件 mount 在 sidebar 顶层

**Acceptance：**
- 0 个 `dangerouslySetInnerHTML` 在 FilterSidebar.tsx
- 新 client component 守门 test：模拟 toggle 事件 → cookie 写入正确
- staging 浏览器走查：filter sidebar 折叠状态在刷新后保持（cookie 工作正常）
- grep 全代码 `grep -rn "dangerouslySetInnerHTML" src/` 出列表，确认没有其它反范式 inline script（如有，本批次顺手清；如有 schema.org JSON-LD 等合理用途，记录在 spec 备注）

---

### F004 — H-S1 SQL 参数化（多租户隔离核心）

**Executor：** generator
**估时：** ~30min

**当前问题：**
`src/lib/db.ts:60`：
```ts
await tx.$executeRawUnsafe(`SET LOCAL app.tenant_id = '${tenantId}'`);
```
`assertUuid(tenantId)` 兜得住，但**任何未来 caller 绕过 assertUuid 即洞开**，且这是 RLS 多租户隔离的核心 SQL，一旦失守 = 跨租户数据泄露。

**修复方案：**
```ts
// src/lib/db.ts
await tx.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`;
```
Prisma tagged template 自动参数化（PostgreSQL prepared statement），即使 tenantId 含恶意字符也无法注入。

**注意：** Postgres `SET LOCAL` 不支持参数化的标准方式（需 `SET LOCAL session_user TO 'value'` 形式）。Prisma `$executeRaw` 在此场景的实际行为需验证：
- 选项 A：`SET LOCAL app.tenant_id = ${tenantId}` 直接走 Prisma 模板（如可行，最佳）
- 选项 B：保留 `$executeRawUnsafe` 但**双重防御**：assertUuid + 显式正则 `/^[0-9a-f-]{36}$/i.test(tenantId)` 兜底，且加 unit test 覆盖所有非法字符
- 选项 C：用 `selectQueryRaw` + `pg_advisory_lock` 间接设置（代价高）

**开工前 Generator 必做：** 跑 POC 验证 A 选项，写到 generator_handoff；如不可行用 B 选项 + 加强测试覆盖。

**Acceptance：**
- A 选项 PASS：`db.ts` 0 个 `$executeRawUnsafe`
- 或 B 选项：保留 Unsafe 但加 dual-validation + assertUuid 加严（包括 length === 36 + UUID_RE + 不含 `'` / `;` / `--`）
- 守门 test：`src/lib/__tests__/db.test.ts` 加 case：非法 tenantId（`'; DROP TABLE users; --`、`abc`、null、undefined）全部 throw
- staging 跑现存 RLS integration tests 全 PASS（确认正常 tenant 切换不破）

---

### F005 — H-S2 登录限流（@upstash/ratelimit + Redis）

**Executor：** generator
**估时：** ~2h

**当前问题：**
- `src/app/[locale]/login/actions.ts` + `src/app/api/auth/[...nextauth]/route.ts` 无任何限流
- bcrypt cost=12 减缓单点尝试，但**并发请求可平行投喂**
- `/api/**` 被 middleware 排除，没法用全局限流
- 攻击场景：拿到客户邮箱后字典爆破，中等强度密码几小时即破

**修复方案：**

```ts
// src/lib/rate-limit.ts (新建)
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv(); // 复用 .env.example 已有 UPSTASH_REDIS_REST_URL/TOKEN
// 注意：项目当前 Redis 走 ioredis（BullMQ），需评估 Upstash REST API 是否可与 ioredis 共存
// 备选：用 ioredis 自实现滑动窗口（cost ~1h 多）

export const loginRatelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "15 m"), // 10 次/15 分钟/key
  analytics: true,
  prefix: "ratelimit:login",
});
```

**login/actions.ts + /api/auth 改造：**
- 提取 email + IP 作为复合 key（`${email}:${ip}` — 防同 email 多 IP 协同爆破）
- 调 `loginRatelimit.limit(key)` → `success === false` 时 throw 429（前端显示 "Too many attempts, try in 15 minutes"）
- 限流命中时记 audit log（含 email + IP + timestamp）
- middleware exclusion 不变（限流在 action 层做）

**开工前 Generator 必做：**
1. 确认项目当前 Redis 配置（`grep -rn 'REDIS' .env*` + `src/lib/queue/*.ts`）—— 走 BullMQ 用 ioredis 还是 Upstash？
2. 选 A 用 @upstash/ratelimit（如 .env.example 已有 Upstash）/ B 用 ioredis 自实现（如全部走 BullMQ Redis）
3. 写到 generator_handoff

**Acceptance：**
- 新建 `src/lib/rate-limit.ts` + `__tests__/rate-limit.test.ts`
- login/actions.ts + /api/auth 都走限流
- 守门 integration test：连续 11 次错密尝试 → 第 11 次 throw / 返回 429
- audit log 记录限流命中事件
- staging 走查：手工连点 11 次错密 → 触发限流 + 友好错误文案
- 文档：`.env.example` 加注释说明 ratelimit 配置（如需）

---

### F006 — H-S3 CSP Report-Only → enforce 切换

**Executor：** generator
**估时：** ~1.5h

**当前问题：**
- BIx F005 已落 6 个安全头 + CSP-Report-Only **一周观察期**
- 本 mini-batch 启动时观察期已满 → 切 enforce
- `/shared/weekly-report/[token]` 公开页缺 X-Frame-Options（已在 F005 落）→ 核对生效

**修复方案：**

**Step 1：观察期 violation log 分析**
- 收 `report-uri` 一周日志（路径：BIx F005 配置）
- 分类：
  - 合法第三方（YouTube / Twitch CDN 等 - 加白名单）
  - 内部代码反范式（移除 inline script / inline style）
  - 已修复 / 不再触发（删旧 violation）
- 输出 `docs/test-reports/BL-020-csp-violations-analysis.md`（observation period summary）

**Step 2：next.config.ts 改造**
```ts
// next.config.ts
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js 必需 unsafe-inline for hydration; 评估 nonce 替代
  "style-src 'self' 'unsafe-inline'", // Tailwind + Material Symbols inline
  "img-src 'self' data: https://*.ytimg.com https://*.twitch.tv https://*.tiktokcdn.com https://*.bilivideo.com",
  "font-src 'self'",
  "connect-src 'self' https://aigcgateway.example.com", // aigcgateway 域名
  "frame-ancestors 'none'", // 防 clickjacking
  "form-action 'self'",
  "base-uri 'self'",
  "report-uri /api/csp-report",
].join("; ");

// Content-Security-Policy（取消 -Report-Only 后缀）
{ key: "Content-Security-Policy", value: csp }
```

**Step 3：守门测试**
- 重启 staging，跑 E2E 烟测全套（11 页 + 关键 form / dialog）
- 确认浏览器 DevTools Console 0 个 CSP violation
- prod redeploy 后跑同样烟测

**Acceptance：**
- next.config.ts CSP enforce 落地
- violation log 一周 0 条 false positive 后才切（如有 false positive 加白名单或修代码）
- E2E 跑 staging + prod 全 PASS
- `docs/test-reports/BL-020-csp-violations-analysis.md` 报告
- /shared/weekly-report/[token] 公开页核对 X-Frame-Options + frame-ancestors 双重防御 clickjacking

**风险：** Next.js 16 部分场景需 inline script（hydration / RSC）→ 'unsafe-inline' 退一步；未来切 nonce 化是单独 backlog（CR-7 等）

---

### F007 — UI-1 Dashboard QuickActions Campaigns 卡片修复

**Executor：** generator
**估时：** ~10min

**当前问题：**
- `src/features/dashboard/QuickActions.tsx:25`：`{ key: "campaigns", href: null, ... }` + 'Coming Soon' badge
- 但 /campaigns 实际已上线（侧栏可正常进入），QuickActions 卡片对用户造成虚假 'coming' 误导
- 2026-05-02 Planner 全 prod 排查发现

**修复方案：**
```ts
// src/features/dashboard/QuickActions.tsx:25
- { key: "campaigns", href: null, icon: "rocket_launch", tone: "neutral" },
+ { key: "campaigns", href: "/campaigns", icon: "rocket_launch", tone: "purple" },
```
- 删 'Coming Soon' badge 渲染分支（如代码中 `if (a.href === null)` 渲 badge 那一段）
- tone 从 "neutral"（灰）改 "purple" 与其它激活卡片一致
- i18n keys 不动（key=campaigns / campaignsDescription 已存在）

**Acceptance：**
- 4 个 QuickActions 卡片全部含可点击 href
- 守门 test：`src/features/dashboard/__tests__/QuickActions.test.tsx`（可能新建）assert 4 个卡片全部渲 `<Link>` 且 href 非空
- staging 走查：dashboard 4 卡全可点跳转
- visual baseline 重生（QuickActions 视觉变化）

---

## 3. 依赖与执行顺序

### 3.1 前置依赖

1. **BIx-mvp-polish-pass done**（含 F005 perf 六件套 + CSP Report-Only 落地）
2. **prod redeploy BIx 完成** —— 否则 F003 error.tsx 缺失会让本批次 staging 烟测失真
3. **CSP Report-Only 一周观察期满** —— F006 切 enforce 的硬前提；如 BIx 落地日 +7 < 本批次启动日，可立切

### 3.2 推荐执行顺序

按"独立性 → 影响面"排序，避免互相干扰：

1. **F007 UI-1**（10min，最简单，立刻消除 UI 误导）
2. **F001 CR-1**（30min，独立改 1 文件 + 1 test）
3. **F004 H-S1**（30min，独立改 1 文件，但需 POC 验证 Prisma tagged template 在 SET LOCAL 可行）
4. **F003 CR-3**（1h，独立 client component 拆分）
5. **F002 CR-2**（1h，新建 sanitize lib + AiSuggestionsClient 改造）
6. **F005 H-S2**（2h，最大改动，新建 rate-limit lib + login flow 改造，需先决 Upstash vs ioredis）
7. **F006 H-S3**（1.5h，最后做 — 因为前面修代码会消化部分 CSP violation）

### 3.3 阻断点与裁决

- **F004 选项 A vs B**：开工前 POC，结果写到 generator_handoff；如 POC 失败用 B + 加强 assertUuid
- **F005 Upstash vs ioredis**：开工前 grep 项目 Redis 配置；ioredis 自实现成本 +1h 但更一致

---

## 4. 验收标准（Reviewer L1 + L2）

### 4.1 L1 自动化（typecheck + tests + lint）

- `npm run lint` 0 error
- `npx tsc --noEmit` 0 error
- `npm test` 全 PASS（含本批次新增 ≥ 6 个守门测试集）
- `npm run build` 成功

### 4.2 L2 staging 走查（30+ 条 checklist）

**安全头与 CSP（10 条）：**
- [ ] curl -I staging 6 头全在
- [ ] CSP `Content-Security-Policy` 而非 `-Report-Only`
- [ ] DevTools Console 跑 11 页全无 CSP violation
- [ ] `/shared/weekly-report/[token]` 公开页 X-Frame-Options + frame-ancestors 双兜底
- [ ] 加白名单的 CDN 域名（YouTube/Twitch/TikTok/Bilibili）图片正常加载
- [ ] aigcgateway connect-src 白名单生效（AI 调用不被 CSP 拦）
- [ ] HSTS 头 `max-age >= 31536000`
- [ ] X-Frame-Options: DENY
- [ ] X-Content-Type-Options: nosniff
- [ ] Referrer-Policy 与 Permissions-Policy 与 BIx F005 一致

**功能性安全（10 条）：**
- [ ] knowledge-base updateProduct/deleteProduct 用畸形 productId 抛错
- [ ] AiSuggestionsClient action_link 含 `https://evil.com` 时 fallback 不渲 link
- [ ] discovery FilterSidebar 折叠状态刷新后保持（cookie 工作）
- [ ] 多租户切换正常（RLS integration tests PASS）
- [ ] 登录连续 11 次错密 → 第 11 次返回 429 + 友好文案
- [ ] 限流 audit log 写入 PASS
- [ ] 限流 15 分钟后自动恢复
- [ ] dashboard QuickActions 4 卡全可点 + 跳转正确
- [ ] /campaigns 进入路径双向 OK（侧栏 + dashboard QuickActions）
- [ ] 守门 tests 全 PASS

**烟测覆盖性（10+ 条）：** 11 页 critical paths + 关键 form / dialog 全跑通无 console error

### 4.3 prod redeploy 后烟测

同 staging 30+ 条 checklist 重跑 prod。

---

## 5. 风险与回滚

| 风险 | 概率 | 影响 | 缓解 |
|---|---|---|---|
| F006 CSP enforce 切完出现未识别 violation 阻塞用户 | 中 | 高（页面假死）| 留 1h 缓冲：发现 violation 立切回 Report-Only + 修代码 + 再切 enforce |
| F005 Upstash vs ioredis 决策错误 | 低 | 中 | 开工前 POC + generator_handoff 落地 |
| F004 Prisma tagged template 不支持 SET LOCAL | 中 | 中 | 选项 B 兜底（双重 validation） |
| F002 sanitizeAiActionLink 误杀合法 link | 低 | 低 | 守门 test 覆盖 8 case + staging AI 实跑验证 |
| F005 限流误杀真实用户（多人共享 IP） | 低 | 中 | key 用 email+IP 复合 + 滑动窗口 + 友好错误文案引导用户 |

**回滚预案：**
- F006 CSP 切 enforce 出问题 → 一行 config 切回 `-Report-Only`
- F005 限流误杀 → 临时 limiter 改 100 次/15min 拉宽 + 排查
- F004 RLS 切换失败 → revert single commit（独立改动）

---

## 6. 时间线

| 日期 | 里程碑 |
|---|---|
| 2026-05-02 | spec drafted（本文档） |
| ~2026-05-12 | BIx-mvp-polish-pass done + prod redeploy |
| ~2026-05-12 | CSP Report-Only 观察期开始（F005 落地日 +7） |
| ~2026-05-13 | BL-020 启动（CSP 观察期满后 1 day buffer） |
| ~2026-05-14 | BL-020 done + prod redeploy → **上线对外客户准备就绪** |

---

## 7. 后续 backlog 触发

完成后更新 backlog.json：
- BL-020 移除（done）
- BL-023 KOL 评分体系升级（前置依赖：BL-020 done + BIx F004 done） → 可启动
- BL-024 B4 ghost-controls 实装（前置：BL-020 done） → 可启动

**下一批次候选（按用户决策）：**
1. **BL-024 ghost-controls 实装**（~2-3 day，对外客户前必要）
2. **BL-023 KOL 评分体系升级**（~6-7h，产品差异化）
3. **BL-021 Suspense 边界**（~2-4h，依团队反馈）

---

## 8. 决策记录

| 决策 | 时间 | 来源 |
|---|---|---|
| 6 项不进 BIx，单独 mini-batch | 2026-05-01 | 用户决议 14（团队内部 demo 风险低） |
| 6 项合 1 条 backlog 条目（紧凑排期） | 2026-05-01 | 用户决议 (γ-2) |
| CSP enforce 切换属本批次 acceptance | 2026-05-01 | spec §F006 |
| UI-1 QuickActions 修复并入本批次顺手做 | 2026-05-02 | 用户决议（Planner 2026-05-02 全 prod 排查后） |

## 9. 参考文档

- `docs/reviews/frontend-audit-2026-05-01.md` —— 三 agent 并行审计原始报告
- `docs/specs/BIx-mvp-polish-pass-spec.md` §F005 —— CSP Report-Only 落地范式
- `framework/harness/deploy-patterns.md` —— prod redeploy 完整链 checklist
- `backlog.json` BL-020 —— 本批次 backlog 条目（已含 UI-1）
