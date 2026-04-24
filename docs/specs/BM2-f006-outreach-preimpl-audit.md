# BM2 F006 · /outreach 前置审计（正式）

> **发起者：** johnsong (Generator)
> **日期：** 2026-04-24
> **依据：** `framework/harness/ui-fidelity-guardrail.md` §3 UI feature 强制 pre-impl 审计 + `framework/harness/pre-impl-adjudication.md`
> **状态：** 🟡 **等待 Planner 裁决**。本审计 §12 裁决段**空白**，不自裁决；Generator 不开工直至 Planner 提交 main commit 批复。
> **提交：** 本 audit 单独 commit `docs(audit): BM2-F006 outreach pre-impl audit` 推 main，等待 Planner 回复

## 1. 背景 & 核心漂移（最重要的决议锚点）

spec §F006 `/outreach` 定义为**邮件 composer 工作流**（8 步）：
1. 顶部 Campaign selector（`?campaignId=:id` 预选）
2. KolCampaign 行勾选（`Kol.email` 非空启用 / 无 email 灰 + 行内补 email 按钮）
3. EmailTemplate selector（按 locale 过滤 system 模板）
4. 变量替换预览
5. **AI 定制 dialog** → aigcgateway `kol-email-customize` → 左右对比 → 编辑 → 确认
6. 发送按钮 → Resend 分批（10 msg/min 前端节流 + 后端 sleep guard）+ mock fallback
7. EmailLog 写入 + KolCampaign.status → `contacted`（若当前 pending/quoted 之前）
8. 结果页（成功 N / 失败 M）

Stitch `design-draft/stitch-references/email-center.html`（507 行）呈现的却是一个**邮件分析仪表板（Email Center）**：
- Sub-nav tabs: Overview / Templates (24) / Send Queue (87) / Tracking / Suppression list (142)
- Quick Stats 5 KPI: Sent Today 247 / Open Rate 42% / Reply Rate 11% / Bounce Rate 0.8% / Deliverability 99.2%
- Sending performance 30d bar chart
- Domain health card（DKIM / SPF / DMARC / Reputation 98%）
- Active send queue table（KOL / Campaign / Subject / Status: Sending/Queued/Retry/Failed / Scheduled / Action）
- 3-column bottom row: Top templates / Recent replies / AI Email Insights（含"Generate AI subject lines"按钮）
- Footer: GDPR Compliance / Daily Limit / IP Reputation

**结论：** 设计稿的 Email Center 仪表板与 spec 的 composer 工作流是**两个不同的页面**。用户 2026-04-24 Phase 2 决议明确 BM2 新做页"开工即按新规"，所以本次必须同时满足 (1) spec composer 功能 (2) 设计还原度。根据 `ui-fidelity-guardrail §3.1` 的硬要求，Generator **不得**自选"MVP 化简 drop 分析模块"—— 必须在本审计里列三选项请 Planner 裁决。

---

## 2. Stitch 原型元素逐条分类（`ui-fidelity-guardrail §3.1`）

| # | Stitch 元素 | 数据来源 | 方案 A 照原型 | 方案 B 简化/drop | 方案 C 占位 |
|---|---|---|---|---|---|
| 1 | Sub-nav tabs（Overview / Templates / Send Queue / Tracking / Suppression list） | Templates 需 `system` + `user` template 数；Send Queue 需 MVP 不做的队列表；Tracking 需 opens/clicks；Suppression 需 B4 合规库 | 全实现 + 跳对应子路由 | drop 整条 tab strip | Tabs 保留 4 个但仅 Overview active，其余 disabled + tooltip "Coming in BM2 polish / B4" |
| 2 | Quick Stats 5 KPI（Sent Today / Open / Reply / Bounce / Deliverability） | EmailLog 已有 `sentAt` `openedAt` `repliedAt` `status='bounced'`；Deliverability = `1 - bounceRate` | 全部从 EmailLog 聚合（MVP seed 300 行可出真数据） | drop 整条 KPI strip | 仅 Sent Today + Open Rate + Reply Rate 三格（drop Bounce 和 Deliverability 到 B4） |
| 3 | Sending performance 30d 柱状图 | EmailLog `sentAt` bucket 到 daily | 实现（recharts 已装？需要查） | drop chart 换成 sparkline | Chart scaffold + "Coming soon" overlay |
| 4 | Domain health card（DKIM/SPF/DMARC/Reputation 98%） | 静态；或读 `.env.staging` 域配置；Reputation 需 Resend API | 静态显示全 "Configured/Validated/Enforced/98%"（spec §7.2 kolquest.com 已做 DNS） | drop 整个 card | 实现 3 行 DNS status（DKIM/SPF/DMARC 硬编 Configured）+ Reputation 占位 "—" |
| 5 | Active send queue table | MVP 无 Redis 队列；只有 `EmailLog.status` 的 pending/queued/sent/bounced | drop 全表 | 改成 "Recently sent" 最近 10 条 EmailLog（实数据 + 无 queue 语义）| 空态 "No active queue — sending is synchronous in MVP" |
| 6 | Top templates card | EmailTemplate 使用计数（EmailLog `templateId`） | 聚合 top-3 系统 + user 模板；显示 usage count + 开信率 | drop | 显示 5 个 F002 系统模板的名称 + "Usage stats in B4" |
| 7 | Recent replies card | EmailLog `repliedAt` + KOL join | 实现最近 3 条回复（带截断正文）| drop | 空态 "No replies yet — send your first outreach" |
| 8 | AI Email Insights card + "Generate AI subject lines" 按钮 | 需要 aigcgateway Action（未建） | 新建 Action `email-subject-generator` + 集成 | drop | 硬编一条静态 insight + 按钮 disabled + tooltip "B4" |
| 9 | Footer (GDPR Compliance / Daily Limit / IP Reputation) | Compliance 是静态标识；Daily Limit = 当日 EmailLog count vs 5000 | 全实现 | drop footer | 保留 Compliance + Daily Limit（去掉 IP Reputation） |
| 10 | TopNavBar 中央搜索框 | BM1 AppShell 已有 | 沿用 AppShell（无需新增） | — | — |
| 11 | **Composer 工作流**（spec §F006 8 步流程）**＝不在设计稿** | 核心 MVP 能力 | 必须实现（spec 锚定） | — | — |

**⚠️ 最大决议点 = §3 #A layout reconciliation**

---

## 3. 主决议请求（12 条）

### #A — Layout reconciliation（Stitch dashboard vs Spec composer）

| 方案 | 描述 | 利 | 弊 |
|---|---|---|---|
| A1 | 单页 `/outreach` 合并：顶部 Stitch dashboard 分析区（Quick Stats + Performance chart + Domain Health + Recent replies）+ 中部 composer（spec §F006 8 步） + 底部 Top templates | 1 个页面满足两份要求；URL 稳定；分析与动作一屏 | 页面很长（>3000px vertical）；composer 与 analytics 并置视觉重 |
| A2 | 双路由：`/email-center` = dashboard（设计稿）/ `/outreach` = composer（spec） + F005 CTA 跳 `/outreach?campaignId=` | 关注分离；每页紧凑 | 新增 1 个 nav entry；2 张 visual baseline；design `email-center.html` 占用完整；spec 未提 email-center 路由 |
| A3 | composer 主，analytics 作为右侧 Insights 窄列（320px fixed） | 3-column layout 与 Stitch campaign-detail.html 风格一致 | analytics 空间被挤压，只能放最小精简（Quick Stats + Recent replies）；chart/queue drop |
| A4 | composer only（drop 全部 Stitch dashboard 元素） | 最快 MVP 交付 | 严重违反 ui-fidelity-guardrail；visual baseline 不能还原 email-center.png；重演 BL-007 / BL-008 事件 |
| **建议** | **待 Planner 裁决** | — | — |

### #B — Tabs strip（Overview / Templates / Send Queue / Tracking / Suppression list）

建议：**方案 C（Overview active + 其余 disabled+tooltip "Coming soon"）**。理由：(1) 保视觉还原度（tabs strip 是设计稿 signature 元素）；(2) 幽灵控件规则明确 disabled+tooltip 合规；(3) 避免自删 #3.1 anti-pattern。

但若 layout 选 A2 双路由 = `/email-center` 才有这个 tabs，`/outreach` 没有。⇒ #A 裁决先行。

### #C — Quick Stats 5 KPI（Sent Today / Open / Reply / Bounce / Deliverability）

建议 **方案 A 全实现**（EmailLog 已有所有字段，MVP seed 300 行足以支撑 aggregate 出真数据；算法简单）。仅当 layout = A4 时才 drop。

### #D — Sending performance 30d bar chart

MVP 无 `recharts` 依赖（package.json 扫过；需 Planner 确认是否允许 `npm i recharts`）。
- A1：批准 install `recharts` → 30d daily bars
- A2：用 CSS flex bars + inline `style={{height: '60%'}}` 手搓（与设计稿完全一致，0 新依赖）
- 建议 **A2**（0 依赖 + 1 周 implement 时间）

### #E — Domain Health card

建议 **方案 A（静态显示全绿）**：BI3-F005 已做 kolquest.com DKIM/SPF/DMARC，ADR-010 有记录；Reputation 98% 硬编（MVP 无 Resend Admin API 查 reputation 能力，B4 迭代）。

### #F — Active send queue table

建议 **方案 A2 改 "Recently sent"**：最近 10 条 EmailLog 按 `sentAt DESC`；状态来自 EmailLog.status（sent / bounced / mock_sent）；保持表头 5 列结构（KOL / Campaign / Subject / Status / Sent）。避免"Queue"语义误导。

### #G — Top templates card

建议 **方案 A 聚合**（EmailLog `templateId` + EmailTemplate `name` + 开信率）。若 0 usage fallback 到 F002 系统模板名。

### #H — Recent replies card

建议 **方案 A**（EmailLog where `repliedAt IS NOT NULL` ORDER BY `repliedAt DESC` LIMIT 3 + KOL join）。MVP seed 300 行中 ~20% 有 replied ≈ 60 行供查。Reply body 暂显静态占位（MVP 不存 reply body，B4 才做 Resend webhook）。

### #I — AI Email Insights + "Generate AI subject lines" 按钮

Insights 文案需要新建 aigcgateway Action。两选项：
- A：Planner 新建 `email-subject-generator` Action（~30min 工时），Generator 集成。产出 PRD §2.2 "AI 定制邮件采纳率 ≥ 40%" 指标之外的新集成点
- B：静态文案 +按钮 disabled tooltip "AI subject generator in B4"

建议 **方案 B 静态 + disabled 按钮**（新 Action 超 F006 scope，增量交付风险低）。

### #J — Composer section 放哪

（锚定 #A 裁决）
- 若 A1：中段
- 若 A2：独立页 `/outreach`
- 若 A3：左 2-col 主区

Composer 核心组件（无论 layout 如何都用）：
- CampaignSelector（`<Select>`）
- KolRowTable（`<Table>` + `<Checkbox>` indeterminate + row-level "Add email" inline input）
- TemplateSelector（`<Select>` 按 locale 过滤）
- PreviewPanel（变量替换后的 subject + body）
- AiCustomizeDialog（`<Dialog>` + 左右对比 + edit + confirm）
- SendButton（带 batch progress bar）
- ResultSummary（成功 N / 失败 M）

### #K — AI customize dialog 集成细节

aigcgateway Action `kol-email-customize` (ID `cmob2z6j00001bnole7i8lg9h` per env.md / BM2 handoff) 已建 + 验证。集成要点：
- client：复用 `src/lib/products/generateAiAssets.ts` 的 fetch pattern（base_url + api_key + OpenAI-compatible），或新建 `src/lib/email/customize.ts` 调用 `/v1/actions/:id/run`（action run endpoint）——**需 Planner 确认** aigcgateway actions endpoint contract
- 响应：Claude Haiku 习惯包 ```json code fence（generator_handoff 第 2 条明示），必须 `stripCodeFence()` 再 `JSON.parse`
- 错误处理：retry 1 次，超时 30s（与 generateAiAssets.ts 对齐）
- 埋点：`email.ai_customize_clicked`（弹 dialog 时）+ `email.ai_customize_accepted`（确认 AI 版时）

建议 **新建 `src/lib/email/customize.ts`**（composer 核心路径独立测试；reuse `stripCodeFence` helper，考虑抽到 `src/lib/ai/json-extract.ts`）

### #L — "No email" 行的补 email inline UI

spec 2.3：无 email 的 KolCampaign 行灰 + tooltip "需手动 YouTube 私信" + 行尾"补 email"按钮 → 行内弹输入框 → PATCH `/api/kols/:id {email, emailSource:'manual'}`

需要新 API 路由 `/api/kols/[id]/route.ts` PATCH 支持 `email + emailSource`。BM1 已有 `/api/kols/:id/relationship-status` 路由；本 F006 可扩展或新建。
- 建议 **新建 `PATCH /api/kols/[id]` 统一路径**（后续 F007 CRM 改 relationshipStatus 也走同路径 unify 重构机会）
- 或保持 relationship-status 独立路径，本 F006 新增 `PATCH /api/kols/[id]/email`
- 请 Planner 选择

### #M — Resend 集成 + mock fallback

spec §F006 400-408 明示：
- `process.env.RESEND_API_KEY` 存在 → 真发
- 缺 key → structured log + EmailLog.status='mock_sent'
- 发件地址 `marketer@kolquest.com`（ADR-010）
- retry 1 次（429 / 5xx），超时 30s
- 前端节流 10 msg/min + 后端 sleep guard

需要 `resend` npm package（未装）。建议 **Planner 批准 `npm i resend`**（官方 SDK，1.x LTS，无额外 overhead）；或 用 fetch 直连 Resend API（省依赖，但失 type safety）。

**建议 `npm i resend`**。

### #N — KolCampaign.status 自动更新

spec 387：每封成功后 → KolCampaign.status 更新到 'contacted'（若当前是 pending）

**需在事务内更新**（类似 F005 spendTotal 模式）：
```
await withTenant(tenantId, (tx) => {
  for each selected kol:
    emailLog.create({...})
    if (kolCampaign.status in ['pending', 'quoted']) { // 前进
      kolCampaign.update({status: 'contacted'})
      logAudit({action: 'campaign.kol.status_changed', ...})
    }
})
```
不得用多次独立 prisma 调用（避免部分成功状态）。

### #O — 发送 batch 节流策略

spec：10 msg/min 前端节流 + 后端 sleep guard。

前端实现：`setInterval(6000)` 逐条发。后端 API 路由内 `for..of await sendOne()` 串行 + 每条间 `await sleep(6000)` —— 简单但慢。

建议：**前端触发 server action 一次性提交全部，server-side 内批量 + sleep**（避免 10 次独立 round-trip；关闭浏览器也不打断）。Server action 返回 `{ sent, failed, skipped }` 汇总。

### #P — EmailLog schema 是否齐

扫 BM2-F001 migration：EmailLog 已有 `templateId / aiCustomized`。但 spec §F006 流程需要：
- `mockSent` status ✓（用 `status='mock_sent'`）
- `errorMessage` 字段（失败原因）：BM2-F001 已加 `bounceReason`，复用 ✓
- 发件人 `fromAddress` ✓
- `aiCustomized` bool ✓（采纳后 true）

**结论：schema 齐，无需新 migration。** ✓

### #Q — Visual baseline 策略

`ui-fidelity-guardrail §2.4`：`tests/screenshots/baseline/en-outreach.png` 必须入 git。本 F006 作为 **新页面**，若视觉还原度低（layout 选 A4），F011 gates 会 FAIL。

建议：
- 实现阶段同时生成 baseline（`npx playwright test tests/e2e/outreach-*.spec.ts --update-snapshots`）
- 在 VPS 跑（本地 WSL 无 playwright system libs）
- Commit PNG 入 git

---

## 4. 必用公共组件清单（`ui-fidelity-guardrail §3.2`）

来自 `src/components/ui/`（hotfix F001 刚抽取）：
- `<Button variant="primary-gradient \| secondary \| ghost \| danger">` — 所有 CTA
- `<Input>` + `<Label>` + `<FieldError>` + `<FieldHint>` — 补 email 行内输入
- `<Textarea>` — composer 预览区的可编辑 body（AI 定制 dialog）
- `<Select>` — CampaignSelector, TemplateSelector
- `<Dialog>` + Parts — AiCustomizeDialog 左右对比 modal
- `<Table>` + `<THead>` + `<TBody>` + `<TRow>` + `<TCell>` — KolRow 选表 + Active send queue 改 Recently sent
- `<Checkbox>` + `indeterminate` — 全选 / 行勾选

来自 `src/components/common/`：
- `<GlassPanel>` — 所有半透明容器
- `<SectionHeader>` — 每个 section 顶
- `<StatCard>` — Quick Stats 5 KPI（复用 dashboard F007 同款）
- `<StatusBadge domain="email">` — EmailLog.status → sent/bounced/mock_sent pill
- `<ChipButton>` — Active Filter chips（若需要 campaign filter）
- `<AvatarWithPlatformBadge>` — KolRow / Recent replies

**需新抽的组件：** **无**（hotfix F001 覆盖齐）。Generator 不私自新建业务组件。

---

## 5. 幽灵控件清单（`ui-fidelity-guardrail §3.3`）

按 #B 裁决默认 "C disabled+tooltip"：

| 控件 | MVP 是否接功能 | 处置 |
|---|---|---|
| Tab: Templates (24) | 不（模板 CRUD 是 B4） | disabled + tooltip "Template editor in B4" |
| Tab: Send Queue (87) | 不（无 queue） | disabled + tooltip "Queue UI in B4" |
| Tab: Tracking | 不（opens/clicks tracking 是 B4 webhook） | disabled + tooltip "B4" |
| Tab: Suppression list (142) | 不（合规库 B4） | disabled + tooltip "B4" |
| "Generate AI subject lines" 按钮 | 不（需新 Action） | disabled + tooltip "AI subject lines in B4" |
| Top template row "more" 按钮 | 不 | hidden |

**不得保留 active 但无 handler 的幽灵控件。**

---

## 6. 新依赖

| Package | 版本 | 理由 |
|---|---|---|
| `resend` | ^6.x | 官方 SDK，Node 18+；MVP 邮件发送核心 |

**Planner 批准后 Generator 执行 `npm i resend` + lock file 更新。** 不引其他依赖。

---

## 7. 测试策略

### L1 unit
- `src/lib/email/resend.ts` — mock Resend + env.RESEND_API_KEY 缺失 fallback
- `src/lib/email/customize.ts` — mock aigcgateway + stripCodeFence 健壮性（测试 code fence / 纯 JSON / 畸形）
- `src/lib/email/variable-substitute.ts` — 变量替换 pure function

### L2 integration
- `tests/integration/outreach-flow.test.ts`：
  - 选 3 个 KOL（其中 1 个无 email）→ send batch → EmailLog 2 条 sent + 1 条 skipped
  - KolCampaign.status pending → contacted 自动
  - audit_log `campaign.kol.status_changed` 2 条
  - event_log `email.sent` / `email.ai_customize_clicked` / `email.ai_customize_accepted` 写入
- RLS 跨租户隔离

### L3 E2E（staging）
- `tests/e2e/outreach-flow.spec.ts`（BM1 F009 教训：禁 networkidle / 不硬编 count / revalidate 后 15s / locale URL）
- Journey: /campaigns/:id → outreach CTA → /outreach?campaignId= → select 3 kol → select template → AI 定制 dialog → accept AI → send → 成功 3 封

### Visual
- `tests/screenshots/baseline/en-outreach.png` 入 git（F007 前硬门槛）

---

## 8. i18n

新 namespace `outreach.*` 约 40-60 keys：
- page title / subtitle / tabs / kpi labels / composer labels / AI dialog labels / result summary / errors

en + zh 真译；ja/ko/es en-stub（对齐 BM1 F008 pattern）。

---

## 9. 实现清单（裁决后按此推进）

裁决完成后 Generator 会按以下顺序落地（估 ~5h 工作）：

1. `src/lib/email/customize.ts` — aigcgateway Action 调用（30 min）
2. `src/lib/email/resend.ts` — Resend + mock fallback（30 min）
3. `src/lib/email/variable-substitute.ts` — pure fn（15 min）
4. `src/lib/email/batch-send.ts` — server-side batch with sleep guard（30 min）
5. `src/app/api/kols/[id]/route.ts` PATCH — 补 email 路由（15 min）
6. `src/app/api/outreach/send/route.ts` — send 批量 API（option; 可 Server Action 代替）（30 min）
7. `src/app/[locale]/(app)/outreach/page.tsx` RSC + 5-6 子组件（composer + analytics 按 #A 裁决）（120 min）
8. Integration + unit tests（90 min）
9. i18n + lint + typecheck + build（30 min）
10. Staging deploy + visual baseline（30 min）

---

## 10. BM1 F009 教训遵守清单（重申）

- [x] E2E 不用 `waitForLoadState("networkidle")`
- [x] 不硬编 seed-dependent count（batch send 用 regex/>0 断言）
- [x] revalidate 后 polling 15s
- [x] 所有 redirect / Link locale-prefixed
- [x] send batch 后同时 revalidate `/campaigns/[id]` + `/outreach`（避免 F005 saved-row staleness 重演）

---

## 11. 风险登记

| 风险 | 缓解 |
|---|---|
| aigcgateway Action run endpoint 契约未确认 | §3 #K 请 Planner 确认 request/response shape |
| `resend` npm 包 install 引入 tree-shake 成本 | Resend 官方轻（无 duplicate deps）；实测再看 bundle 大小 |
| Quick Stats / chart 需 EmailLog seed 数据充足 | prisma/seed.ts 已有 300 行 EmailLog；staging `npm run db:seed` 确认 |
| Visual baseline 本地无法生成（WSL 缺 Playwright libs） | 在 VPS 跑 `--update-snapshots`（BM1 F009 相同策略）|
| Composer + analytics 合页 >3000px 长度不适应移动端 | MVP 只测 desktop；移动端降级 Post-MVP |

---

## 12. Planner 裁决（johnsong Planner · 2026-04-24）

### 12.1 短格式裁决

```
#A:A1  #B:C  #C:A  #D:A2  #E:A  #F:A2  #G:A  #H:A  #I:B
#J:per #A=A1（composer 中段）  #K:新建 src/lib/email/customize.ts
#L:新建 PATCH /api/kols/[id] 只接 email+emailSource（不 unify）
#M:批准 npm i resend  #N:A  #O:server-action server-side batch
#P:✓ schema 齐无需 migration  #Q:VPS 跑 --update-snapshots 入 git
```

### 12.2 逐条裁决与理由

| # | 决定 | 理由 |
|---|---|---|
| A | **A1（单页 analytics + composer）** | **PRD §4.1 第 7 行明示 `/outreach` 含"选 KOL + 选模板 + AI 定制 + 发送 + 发件记录"**——发件记录 = Stitch dashboard 部分（Recently sent / Top templates / Recent replies），不是独立页。A2 双路由反而违 PRD。A3 挤 analytics 到窄列丢太多 Stitch 元素。A4 违 guardrail。A1 本质是 PRD 原定义。 |
| B | **C（tabs 保留 4 个但除 Overview 外 disabled+tooltip）** | 视觉还原度 + 幽灵控件合规；tooltip 标"B4"（对齐 PRD §4.2 Out of Scope 全交 B4）。自删 tabs strip 违 §3.1 anti-pattern |
| C | **A（5 KPI 全实现）** | EmailLog 已有 sentAt/openedAt/repliedAt/status（bounced），MVP seed 300 行支撑聚合；算法简单：Sent Today=count(sentAt::date=today) / OpenRate=openedAt/sentAt / ReplyRate=repliedAt/sentAt / BounceRate=bounced/sent / Deliverability=1-BounceRate。注意：**prod 实际值会因无 webhook 而停留在 seed 基线**，UI 上别暗示"实时"字样，标注 "Based on last 30d" |
| D | **A2（CSS flex bars 手搓，不装 recharts）** | 0 新依赖；与 Stitch HTML 原文 inline `style={{height:'60%'}}` 完全一致（bars 是 div flex 实现）；recharts 留给 F009 ROI 页真正需要时装 |
| E | **A（静态全绿 + Reputation 98% 硬编）** | BI3-F005 + ADR-010 确认 kolquest.com DKIM/SPF/DMARC 全配；Resend admin API 查 reputation 是 B4 功能；98% 是保守静态值 |
| F | **A2（改 "Recently sent" 最近 10 条 EmailLog desc）** | 避免 "Queue" 语义误导（MVP 无真队列，同步发）；保表头 5 列（KOL/Campaign/Subject/Status/Sent at）；StatusBadge domain="email" (sent/bounced/mock_sent) |
| G | **A（聚合真实）** | EmailLog.templateId + EmailTemplate.name join；Top-3 by usage DESC；若 usage=0 fallback 显 F002 系统模板名 + "Usage stats from first send" |
| H | **A（Recent replies）** | EmailLog WHERE repliedAt IS NOT NULL ORDER BY repliedAt DESC LIMIT 3；KOL.displayName + 正文截断 80 字（seed 无 reply body → 显 "—"+ tooltip "Reply body requires Resend webhook (B4)"）|
| I | **B（静态 insight + 按钮 disabled tooltip "AI subject lines in B4"）** | 新 Action 超 F006 scope；BM2 aigcgateway 已建 3 Action 够用；第 4 Action 属 B4 范围 |
| J | **Composer section 位于页面中段**（per A1 layout） | 顺序：Header → Tabs → Quick Stats 5 KPI → **Composer 8 步**（sticky `<section id="composer">` 默认锚滚定位，若 `?campaignId=` 预选则页面 onLoad scroll-into-view composer）→ Sending performance chart → 3-col (Top templates / Recent replies / Domain health) → Recently sent table → Footer (Daily Limit)。**composer 必须是进入页面后最快可用的单元。** |
| K | **新建 `src/lib/email/customize.ts`**（不 reuse generateAiAssets.ts） | Email 变量替换逻辑独立于 Product AI 素材生成；clean boundary 便于独立测试。提取 `stripCodeFence` helper 到 `src/lib/ai/json-extract.ts`（F007/F010 亦复用）|
| L | **新建 `PATCH /api/kols/[id]`，仅接 email + emailSource**；现有 `/api/kols/[id]/relationship-status` 保留不合并 | 保留独立路由避免本次改动面大（铁律 6 executor 边界）；unify 是 refactor，BL 登记后续批次做。新建的 PATCH 路由 zod 校验（email 格式 / emailSource 枚举 'manual'/'youtube-about'/'ai-extracted'）+ RLS + event_log `kol.email_updated` |
| M | **批准 `npm i resend`**（官方 SDK，~6.x） | 官方轻量；type-safe；spec §F006 明示依赖；替代方案（fetch 直连）失 types 得不偿失。commit message 注 "Resend 6.x 引入用于 BM2 F006 邮件发送" |
| N | **A（事务 + audit_log）** | 必须 prisma.$transaction 或 withTenant txn 包裹；按 generator audit §3 #N 模板实现；部分失败必须 rollback 避免状态不一致 |
| O | **Server Action server-side batch**（server-side `for...of await sendOne()` + `await sleep(6000)`） | 避免 10x round-trip 网络开销；浏览器关闭不中断；前端进度条用 Server Action streaming response 或直接等 promise 完成给 `{ sent, failed, skipped }` 结果 |
| P | ✓ schema 齐全 | BM2-F001 migration 已加 EmailLog.templateId / aiCustomized / bounceReason；无需新 migration。`fromAddress` 也已有 |
| Q | **VPS 跑 `--update-snapshots`** | 沿用 BM1 F009 教训；本地 WSL 无 sudo 装 Playwright libs；staging 已装，可直接跑 |

### 12.3 aigcgateway Action HTTP 契约（回应 §3 #K Planner 确认需求）

**Endpoint（生产）：** `POST https://aigc.guangai.ai/v1/actions/{action_id}/run`
**内网替代：** `POST http://localhost:3099/v1/actions/{action_id}/run`（同 VM 走内网零公网延迟，per environment.md）
**Auth：** `Authorization: Bearer ${AIGCGATEWAY_API_KEY}`
**Request body：**
```json
{
  "variables": { "product_name": "...", "kol_name": "...", ... },
  "dry_run": false
}
```
**Response（成功）：**
```json
{
  "output": "<raw model response, possibly with ```json fence for Claude>",
  "traceId": "trc_xxx",
  "usage": { "prompt_tokens": 549, "output_tokens": 287, "total_tokens": 836 }
}
```
**错误：** HTTP 4xx/5xx + body `{ error: "...", message: "..." }`

**Generator 在 `src/lib/email/customize.ts` 实现样板：**

```typescript
import 'dotenv/config'; // 避免 BL-001 同类问题
import { stripCodeFence } from '@/lib/ai/json-extract';

const ACTION_ID = 'cmob2z6j00001bnole7i8lg9h';

export async function customizeEmail(input: CustomizeEmailInput): Promise<CustomizeEmailResult> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) throw new Error('AIGCGATEWAY_API_KEY not set');

  const baseUrl = process.env.AIGCGATEWAY_BASE_URL ?? 'http://localhost:3099/v1';
  const url = `${baseUrl}/actions/${ACTION_ID}/run`;

  const res = await fetchWithRetry(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ variables: toVariables(input), dry_run: false }),
    timeout: 30_000,
    retries: 1,
  });

  const { output, traceId } = await res.json();
  const parsed = JSON.parse(stripCodeFence(output)) as { subject: string; body: string; rationale: string };
  return { ...parsed, traceId };
}
```

### 12.4 同步修订清单

- **BM2 spec §F006**：无需修订（acceptance 保持当前文本；PRD §4.1 已含"发件记录"）
- **features.json BM2 F006 acceptance**：无需修订（已含 mock fallback / stripCodeFence / contactStatus 更新 / event_log 3 事件等关键要点）
- **package.json**：Generator 执行 `npm i resend` 后随 commit 一起
- **framework/ui-fidelity-guardrail.md**：无修订
- **新文件**：
  - `src/lib/email/customize.ts` (aigcgateway Action 调用 + stripCodeFence)
  - `src/lib/email/resend.ts` (Resend SDK wrapper + mock fallback)
  - `src/lib/email/variable-substitute.ts` (pure fn 变量替换)
  - `src/lib/email/batch-send.ts` (server-side batch with sleep guard)
  - `src/lib/ai/json-extract.ts` (stripCodeFence 抽取公用)
  - `src/app/api/kols/[id]/route.ts` (PATCH email + emailSource)
  - `src/app/[locale]/(app)/outreach/page.tsx` + 子组件
- **backlog 登记**：BL-011（新）"`/api/kols/[id]` 统一 PATCH 路由 refactor（F006 email + BM1 relationship-status 合一）"——未来批次做

### 12.5 额外叮嘱（非阻塞）

1. **composer 锚点滚动**：`?campaignId=` 预选时，`useEffect` 触发 `document.getElementById('composer')?.scrollIntoView({behavior:'smooth', block:'start'})`；无 query 时默认顶部 dashboard overview
2. **Composer visual hierarchy**：composer `<section>` 用 `glass-panel` + `cyan ring` border 强调"这是当前行动区"，与 analytics 区视觉区分
3. **Quick Stats 标签文案**：在 Quick Stats 块标题处加 "Last 30 days" 小字；右上角 info icon tooltip "Metrics from EmailLog seed; live updates require webhook (B4)"——避免 prod 上线后用户误认为数据实时
4. **AI Insights 静态文本**：写个友好的占位，如 "Based on recent sends, personalized subject lines drove 35% higher open rates in similar campaigns. Generate subject variants with AI (Coming in B4)"
5. **Send batch 失败的 UX**：结果页分三段（Sent X / Failed Y / Skipped Z with reasons: no-email / AI timeout / Resend error）；失败给 retry 单条按钮
6. **BM1 F009 教训清单**：已在 audit §10 列齐，实施时 E2E 必遵守
7. **audit_log 2 种 action name**：本次 F006 写入 `campaign.kol.status_changed` + `kol.email_updated`，避免命名漂移
8. **埋点 3 事件**：`email.sent` / `email.ai_customize_clicked` / `email.ai_customize_accepted`（spec §F006 指定）
9. **Resend 速率**：Resend 默认 100 msg/sec，MVP 10 msg/min 前端/后端节流已极保守
10. **dotenv import**：`src/lib/email/*.ts` 所有独立使用 env var 的文件顶部加 `import 'dotenv/config';`（BL-001 吸取教训）

### 12.6 开工确认

**Planner 本次 commit 推 main 后 Generator 立即开工**。按 §9 实现清单顺序推进（~5h 工作量）。开工前确认：
- [x] resend SDK install 已批准
- [x] aigcgateway action endpoint 已给契约（§12.3）
- [x] 公共组件库就绪（hotfix F001 提前完成）
- [x] F005 已 done（依赖上游 Campaign 数据完整）
- [x] BM1 F009 E2E 教训必须遵守
- [x] audit §10 清单逐项符合

---

**Generator 开工（本审计 §12 填写后）。本次 audit 文件单 commit 推 main 即完成裁决。**
