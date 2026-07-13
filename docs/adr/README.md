# 架构决策记录（Architecture Decision Records）

> KOLMatrix 项目所有**跨批次影响 / 不可逆 / 当时有过辩论**的关键决策记录。
> 建立日期：2026-04-19（B0 完成后回溯 8 份决策）

## 什么时候该写 ADR

**写：**
- 决策影响多个批次
- 反转需要返工（不可逆或成本高）
- 当时讨论过多个方案
- 会影响未来新 agent 的判断
- 技术栈 / 架构 / 流程 / 验收口径

**不写：**
- 一次性实现细节（库选型：如"用 recharts"—— 换一个不影响架构）
- Spec 级细节（功能列表 / 字段定义 —— 在 spec 里）
- 个人偏好（commit 格式 / 命名风格 —— 在 CLAUDE.md）
- Bug 修复（没决策，只有修复）

## 如何使用

### 新 agent 上手
1. 读本 README 1 分钟，看决策总览
2. 按主题 / 按时间挑选 2-3 份 ADR 深读

### 做新决策前
1. 检查本索引是否已有相关 ADR
2. 读相关 ADR 确认新决策不冲突
3. 如果冲突：新 ADR 标 `Supersedes ADR-XXX`，同时改旧 ADR 状态为 `Superseded by ADR-YYY`

### 遇规格争议
1. 先查 ADR（很多争议本质是历史决策被忽略）
2. ADR 无记录 → 按 `framework/harness/pre-impl-adjudication.md` 流程发审计请求

## 决策状态流转

```
Proposed ──► Accepted ──► [Deprecated | Superseded by ADR-YYY]
```

- **Proposed：** 提议中，未生效
- **Accepted：** 当前生效（默认状态）
- **Deprecated：** 不再适用，但无替代方案
- **Superseded：** 被更新的 ADR 取代

## 编号约定

- 3 位数字（001, 002, ..., 099, 100, 101, ...）
- 新 ADR 取下一个未用编号
- 被弃用的 ADR **编号保留不删**（ADR-005 永远是 ADR-005，不重新利用）

---

## 已接受的决策（按编号）

| # | 标题 | 一行摘要 | 状态 | 日期 |
|---|---|---|---|---|
| [001](./ADR-001-option-alpha-infra-first.md) | Option α Infra-First Sequencing | B0→BI1→BI2→BI3→B1 串行，infra 全完再启动业务 | Accepted | 2026-04-19 |
| [002](./ADR-002-tech-stack-latest-greenfield.md) | Tech Stack Latest Greenfield | Next.js 16 + React 19.2 + Tailwind v4 CSS-first + Prisma 7 | Accepted | 2026-04-19 |
| [003](./ADR-003-pixel-perfect-visual-standard.md) | Pixel-Perfect Visual Standard | 视觉验收 ±2px / ΔE<2 / 字号 100% / 布局 100% | Accepted（baseline 重定 by ADR-021） | 2026-04-18 |
| [004](./ADR-004-f010-component-library-lock.md) | F010 Component Library Lock (12) | 硬锁 12 个公共组件，页面专属放 features/ | Accepted（视觉演进 by ADR-021） | 2026-04-18 |
| [005](./ADR-005-f007-component-adoption-criteria.md) | F007 §11.2 组件接入口径 | direct ≥5 + render tree 12 全覆盖 + 不 inline | Accepted | 2026-04-19 |
| [006](./ADR-006-pre-impl-audit-pattern.md) | Pre-Impl Audit → Planner Adjudication | Generator 主动审计 + Planner 裁决后开工 | Accepted | 2026-04-19 |
| [007](./ADR-007-multi-tenant-rls-strategy.md) | Multi-Tenant RLS Strategy | 共享 DB + PostgreSQL RLS + tenant_id current_setting | Accepted | 2026-04-18 |
| [008](./ADR-008-strict-manual-verification-mode.md) | Strict Manual Verification Mode | BI1 前 B0 用严格手工替代自动化测试 | Accepted | 2026-04-19 |
| [009](./ADR-009-aigcgateway-integration.md) | AI Gateway Integration Strategy | @guangai/aigc-sdk + 同 VM 内网 + 3 档模型 + Action prompt + $100/月 | Accepted | 2026-04-19 |
| [010](./ADR-010-domain-strategy-kolquest-com.md) | Domain Strategy — kolquest.com | 注册 kolquest.com 作品牌+发件域；主站暂不迁移；根域直发 | Accepted | 2026-04-19 |
| [011](./ADR-011-unified-asset-table-vs-typed-tables.md) | Unified Asset Table | 单 Asset 表 + type enum + content JSONB；EmailTemplate dual-write 兼容期 | Accepted | 2026-05-02 |
| [012](./ADR-012-assets-ux-redesign-outreach-first.md) | Assets UX Redesign — Outreach-First | 推翻 §F004.B 部分（sidebar / 4 tabs / Create blank）；drawer + top filter dropdown + composer 增强 | Accepted | 2026-05-03 |
| [013](./ADR-013-ai-native-product-pivot.md) | **AI Native 产品转向** | 顶层 IA 7→4 路由（Brief/Match/Reach/Insight）；删 KOL saved pool；AI 主导取代工具+辅助；6-10 周重构；5/13 上线 deadline 取消 | Accepted (§IA 部分 Superseded by ADR-015) | 2026-05-10 |
| [014](./ADR-014-value-score-formula-v2.md) | Value Score Formula v2 | BL-049/050 价值评分公式调整 | Accepted | 2026-05-?? |
| [015](./ADR-015-5-route-ia-add-campaigns-nav.md) | **5 路由 IA — 加 Campaigns 一级 nav** | 加 `campaigns` 作第 2 一级 nav（Brief/Campaigns/Match/Reach/Insight）；/campaigns 列表行加 Match KOL CTA；/insight QuickActions 4→3 | Accepted (supersedes ADR-013 §IA) | 2026-05-26 |
| [016](./ADR-016-kol-campaign-suggestion-lifecycle.md) | **kol_campaign 推荐生命周期** | 复用 kol_campaign 加 `suggestion_status` 4 态（suggested 不落库 / accepted / skipped / swap_pool）；legacy backfill→accepted；驱动 AI Match Panel 三列 | Accepted | 2026-06-05 |
| [017](./ADR-017-kol-source-strategy-and-upstream-acquisition-governance.md) | **KOL 源策略 + 上游抓取治理** | 旧源=discovery 资产不复活(收割 2535 id 喂 manual_seed)；apify-kol-service 运维归我方/代码归爬虫团队；发现优先(refresh 不挤占 discovery)；余额+成本告警；75% 入库率属预期 | Accepted | 2026-06-06 |
| [018](./ADR-018-email-template-unify-asset-snapshot-decouple.md) | **邮件模板统一 Asset 单一真相源** | ADR-011 收尾：Asset(type=email)=唯一真相源；写路径统一 Asset；email_log 去 FK + 加 `template_name` 快照列(审计语义=发送当时名)；历史 user 模板迁 Asset 防丢失；drop email_template 表+双写。落地 BL-099 | Accepted | 2026-06-09 |
| [019](./ADR-019-crawler-runtime-pause-control-surface.md) | **爬虫运行时暂停控制面** | 扩展 ADR-017：爬虫加两层 UI 手控开关(主 `scraping_enabled` 全停所有抓取含 manual_seed / 子 `refresh_enabled` 仅 refresh)；状态存爬虫 DB `service_settings`(非 env, ≤5min 生效)；gate 在入队源(无积压恢复无尖峰)；读 API 不受影响。落地 BL-108 | Accepted | 2026-06-09 |
| [020](./ADR-020-job-queue-bullmq-inprocess-worker.md) | **任务队列 BullMQ 化 + 邮件异步** | InMemoryJobQueue→BullMQ(同 JobQueue 接口调用点不改, 工厂 REDIS_URL→BullMQ 否则 InMemory)；worker 进程内(instrumentation, 不加进程, job 存 Redis 重启续跑)；邮件发送异步(enqueue 立即返 batchId + 进度轮询, 去 60s 同步阻塞)；幂等 batchId+kolId；Redis 挂回退同步。落地 BL-100 | Accepted | 2026-06-11 |
| [021](./ADR-021-frontend-visual-language-horizon.md) | **前端视觉语言切换 — Horizon 紫色美学** | Neural Velocity(cyan)→Horizon(紫 #422AFB + navy 暗色卡 + 20px 圆角 + 柔和浮起阴影 + DM Sans/Poppins)；保底座(App Router/RSC/i18n/RLS)只换视觉；additive token 可回滚；试点=App Shell + /insight + 共享设计系统层。amends ADR-003(像素标准延续/基线重定)+ADR-004(组件视觉演进)。落地 BL-HORIZON-FE-PILOT | Accepted | 2026-07-14 |

## 按主题索引

### 工程流程
- [ADR-001](./ADR-001-option-alpha-infra-first.md) 批次顺序
- [ADR-006](./ADR-006-pre-impl-audit-pattern.md) 开工前审计
- [ADR-008](./ADR-008-strict-manual-verification-mode.md) 验收模式

### 技术栈
- [ADR-002](./ADR-002-tech-stack-latest-greenfield.md) 框架选择

### 视觉 / UI
- [ADR-003](./ADR-003-pixel-perfect-visual-standard.md) 视觉还原标准
- [ADR-004](./ADR-004-f010-component-library-lock.md) 组件库锁定
- [ADR-005](./ADR-005-f007-component-adoption-criteria.md) 组件使用口径
- [ADR-012](./ADR-012-assets-ux-redesign-outreach-first.md) BL-026 /assets UX 重设计（推翻 BL-025 §F004.B 部分）
- [ADR-021](./ADR-021-frontend-visual-language-horizon.md) **前端视觉语言切换 — Horizon 紫色美学**（BL-HORIZON-FE-PILOT / amends ADR-003 基线 + ADR-004 视觉 / additive token 可回滚 / 试点=Shell+/insight+共享层）

### 数据与安全
- [ADR-007](./ADR-007-multi-tenant-rls-strategy.md) 多租户隔离
- [ADR-011](./ADR-011-unified-asset-table-vs-typed-tables.md) 统一 Asset 表 schema（BL-025 前置）
- [ADR-016](./ADR-016-kol-campaign-suggestion-lifecycle.md) kol_campaign 推荐生命周期 suggestion_status 4 态（BL-084 AI Match Panel 数据模型）

### 外部服务集成
- [ADR-009](./ADR-009-aigcgateway-integration.md) AI 网关集成（B2 前置）
- [ADR-010](./ADR-010-domain-strategy-kolquest-com.md) 品牌域 kolquest.com 策略（BI3 / B4 前置）

### 产品方向
- [ADR-013](./ADR-013-ai-native-product-pivot.md) **AI Native 产品转向**（5/10 起 6-10 周重构 / 4 路由 IA / 删 isSaved 概念 / BL-063+ 系列依赖源）— §IA 部分被 ADR-015 supersede
- [ADR-015](./ADR-015-5-route-ia-add-campaigns-nav.md) **5 路由 IA — 加 Campaigns 一级 nav**（5/26 BL-074 / 4→5 路由 / supersedes ADR-013 §IA / 用户反馈"找不到活动列表"触发）

---

## 贡献 ADR

1. 复制 `000-template.md` 为 `ADR-XXX-kebab-title.md`
2. 按模板填写
3. 更新本 README 的两个表（编号索引 + 主题索引）
4. push commit message 用 `docs(adr): ADR-XXX 标题`

## 相关文档

- `framework/harness/pre-impl-adjudication.md` — 决策流程与裁决机制
- `.auto-memory/MEMORY.md` T2 条目 —— 本索引的记忆系统接入点
- `docs/specs/roadmap.md` —— 批次路线图（被 ADR-001 指导）
