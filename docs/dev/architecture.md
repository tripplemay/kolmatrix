# KOLMatrix 系统架构

> 版本：v1.0（B0 基线）· 日期：2026-04-18
> 适用范围：B0 ~ V?，业务批次按需扩展本文档

## 0. 一句话定位

KOLMatrix = 单 Next.js 工程 + PostgreSQL（多租户 RLS）+ Redis（队列/缓存）+ 外部 worker 进程（BullMQ），运行在与 aigcgateway 共机的 Tokyo VM。AI 调用统一走 aigcgateway，邮件走 Resend。

## 1. 分层视图

```
┌──────────────────────────────────────────────────────────────┐
│                  Browser (Next.js Client)                     │
│  shadcn/ui · Tailwind · TanStack Query · react-hook-form      │
└──────────────────────────────────────────────────────────────┘
                              │ HTTP/JSON
                              ▼
┌──────────────────────────────────────────────────────────────┐
│              Next.js Server (Edge + Node Runtime)             │
│  Middleware (auth · i18n · tenant) → RSC / Route Handlers     │
│  - App Router pages (`/(app)/*`, `/(public)/*`)               │
│  - API routes (`/api/v1/*`)                                   │
│  - NextAuth v5 endpoints                                      │
└──────────────────────────────────────────────────────────────┘
            │                    │                       │
            ▼                    ▼                       ▼
   ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
   │  PostgreSQL    │   │     Redis      │   │  External APIs │
   │  Prisma + RLS  │   │  BullMQ queue  │   │  aigcgateway   │
   │  (kolmatrix_   │   │  cache / locks │   │  Resend        │
   │   prod)        │   │                │   │  YouTube/TikTok│
   └────────────────┘   └────────────────┘   └────────────────┘
                              │
                              ▼
                ┌──────────────────────────────┐
                │   Background Workers (Node)   │
                │  - kol-crawler                │
                │  - ai-evaluator               │
                │  - email-sender               │
                │  - webhook-receiver           │
                │  独立进程, 由 PM2 管理         │
                └──────────────────────────────┘
```

## 2. 请求管道

### 2.1 Web 请求（用户访问页面）

```
Browser
  → Next.js Middleware
      1. next-intl: 解析 locale prefix
      2. NextAuth: 校验 session cookie
      3. Tenant resolver: 从 session.user.tenantId 取 tenant_id
  → Route group layout `/(app)/layout.tsx`
      - 拉取 user/tenant 上下文（RSC, cached per-request）
      - 渲染 AppShellLayout（Sidebar + Topbar + main）
  → Page Component (RSC)
      - 通过 db client 查询（自动注入 tenant_id 到 RLS session var）
      - 返回 HTML
  → Client hydration (TanStack Query 接管动态数据)
```

### 2.2 API 请求（客户端 fetch / 第三方）

```
Client / 3rd-party
  → /api/v1/* Route Handler
      1. 校验 session 或 API key
      2. 提取 tenant_id 上下文
      3. db.$transaction(async (tx) => { tx.$executeRaw set local app.tenant_id; ... })
      4. 业务逻辑
      5. 返回 envelope { success, data, error, meta }
```

## 3. 认证与多租户

### 3.1 认证（NextAuth v5）

- Provider：CredentialsProvider（email + bcrypt password），后续可加 Google OAuth
- Session 策略：JWT（无服务端 session 表，水平扩展友好）
- Token 内容：`{ userId, tenantId, role, locale }`
- Adapter：@auth/prisma-adapter（仅用于 user/account/verification 表）

```
User table (Prisma)
  - id, tenant_id, email, hashed_password, role, name, locale
Account / Session / VerificationToken
  - 由 @auth/prisma-adapter 管理
```

### 3.2 多租户 RLS 策略

**核心原则：** 数据库强制 + 应用层注入，应用层 bug 不会导致 cross-tenant 泄漏。

```sql
-- 每张多租户表启用 RLS
ALTER TABLE kol ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON kol
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid);
```

**应用侧注入：**
```typescript
// src/lib/db.ts
export async function withTenant<T>(tenantId: string, fn: () => Promise<T>) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SET LOCAL app.tenant_id = ${tenantId}`;
    return fn();
  });
}
```

**例外（无 tenant_id 的全局表）：**
- `tenant`（租户主表本身）
- 系统级 audit_log（仅 admin 访问）
- 公共数据如 game category 字典

### 3.3 角色权限（PRD §8）

| 角色 | 数据访问 | 写权限 |
|---|---|---|
| `platform_admin` | 全部 tenant | 全部 |
| `tenant_admin` | 自己 tenant | 自己 tenant 全部 |
| `marketer` | 自己 tenant | KOL/Campaign/Email |
| `client` | 单一 candidate_list（凭 share_token） | 评分 |

应用层用 zod schema + middleware 检查 role；DB 层 RLS 兜底。

## 4. 数据库

### 4.1 实例

- 生产：与 aigcgateway 共用 PostgreSQL 16 实例，database `kolmatrix_prod`
- Staging：同实例 database `kolmatrix_staging`（B1 后启用）
- 本地：Docker `postgres:16-alpine`

### 4.2 Schema 演进

- 全部 migration 由 `prisma migrate dev` 生成（提交到 git）
- 生产环境 `prisma migrate deploy`（CI/CD 触发）
- 大表加索引、改 column 类型用单独 migration + 蓝绿迁移
- RLS policies 内嵌在 migration 里

详见 `docs/specs/B0-database-schema.md`。

### 4.3 Prisma 客户端

- `src/lib/db.ts` 单例 PrismaClient（避免 dev 模式热重载内存泄漏）
- 通过 `withTenant(tenantId, fn)` 包装所有租户内查询
- ServerComponent 默认从 session 推 tenantId

## 5. 后台队列（BullMQ）

> B0 不实现，留给 V3+。架构占位以便规划。

### 5.1 队列拓扑

```
queue: kol-crawl       — 拉取 KOL 公开数据（YouTube/TikTok），低优先级，重试 5 次
queue: ai-evaluate     — 调 aigcgateway 评估 KOL，中优先级
queue: email-send      — 发送邮件，高优先级 + 频控（Token Bucket）
queue: webhook-process — 处理 Resend 邮件 webhook（opened/replied）
queue: data-refresh    — 定时刷新 KOL 数据（cron-like）
```

### 5.2 Worker 进程

- 独立 Node 进程（不与 Next.js 同进程，避免影响 SSR）
- 用 PM2 启动：`pm2 start ecosystem.config.js`
- 横向扩展：增加 worker 数量
- 失败重试：指数退避 + DLQ

### 5.3 频控

- Email queue 每个发件域 ≤500 封/天/IP（PRD §6 防封号）
- aigcgateway 调用根据 plan tier 设上限

## 6. AI 调用（aigcgateway）

> B0 不实现，留架构占位。

### 6.1 客户端封装

- `src/lib/aigc.ts` 包装 aigcgateway HTTP API
- 所有 prompt 模板存 `prompts/{lang}/{purpose}.md`，运行时填变量
- 模型选择：评分用 GPT-4o，文案生成用 Claude Sonnet 4.6
- 全部调用记录到 `ai_call_log` 表（cost / token / latency）

### 6.2 KOL AI 评分管道

```
new_kol → ai-evaluate queue → aigcgateway (GPT-4o)
  → 解析 KOL 内容 + 受众数据
  → 输出 score (0-100) + tags + audience_estimate
  → 写回 kol 表 + ai_eval_log
```

### 6.3 邮件个性化

```
campaign + kol pairs → ai-evaluate queue → 生成个性化邮件
  → 模板（产品资料 + KOL bio + 共同点）→ Claude Sonnet
  → 输出主题 + 正文，写入 email_template_instance
  → 用户审核后入 email-send queue
```

## 7. 邮件基础设施（Resend）

> B0 仅占位，V3 实现。

### 7.1 域名 + DNS

- 自定义发件域：`mail.kolmatrix.com`（B1 申请）
- DNS 记录：SPF + DKIM + DMARC（Resend 文档要求）
- 多域热备：避免单域被封导致全停

### 7.2 发送流程

```
email-send queue
  → check 频控（Redis token bucket）
  → check suppression list（退订 / bounce）
  → Resend API send
  → 写 email_log（status: queued → sent）
  → 收到 webhook → 更新 status (delivered / opened / replied / bounced)
```

### 7.3 退订与合规

- 每封邮件强制带 unsubscribe 链接（Resend 自动注入）
- GDPR：欧洲收件人特殊提示 + 提供数据删除入口
- bounce/complaint 自动加入 suppression list（永久）

## 8. 外部 API 集成

| API | 用途 | 配额策略 |
|---|---|---|
| YouTube Data v3 | KOL 频道/视频/订阅数 | 申请企业级配额，缓存 24h |
| TikTok for Business | KOL 数据 | OAuth 接入，缓存 12h |
| Twitch API | 直播主数据 | 缓存 6h |
| aigcgateway | AI 调用 | 同实例，无额外网络 |
| Resend | 邮件发送 | 按月套餐 |

所有外部数据写入本地 `kol_external_data` 缓存表，分析层只读本地缓存。

## 9. API 约定

### 9.1 路径

- 内部：`/api/v1/*`（受 session 保护）
- 公开：`/api/public/*`（仅 share_token 类，如客户协同筛选）
- Webhook：`/api/webhooks/{provider}`（HMAC 校验）

### 9.2 响应封装

```typescript
type ApiEnvelope<T> = {
  success: boolean;
  data: T | null;
  error: { code: string; message: string; details?: unknown } | null;
  meta?: { total?: number; page?: number; limit?: number };
};
```

### 9.3 错误码

- `AUTH_REQUIRED` 401
- `FORBIDDEN` 403
- `NOT_FOUND` 404
- `VALIDATION_ERROR` 422（含 details: zod issues）
- `RATE_LIMITED` 429
- `INTERNAL_ERROR` 500

### 9.4 分页

- query param `?page=1&limit=20`（默认 20，最大 100）
- meta 返回 `{ total, page, limit }`

## 10. 安全

| 项 | 实现 |
|---|---|
| CSRF | NextAuth 内建 + sameSite=lax cookie |
| XSS | React 默认转义 + DOMPurify 处理用户输入富文本 |
| SQL 注入 | Prisma 参数化 + 禁用裸 raw SQL（除 RLS set local） |
| 速率限制 | upstash/ratelimit（per-IP 60/min, per-user 600/min） |
| 密码存储 | bcrypt 12 rounds |
| Secret 管理 | `.env.local`（开发）+ 生产用环境变量（部署时注入） |
| 审计日志 | `audit_log` 表记录所有 KOL/Campaign/Email 写操作 |
| GDPR | 数据删除接口 + 隐私政策 + 数据本地化（Tokyo region） |

## 11. 国际化（i18n）

- 库：next-intl v3
- 语言：EN（默认）/ ZH / JA / KO / ES
- 路由：`/[locale]/...`
- 文案文件：`messages/{locale}.json`
- locale 偏好存 `user.locale` 列；topbar 切换器持久化到 cookie + DB

## 12. 可观测性

> B0 留 hook 点，V?? 落地

- 日志：pino + 结构化 JSON，输出到 stdout（PM2 收集）
- 错误追踪：Sentry（B1 接入）
- 性能：Vercel Analytics 替代品考虑 PostHog
- 数据库慢查询：Postgres `pg_stat_statements`

## 13. 部署

### 13.1 环境

| 环境 | 域名 | 实例 |
|---|---|---|
| 生产 | https://kol.guangai.ai | Tokyo VM, PM2 `kolmatrix`, port 3001 |
| Staging | TBD（B1 启用） | 同实例 |
| 本地 | http://localhost:3000 | docker compose |

### 13.2 CI/CD

- GitHub Actions：lint + tsc + build（push 触发）
- Deploy：手动触发 workflow → SSH → `git pull && npm ci && npm run build && pm2 restart kolmatrix`
- Migration：`prisma migrate deploy` 在 build 阶段执行

### 13.3 回滚

- 应用：`git revert` → push → 重 deploy
- 数据库：每个 migration 必须有手写 rollback SQL（注释在 migration 文件顶部）

## 14. 文件夹组织

```
src/
├── app/
│   ├── (app)/              # 受保护路由
│   │   ├── layout.tsx       # AppShellLayout
│   │   ├── dashboard/page.tsx
│   │   └── ...（V3+ 业务页面）
│   ├── (public)/           # 公开路由（客户协同筛选等）
│   ├── login/page.tsx
│   └── api/
│       ├── v1/
│       ├── public/
│       └── webhooks/
├── components/
│   ├── layout/             # AppShell, Sidebar, Topbar
│   ├── ui/                 # shadcn/ui 安装进来的
│   └── charts/             # recharts 包装
├── features/               # feature-first 业务模块（V3+）
│   ├── kol/
│   ├── campaign/
│   ├── email/
│   └── ...
├── lib/
│   ├── db.ts               # Prisma + withTenant
│   ├── auth.ts             # NextAuth 配置
│   ├── aigc.ts             # aigcgateway client
│   ├── i18n.ts
│   └── utils.ts
├── styles/globals.css
├── middleware.ts
└── i18n.ts                 # next-intl config
prisma/
├── schema.prisma
├── migrations/
└── seed.ts
messages/
├── en.json
├── zh.json
├── ja.json
├── ko.json
└── es.json
```

## 15. 技术栈快速对照

| 层 | 选型 | 备注 |
|---|---|---|
| Framework | Next.js 15 (App Router) | RSC + Server Actions |
| Language | TypeScript 5+ | strict mode |
| Style | Tailwind 3.4 + shadcn/ui | v4 待评估 |
| Auth | NextAuth v5 (beta) | JWT session |
| ORM | Prisma 5 | + RLS |
| DB | PostgreSQL 16 | 共用 aigcgateway 实例 |
| Cache/Queue | Redis 7 | BullMQ workers (V3+) |
| AI | aigcgateway | 内部网关 |
| Email | Resend | DNS 自管 |
| Icons | Material Symbols Outlined | CDN |
| Forms | react-hook-form + zod | schema 复用 |
| Charts | recharts | LineChart / BarChart |
| i18n | next-intl v3 | 5 语言 |
| Server data | TanStack Query v5 | 客户端缓存 |
| Test | Vitest + Playwright | B1 接入 |
| CI | GitHub Actions | lint+tsc+build |
| Deploy | PM2 + Nginx | Tokyo VM |

## 16. 后续扩展点

- B1：Sentry + 监控；KOL Database 列表页 + Campaigns 列表页
- B2：BullMQ workers + KOL crawler + AI 评分服务
- B3：邮件发送系统 + Resend + DNS
- B4：YouTube/TikTok 真实数据接入
- B5：客户协同筛选 + 公开链接评分
- V?：竞品分析 / 效果回流 / Webhook 开放
