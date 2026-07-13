# Web 运行时与依赖 Patterns（框架沉淀）

> 原为 `harness/generator.md` §8-§9，v1.0 重构移入 patterns/。Generator 在实装涉及 npm 预发布依赖、反向代理后 URL 构造的 feature 时必读。

---

## 1. Alpha / Beta / RC 依赖必须 ambient `.d.ts` shim 兜底

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

## 2. Next.js standalone 模式 `request.url` 的 origin 取监听地址，反代后须从 forwarded headers 推导（v0.9.21 — aigcgateway BL-IMG-PERSIST-GCS 沉淀）

**背景：** Next.js **standalone 输出模式**（`output: "standalone"`）下，route handler 里 `new URL(request.url).origin` 取的是**进程监听地址**（如 `0.0.0.0:3000` / `localhost:port`），**无视 `Host` 头**。任何据此构造对外**绝对 URL** 的代码，在反向代理（nginx / LB）后都会生成客户端不可达的地址。

**典型受害场景：**

- 签名图片 / 文件代理 URL（返回给客户端去 GET）
- webhook 回调地址、邮件 / 通知里的深链
- OAuth redirect_uri、分享链接

**规律：** 构造对外绝对 URL 必须从转发头推导公网 origin，而非 `request.url`：

```typescript
function resolveRequestOrigin(request: Request): string {
  const h = request.headers;
  const xfHost = h.get("x-forwarded-host") ?? h.get("host");
  if (xfHost) {
    const proto = h.get("x-forwarded-proto")
      ?? (xfHost.startsWith("localhost") || xfHost.startsWith("127.") ? "http" : "https");
    return `${proto}://${xfHost}`;
  }
  return process.env.NEXT_PUBLIC_GATEWAY_ORIGIN
    ?? process.env.SITE_URL
    ?? new URL(request.url).origin; // 最后兜底
}
```

**前置确认：** 反代须转发 `proxy_set_header Host $host;` + `proxy_set_header X-Forwarded-Proto $scheme;`（否则推导仍失真）。

**反面：** aigcgateway BL-IMG-PERSIST-GCS fix_round1 — 图片代理签发 URL origin=`0.0.0.0:3000` → 客户端不可达 → Evaluator FAIL → fix_round1 才加 `resolveRequestOrigin`（commit 400f2af）。

来源：aigcgateway BL-IMG-PERSIST-GCS fix_round1。

---

## 3. 背景任务队列 MVP → BullMQ 升级路径（KOLMatrix BL-067 F005 / BL-068 / BL-100 / BL-086）

适用于 PM2 single-instance cluster=1 架构，不引 Redis 就能异步跑 LLM / 后台任务的完整决策树 + 升级触发条件。

**模式核心（InMemoryJobQueue + fire-and-forget + mount self-heal）：**

1. **server action `void jobQueue.add(name, payload, { idempotencyKey, delay: 1 })`** — 让任务异步跑入下一 tick，server action 立即 return 不阻塞 mount
2. **进程重启丢 prewarm** — 由用户重 enter 页面触发 mount self-heal 自然恢复
3. **idempotencyKey 同进程内幂等防重** — 防止 mount race condition 重复 enqueue
4. **worker concurrency 由 setTimeout 隐式 1** — 不并发，简化错误处理

**升 BullMQ 的触发条件（任一命中）：**

- (a) PM2 reload 频次 > 2 次/day（重启丢任务 UX 影响）
- (b) scale-out 到 cluster>1（in-memory 不跨进程）
- (c) job 处理时间 > 60s 致 mount→short 完成延迟感知（用户重 enter 页面已超过预期）

**反面适用：** 不适用于「必须可靠交付」类 job（如付款回调 / 关键业务事件 — 需 BullMQ Redis 持久化）。

**实战案例：** BL-067 F005 InMemoryJobQueue 实装支持 prewarm 异步执行（探索类查询，丢失可重试）；BL-068 +1 caller 沿用。Spec acceptance 措辞模板：「场景 P95 latency 容忍 = 用户 mount self-heal 即可恢复（fire-and-forget MVP）」/「BullMQ 升级条件触发后启独立 batch」。

来源：KOLMatrix BL-067 F005 实战 + v0.9.22 #5。

### 3.1 升 BullMQ 连接拓扑铁律（BL-100 F001/F003）

把 InMemoryJobQueue swap 成真 BullMQ（同 JobQueue 接口）的三条铁律：

1. **Worker 连接必须 `maxRetriesPerRequest: null`** — BullMQ v5 Worker 用阻塞命令（BRPOPLPUSH/BZPOPMIN），connection 非 null 直接抛错。普通 `getRedis()`（rate-limit/health 用 retries:3）**不能复用给 Worker**；新增独立 `getBullConnection()`（`retries:null` + `enableReadyCheck:false`），Queue 生产者共享它，**每个 Worker 用 `.duplicate()`** 拿专用阻塞连接（阻塞 socket 不能与生产者 socket 混用）。spec/ADR 写「以 getRedis() 为后端」应理解为「同 Redis 实例」而非「同 client 对象」。
2. **enqueue fast-fail 用 timeout race，不依赖 retries** — `retries:null` 让 `queue.add()` 在 Redis 挂时无限重试不返回，与「入队失败→回退同步发」矛盾。解法：`add()` 内 `Promise.race` 包 5s timeout 强制 reject，上层 catch → 同步兜底。
3. **队列幂等做在 handler/业务层，不依赖 BullMQ jobId 去重** — timeout 放弃的 enqueue 若 Redis 恢复后才落地会重复 job；BullMQ jobId 去重仅在 job 仍驻留时有效，`removeOnComplete` 后失效。靠业务层幂等兜（本例 `email_log (batchId,kolId)` 发前查跳已发）。

**环境 caveat：** prod/staging Redis 6.0.16 < BullMQ 推荐 6.2.0 — core add/process/retry/delay 在 6.0 可用（boot 见「minimum Redis version 6.2.0」警告 = 连接已建非错误），但部分高级特性（debounce / 部分 rate-limiter）需 6.2，用到前须先升 Redis。详见 `deploy-patterns.md` / 环境文档 Redis 段。

来源：KOLMatrix BL-100 F001/F003 InMemoryJobQueue → BullMQ swap 实战 + 用户 2026-06-11 ack。

### 3.2 「入队等外部资源就绪」类设计必先验 worker 是否即时消耗任务（BL-086-F003）

**checklist：** 凡设计「先把任务入队、排队等外部资源（充值 / 配额 / 上游就绪）后再真执行」，spec/诊断写下假设前必须先核 **worker 生命周期** + **错误吞没行为**，否则任务会在资源未就绪时被即时消耗成 `succeeded-0` 或 `failed-no-retry`。

**反例（BL-086-F003）：** 诊断假设「充值前把 2535 id POST `/admin/seeds` 入队 → 排队等充值 → 充值后真抓」。读 apify fork SDK 源码证伪：

1. fork scrape-worker `boss.work('scrape',…)` **持续运行**（非 daily cron），enqueue 的 manual_seed job **立即处理**
2. `youtube.getChannels()` per-url 错误是 **swallow**（`catch{ console.warn }` continue）→ 余额耗尽时返**空数组**而非 throw
3. manual-seed-scrape 拿空数组 → `{inserted:0}` 不 throw → worker 判 job **`succeeded` inserted=0**（pg-boss retryLimit=0 不重试）

**净效果：充值前投喂 = job 全 succeeded-0，id 被消耗，充值后不会重抓**（job 已 succeeded），且投喂脚本 checkpoint 已标 fed → 充值后须先清 checkpoint 才能重喂。**正解：全量投喂放充值之后**；充值前只 dry-run（只读 count）+ 脚本就绪即可，不真投。

**核查动作：** grep worker 是否 long-running（`boss.work` / 常驻 setInterval）vs cron-triggered；grep per-item 错误是 `catch{ continue }`（swallow）还是 throw。两者组合决定「未就绪时入队」会不会被静默消耗。

> DB/外部 API batch 的 per-element try/catch + stats + audit forensic 模板（BL-076-F003 14 天静默 outage）见 `database-patterns.md`。

来源：KOLMatrix BL-086-F003 apify fork SDK 源码核查 + 用户 2026-06-09 ack。

---

## 4. 客户端水合正确性 — 失配（React #418）+ 时序窗口（mount-gate）两子坑（KOLMatrix BL-108-F004）

含交互的 `'use client'` / SSR 页面有两个独立的水合坑，症状都是「点击失效 + 单测全绿」，极易误诊为 onClick/state 逻辑 bug。

**子坑 A — 水合失配（React #418）：** client 组件在**初始 SSR 渲染路径**里调用 `new Date(iso).toLocaleString()`（或任何无显式 `timeZone` 的 `Intl.DateTimeFormat`/`toLocaleDateString` 等依赖运行时时区/locale 的格式化）→ 服务端按服务器时区生成文本、客户端按浏览器时区重渲 → 文本节点不一致 → React **#418** 丢弃该 hydration root 整棵服务端树客户端重渲。**致命连带：失去交互的不只是那个时间戳——同 root 内所有控件的事件处理器都来不及绑定**（headless 点击无反应、console 仅一行 #418）。三选一修复：① `getUTC*` 手写确定性 `YYYY-MM-DD HH:mm UTC`（服务端/客户端逐字符一致，UTC 也合 ops 口径，首选）；② mount-gate（见子坑 B）；③ `suppressHydrationWarning`（仅文本节点级，最弱）。回归：断言渲染输出为固定 UTC 串，`TZ=America/New_York npx vitest` 实证 fail-before/pass-after。**潜伏面：** 凡 client `toLocaleString` 当前仅因「交互后才渲、不进初始 SSR」侥幸不炸，一旦挪进初始渲染即同病。

**子坑 B — 水合时序窗口（mount-gate 模式）：** #418 修好后仍可能点击失效且无 console 错误——这是另一独立根因。SSR 把交互按钮渲进 HTML 后，到 React 完成水合绑 onClick 之间有延迟窗口（staging 实测 DOM @728ms 出现、onClick @1253ms 才绑，窗口 ~525ms，弱机/慢网更长）。**窗口内按钮可见可点但事件未绑，点击被永久丢弃，React 18+ discrete-event replay 在 App Router RSC+client-island 场景不补触发**——这是真实面向用户的 bug，不是纯测试问题。jsdom 下 RTL `render()` 纯客户端渲染从不经 SSR+hydrate，单测全绿，**只有真实浏览器或 `renderToString`→`hydrateRoot` 测试才暴露**。修复模式 mount-gate：

```tsx
// 客户端就绪检测：server=false / client=true，水合安全
// 用 useSyncExternalStore 而非 useState(false)+useEffect(setReady(true))
// 后者会被 react-hooks/set-state-in-effect 规则报错
const ready = useSyncExternalStore(() => () => {}, () => true, () => false);
// 水合完成前：关键控件 disabled + 根节点 data-ready=false + 显示"初始化中"
// 完成后 enabled。使「控件可点 ⟺ 已水合」
```

真实用户见诚实未就绪态，Playwright 标准 `click()` 自动等 enabled 跨过窗口。回归：`renderToString`→`hydrateRoot` 路径断言「SSR 阶段 disabled / 水合后 enabled+可点」（RTL `render` 测不到）。

### 4.1 Evaluator 验收铁律 — headless 真点 + 严禁 force-click（BL-108-F004，铁律级）

验收含交互的 `'use client'` / SSR 页面，L2 必须用 headless 浏览器**真点**关键控件并断言：

1. **console 无 React #418/#425 水合错误**（#418 = 文本节点失配会废掉整个 hydration root 交互，详子坑 A）
2. **点击产生预期 onClick 效果**（state 切换 / toast / 跳转）

**测法铁律（关键，force-click 机制）：** 必须用标准 `locator.click()`（Playwright 自动等 actionability/enabled）**或**先 `await [data-ready=true]` 再点。**严禁 `force: true` / `dispatchEvent` / `evaluate(el => el.click())`** —— 这些跳过 enabled 检查，会点在水合时序窗口（子坑 B）内**未绑事件的按钮**上，**稳定复现"假 bug"**：控件此刻确实可见、坐标命中，但事件处理器尚未绑定，点击被永久丢弃，于是每次运行都「稳定」失败，误判为开关/按钮逻辑坏了。BL-108 Evaluator 两轮 reverify 即因 force-click 落此窗口误判开关失效。

**反例：** RTL `render()` 是纯客户端渲染从不经 SSR+hydrate，单测全绿 ≠ 真实浏览器无水合问题；含交互 SSR 页面不能只靠 jsdom 单测签收。

来源：KOLMatrix BL-108-F004 fix-round 1（#418 水合失配）+ fix-round 2（force-click 落时序窗口误判）+ 用户 2026-06-10 ack。

---

## 5. Next 构建期 RSC 约束（tsc/lint 漏报，须 `npm run build`）（KOLMatrix BL-070 #23 / BL-105-F001）

> **共性：** 以下两类是 Next 构建期 RSC 约束校验，**不在 TS 类型系统内**，故 `tsc --noEmit` + `npm run lint` 全绿 ≠ `next build` 绿，只有 `next build` / CI build job 才抓。涉及 `'use server'` 文件 export 或新建/改 route segment 文件的 feature，**commit 前必须本地跑一次 `npm run build`**（tsc + lint + vitest 不够）。

**(A) `'use server'` 文件禁非 async function exports（BL-070 #23）：** Next.js 16 `'use server'` 文件里加 zod schema / 常量 / 普通对象 / 类的 export 会触发 build/runtime error。

- ✅ `export async function actionName(...) { ... }` — 允许
- ❌ `export const SchemaName = z.object({ ... })` — 禁
- ❌ `export const CONSTANT = "value"` — 禁
- ❌ `export class Helper { ... }` — 禁
- ❌ `export type AliasName = ...` — 禁（类型在某些版本严格）

**zod schema 抽离模板：**
```typescript
// src/app/[locale]/request-access/schema.ts  (无 'use server')
import { z } from "zod";
export const AccessRequestSchema = z.object({ email: z.string().email() /* ... */ });
export type AccessRequest = z.infer<typeof AccessRequestSchema>;

// src/app/[locale]/request-access/actions.ts  (含 'use server')
"use server";
import { AccessRequestSchema } from "./schema";
export async function requestAccess(input: unknown) {
  const data = AccessRequestSchema.parse(input);
  // ...
}
```
反例：BL-070 fix-round 1 #23 — landing batch 加 `AccessRequestSchema` 到 actions.ts 触发 Next.js 16 build error，抽到独立 `schema.ts` 解。

**(B) route segment 文件仅允许 `export default` + 路由 segment config 白名单（BL-105-F001）：** `page` / `layout` / `route` / `template` / `default` / `loading` / `error` / `not-found` 类文件只允许 `export default` + `metadata` / `generateMetadata` / `dynamic` / `revalidate` / `fetchCache` / `runtime` / `preferredRegion` / `generateStaticParams` 等 segment config。**任何其它命名 export 触发 build error**（tsc/lint 漏报）。

```typescript
// ❌ campaigns/[id]/edit/page.tsx 里 export 共享 helper → next build fail（tsc/lint 全绿）
export function editErrorLabels(...) { ... }
// ✅ 抽到同目录普通模块再 import
// error-labels.ts:  export function editErrorLabels(...) { ... }
// page.tsx:         import { editErrorLabels } from "./error-labels";
```
反例：BL-105-F001 在 `campaigns/[id]/edit/page.tsx` export `editErrorLabels` helper → 「Build + migrate smoke」CI job fail（tsc/lint 全绿）+ 用户 2026-06-12 ack。

来源：KOLMatrix BL-070 fix-round 1 #23 + BL-105-F001（用户 2026-06-12 ack）。

### 5.1 Turbopack ↔ webpack 切换暴露 hidden TS errors（BL-067 fix-round 1）

Turbopack ↔ webpack 切换时 webpack 严格 typecheck 暴露 Turbopack 宽松不报的 hidden TS errors：

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

来源：KOLMatrix BL-067 fix-round 1 commit 6dbe231（修 4 处 hidden TS errors）+ v0.9.22 #8。

---

## 6. 大型删除 / 重构批次执行模板（KOLMatrix BL-065-F006 / BL-070 / BL-072）

**背景：** BL-065-F006 单 commit ad76eb1：64 files / +1466 / -6124（净 -4658 lines）。本地 L1 全绿即推送，CI 3 轮自修才全绿 — woff2 stale / edge-states-coverage / visual-baselines-shape / UUID guard 等 baseline-tracking / fidelity-grep / next.js types-regen 类测试只在 CI 完整链路才暴露。

**A. 本地 L1 全绿 ≠ CI 全绿** — 删除文件类操作会触发：
1. `tests/integration/*-fidelity.test.ts` 类 grep 测试期望特定文件存在
2. `tests/screenshots/baseline/*.png` 类视觉 baseline 数量断言
3. `tests/unit/visual-baselines-shape.test.ts` 类清单测试（git-tracked 数量）
4. `.next/types/validator.ts` Next.js 自动生成 page module 引用（删除前应 `rm -rf .next` 清缓存再 typecheck）
5. material-symbols-outlined.woff2 / 任何 build-derived 资源 — 删除组件时 subset 会自动缩小，本地 regen + 提交

**B. 删除前预扫清单（建议 Generator 在 Phase 1 开始前执行）：**
```bash
grep -rln "<deleted-folder>" src/ tests/            # 全仓引用 grep
grep -l "from.*<deleted-module>" tests/integration/  # Integration test 引用
ls tests/screenshots/baseline/*<deleted-feature>*.png 2>/dev/null  # Baseline PNG 同名
rm -rf .next && NODE_OPTIONS='--max-old-space-size=4096' npm run typecheck  # Next.js cache
```

**C. UUID guard pattern**：上游路由可能保留 stale ids（如 BL-064 redirect `/campaigns/abc-123 → /match?campaignId=abc-123`），下游 page 在调用 Prisma `findFirst({ where: { id } })` 前必须校验 UUID shape：
```typescript
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!value || !UUID_RE.test(value)) return null;  // silent fallback
```
否则 driverAdapterError 500（"invalid input syntax for type uuid"）。

**D. 删显式子路由前必须先加上游 `[id]` UUID guard（BL-070-F004 #1）：** 删 `src/app/[locale]/(app)/<resource>/new/page.tsx` 等显式子路由后，Next.js fallback 到动态 `[id]/page.tsx` → Prisma `findFirst({ id: 'new' })` 抛 `invalid input syntax for type uuid` 500。同 commit 必须给动态 `[id]/page.tsx` 加 `UUID_RE.test(id)` guard 走 `notFound()`。grep 自查：
```bash
find src/app -name 'page.tsx' -path '*\[*\]*' | while read p; do
  grep -L "UUID_RE\|isUuid" "$p" && echo "MISSING guard: $p"
done
```

**E. 大型 atomic delete commit 优于多 sub-commit** — single commit atomic rollback、git log 单条目、易于 PR review。CI 失败时多轮自修（fix(BL-XXX): xxx）每轮独立、被 CI 全程捕获，不污染产品代码。

**F. i18n deprecated ns 删除前必须 grep 实际 callers（BL-070-F005 #1）：** ns 可能跨 batch git mv 后仍 in use（如把 KB CRUD 组件搬到 brief/ 但组件内部仍 `useTranslations("knowledgeBase")`）。盲信 marker `will delete this namespace` 整 ns 删会破 production：
```bash
grep -rln 'useTranslations\|getTranslations' src/ | xargs grep -l '"<ns-name>"'
```
0 命中才整 ns 删；有命中先修组件再删 ns（或保 ns 但更名说明）。

**G. lazy boundary 引入时的 fidelity test 同步清单（BL-070 #28）：** 把组件改名为 `XxxLazy` 后（如 `MatchRefineBar` → `MatchRefineBarLazy`），老 fidelity test 断言 `import { OldName } from "./OldName"` 失败。引入 lazy boundary 时必同步改 fidelity test 的 import name + assertion 文本：
```bash
grep -rln 'import.*"\./<old-component-name>"' tests/integration/*-fidelity.test.*
```

**H. 删 X 前 grep callers 矩阵（BL-072 #4 扩展）：** 模式一般化为「删任何被引用资源前必先 grep 全仓 callers + 同 commit 修」：

| X 类型 | grep 模板 | 自动化防御 test | 反例 / 实战 |
|---|---|---|---|
| **i18n namespace**（删 `messages/*.json` ns 块） | `grep -rln 'useTranslations\|getTranslations' src/ \| xargs grep -l '"<ns>"'` | i18n-page-side-consumption v2 扫 t("<key>") 验 messages exist | BL-070-F005 #1 git mv 后老组件仍引用 deprecated `knowledgeBase` ns |
| **路由 outbound**（删 `page.tsx` / route segment） | `grep -rEn "['\"]/(<deleted-route>)" src/ --include='*.tsx'` + `grep -rEn 'router\.(push\|replace)\("/(<deleted-route>)'` | link-target-audit 扫 href 字面 → 比对路由树 + IA_REDIRECT_RULES | BL-072-F006 修 10 处 outbound 404 |
| **enum value / API endpoint / DB table** | TBD（按场景定 grep + 类型搜索） | TBD（如 `grep prisma.<table>` 扫） | 暂无实战，留待未来沉淀 |

**Generator self-check 流程：** (1) 删前 grep 当前矩阵覆盖类型对应 caller，0 命中才删；(2) 有命中 → 同 commit 修 caller（不允许跨 commit 拆）；(3) 同 commit 补 advisory test 防御未来同类 regression。advisory test 三件套（link-target-audit / material-symbols-coverage / i18n-page-side-consumption）→ 见 `testing-env-patterns.md`。

> **E2E 域拆分：** base-ui Checkbox 的 E2E 选择器陷阱（用 `getByRole('checkbox').click()` 而非 `input[type=checkbox]`）与 next-intl 包装后 `notFound()` HTTP status 不可靠（`expect(status).toBeOneOf([200,404])`）两条属 Evaluator E2E 稳定性域，见 `testing-env-patterns.md`。

来源：KOLMatrix BL-065-F006 atomic delete 实战（CI run 25782189342）+ BL-070-F004/F005/F009（用户 2026-05-25 ack）+ BL-072-F006 矩阵化（用户 2026-05-26 ack）。

---

## 7. IA refactor / route migration redirect scope wire-readiness 评估（KOLMatrix BL-064 / BL-069）

**背景：** BL-064 顶层 IA refactor 7→4 路由 spec §4 预期 ~12 条 redirect，fix-round 1-3 实战发现 embed-old-components 占位策略下若 destination route **未 wire ready**（如 /campaigns/new → /brief?action=new 但 /brief 仅 embed /knowledge-base，没 wire form action），用户体验比 kept 旧路由 **差** — 跳转后 URL 换名但内容仍是旧的，反而 confusing。

**规则：**

A. **redirect scope 根据 destination wire-readiness 评估** — 不是所有老路由都立即 redirect。destination route 必须含等效或更优功能才启 redirect；否则 kept deep-link 让 UX 不退化。

B. **embed-old-components 占位策略下的 redirect 评估清单**（spec 起草时套用）：

| destination 状态 | 决策 |
|---|---|
| 已 wire 该 content（实质功能在新路由）| redirect OK |
| 仅 embed-old 占位（URL 换名但内容不变）| **kept 更优**（用户认知不混乱）|
| 部分 wire（如 form embed 但 list 未 wire）| 按 sub-path 拆分；list path kept，form path redirect |

C. **redirect scope 缩减是良性 fix-round** — 不计入「质量问题」，反映 IA refactor 需要 building 中段实战验证才能确定最优 scope。BL-064 fix-round 1→3 把 12 条 redirect 缩减到 6 条，其余 4+ 条改 kept deep-link 推迟到后续批次 wire destination 后再启。

D. **IaRedirectRule mixed-status 模式（BL-069 #14）：** 同一 middleware 支持混合 301/302 redirect — `IaRedirectRule` 加 `status?: 301 | 302`（default 302 向后兼容），per-rule override 301。开发期默认 302（保留 rollback 能力），稳定后某些 rule 升 301（永久重定向）：
```typescript
export interface IaRedirectRule {
  from: string | RegExp;
  to: string;
  status?: 301 | 302;  // default 302; per-rule override
}
const finalStatus = matched.status ?? 302;
return NextResponse.redirect(new URL(matched.to, req.url), finalStatus);
```

来源：KOLMatrix BL-064 fix-round 3 实战（顶层 IA refactor 7→4 路由）+ BL-069 fix-round 1 #14（用户 2026-05-18 ack）。

---

## 8. next/image 异构 CDN 落地：unoptimized + explicit dims（KOLMatrix BL-070 #27）

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

来源：KOLMatrix BL-070 fix-round 2 #27 — KOL avatar 多平台 CDN whitelist 维护成本爆炸 → `unoptimized + explicit dims` 解。

---

## 9. Suspense fallback 规范 — 高度镜像 + flex-wrap 等宽（KOLMatrix BL-070）

Suspense fallback skeleton 必须**像素级镜像实际 outer 结构**（高度 + 宽度），否则 swap 时触发 CLS（垂直反差）和 flex-wrap reflow（横向反差间接放大垂直 CLS）。

**(A) 高度镜像（`/match` CLS 0.348 → 0.008 fix）：** skeleton 必须等于实际渲染内容的**总高度**。skeleton 高度差异会按下游 shifted 内容总高度（如 1039px 高的主网格）放大 CLS 评分。
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

**(B) 宽度等宽（`flex-wrap` 父容器下横向 reflow 间接放大 CLS）：** skeleton 宽度在 `flex-wrap` 父容器下必须**与实际等宽**（或更宽），否则 swap 时横向 reflow 触发换行 → 间接放大垂直 CLS。
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

**Lighthouse 13.x audit 定位工具：** `cls-culprits-insight` 在 JSON 输出 path = `details.items[].node.selector + snippet + boundingRect` — 比 `layout-shift-elements` 更准确直指 shift target。后续优化 perf 优先 grep 此键定位 CLS 元素。

**Lighthouse 落地自测：** Suspense PR push 前必跑 Lighthouse Desktop logged-in 自测，不要等 Evaluator fix-round 才捕 CLS：
```bash
npx lighthouse http://localhost:3001/<route> --preset=desktop --view --only-categories=performance
```

来源：KOLMatrix BL-070 fix-round 3 #29（`/match` CLS 0.348 → 0.008 高度镜像）+ #30（`SaveSearchControls` flex-wrap 横向 reflow → 宽度等宽 + Lighthouse `cls-culprits-insight` 定位法）+ 用户 2026-05-25 ack。

---

## 版本历史

| 日期 | 修订 | 来源 |
|---|---|---|
| 2026-07-09 | v1.0 重构：自 `harness/generator.md` §8-§9 原文迁出成独立 pattern 文件 | 框架 v1.0 目录分层 |
| 2026-07-13 | 回流 KOLMatrix §3 背景任务 MVP→BullMQ（BL-067/068/100/086）· §4 客户端水合 #418+mount-gate+force-click 铁律（BL-108）· §5 Next 构建期 RSC 约束 + Turbopack↔webpack（BL-070/105/067）· §6 大型删除批次模板（BL-065/070/072）· §7 IA redirect scope（BL-064/069）· §8 next/image 异构 CDN（BL-070）· §9 Suspense fallback（BL-070） | joyce KOLMatrix v0.9.25 沉淀回流 |
