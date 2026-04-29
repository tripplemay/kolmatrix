---
name: MVP-internal-demo-prep
description: MVP 内部团队 demo 准备 - Dashboard 三元素 + 真数据替换 mock + Q5 Product 字段强制 + 5 款游戏 Products seed + 团队 README + Prod L2 烟测 + 文案 polish
status: decisions-locked, awaits B5 done
created_by: johnsong (Planner)
created_at: 2026-04-30
decisions_locked_at: 2026-04-30
revised_at: 2026-04-30（用户接受 polish 审计 P0 4 项并入：F006 Dashboard 真数据替 mock + F007 文案 polish 整理）
estimated_effort: ~3 day Generator + 0.5 day Reviewer
features_count: 7
prerequisites:
  - B5-kol-data-enrichment done（schema 4 字段 + 详情页改造完成）
  - 用户触发 prod redeploy（B5 schema 落地）
  - aigcgateway 余额 ≥ $5（F003 aiAssets 部分预生成）
trigger: B5 done 后立即启动
---

# MVP-internal-demo-prep — MVP 内部团队 demo 准备

## 1. 背景与目标

### 1.1 重新定位 MVP 受众（2026-04-30 用户澄清）

原 `MVP-seed-demo-prep` + `MVP-prod-launch-smoke` spec 假设 MVP 上线对外发邀请给 5-10 家游戏工作室种子用户。

**2026-04-30 用户澄清：** MVP 真实受众是**团队内部其他岗位成员**（产品 / 运营 / 设计等），不是外部客户。

**核心约束：**
1. ✅ 隐私风险不适用（团队同事互见数据无所谓）
2. ⚠️ **不为 MVP 临时性方案制造技术债** —— 任何 MVP 用的代码 / 数据模型 / 工作流，必须能直接接续到正式版本

**关键架构决策（零技术债）：** 走现有 Demo Studio tenant + 共用 admin / marketer 账号，不写 demo seed 脚本：
- Schema 不动 → User → Tenant 一对多就是原本设计
- RLS 不动 → 继续按 tenantId 隔离
- 团队所有成员共用 `admin@kolmatrix.local` + `marketer@kolmatrix.local`
- 转正式版本时，团队 user 账号继续在 Demo Studio；真客户来时按原本设计 AccessRequest 流程建新 tenant + user

### 1.2 目标

1. **生产 demo 环境就绪：** prod DB seed + AIGC/Resend keys 已就位
2. **Dashboard 与 PRD §4.1 一致：** 补 3 元素（workflow 6 步图 / CPI 卡 hardcoded / 30d ROI 趋势）
3. **AI 推广素材体验完整：** 5 款典型游戏 Products + 部分 aiAssets 预生成
4. **Product 输入合规：** Q5 强制 targetAudience 必填
5. **团队 onboarding：** 单文件 README 含登录 + Journey 操作指南
6. **Prod L2 烟测覆盖：** ≥30 条 checklist 防止上线 bug

### 1.3 非目标

- ❌ 不为外部种子用户准备（demo 仅团队内部）
- ❌ 不写 demo:seed 脚本（用现有 prisma/seed.ts）
- ❌ 不做用户批量创建（团队共用现有账号）
- ❌ 不出 PDF / 多语言 onboarding 文档（README en 单文件）
- ❌ 不接竞品 CPI 实时数据（hardcoded 行业基准已够 demo）

## 2. 范围（7 features）

> **2026-04-30 用户接受 polish 审计**：原 5 features → 7 features，新增 F006 Dashboard 真数据替 mock + F007 文案 polish 整理。详见 `docs/product/MVP-polish-audit-2026-04-30.md` §"P0 — 建议并入 MVP-internal-demo-prep"。


### F001 — Dashboard 补三元素（workflow 6 步图 + CPI hardcoded 卡 + 30d ROI 趋势）

**Executor：** generator
**估时：** ~1 day

**实现：**

1. **Workflow 6 步图（`src/features/dashboard/WorkflowSteps.tsx`）**
   - 6 步流程节点：录入产品 → 找 KOL → 创建 Campaign → 发邮件 → 录 Revenue → 看 ROI
   - 每步含 icon + 标题 + 完成状态指示（基于当前 tenant 数据是否已走过该步）
   - 设计参考 Stitch Dashboard 流程线条样式

2. **CPI 对比卡（`src/features/dashboard/CompetitorCpiCard.tsx`）**
   - hardcoded 6-8 个游戏品类 CPI 基准（MOBA / RPG / FPS / Casual / Strategy / Sports / Simulation / Card）
   - **数据来源：** 行业公开报告（Generator 开工时查 Sensor Tower 2025 / data.ai / AppsFlyer 状态报告 公开数据）
   - 卡角标 "Sample data" + 小字 "Source: Industry benchmarks Q1 2025"
   - 视觉：bar chart 横向，KOLMatrix tenant 自家 CPI 标"我的"，对比品类基线

3. **30 天 ROI 趋势图（`src/features/dashboard/RoiTrendCard.tsx`）**
   - 复用 `/roi` 页的 trend 数据接口（`/api/roi/trend`）
   - 折线图，X 轴最近 30 天，Y 轴 ROI%
   - 无数据 friendly empty state "No ROI data yet"

**Acceptance：**
- 3 个组件 import 入 `src/app/[locale]/(app)/dashboard/page.tsx`
- 在原有 `KpiRow` 下方按"workflow → CPI → ROI 趋势"顺序插入
- 适配 mobile（< 640px 单列）
- visual baseline 更新（dashboard.spec.ts）
- i18n keys 新增（en/zh + 跑 i18n:translate 补 ja/ko/es）
- staging git_sha 与本 commit 一致（curl https://staging.kol.guangai.ai/api/health | jq .git_sha 验证）

### F002 — Product `targetAudience` zod 强制 + i18n error message

**Executor：** generator
**估时：** ~30 min

**实现：**

1. **Form-level zod 校验：**
   ```typescript
   // src/app/[locale]/(app)/knowledge-base/actions.ts
   const productSchema = z.object({
     name: z.string().min(1),
     category: z.string().min(1),
     targetAudience: z.string().min(1, { message: t("errors.targetAudienceRequired") }),
     uniqueSellingPoints: z.string().min(1),
     // ...
   });
   ```

2. **i18n error message：**
   ```json
   // messages/en/knowledge-base.json
   "errors": { "targetAudienceRequired": "Target audience is required" }
   // messages/zh/knowledge-base.json
   "errors": { "targetAudienceRequired": "请填写目标受众" }
   ```

3. **Schema / DB 不动**（PRD §6.2 schema 自身就 nullable，仅 form-level 强制）

**Acceptance：**
- 提交空 targetAudience → form 显示 i18n error
- 提交非空 → 通过（行为同前）
- existing tests 不破坏
- 跑 i18n:translate 补 ja/ko/es
- staging git_sha 与本 commit 一致

### F003 — 5 款典型游戏 Products seed 进 Demo Studio + aiAssets 混合策略

**Executor：** generator
**估时：** ~2-3h

**实现：**

1. **扩展 `prisma/seed.ts` 在 Demo Studio tenant 下 upsert 5 个 Product：**

| # | name | category | targetAudience | aiAssets | 演示价值 |
|---|---|---|---|---|---|
| 1 | Honor of Kings | MOBA | 18-24 SEA + China gamers | **预生成** | MOBA 头部 |
| 2 | Genshin Impact | Open World RPG | 18-30 anime + open-world fans | **预生成** | RPG 全球 |
| 3 | PUBG Mobile | Battle Royale / FPS | 18-24 male competitive shooters | **预生成** | FPS/BR |
| 4 | Pokemon Go | AR / Casual | All ages, family-friendly AR | **null** | 让团队点 "Generate AI assets" 看 AI 流程 |
| 5 | Clash Royale | Strategy / Card | 18-30 strategy mobile gamers | **null** | 让团队点 "Generate AI assets" 看 AI 流程 |

2. **3 个预生成的 `aiAssets` JSON 内容**（hardcoded 高质量样本，含 emailTemplates × 3 + videoScripts × 2，模拟 aigcgateway 输出格式）

3. **2 个空 `aiAssets`**（让团队点 "Generate AI assets" 按钮触发 aigcgateway 真实调用）

4. **Idempotent**：以 `(tenantId, name)` 为自然键 upsert，重跑不重复

**Acceptance：**
- `npm run db:seed` 在 staging + prod 跑通后 Demo Studio 含 5 个 Product
- 3 个有 aiAssets（点查看显示完整素材），2 个 null（点 generate 触发 AIGC）
- tests/integration/seed-demo-products.test.ts 验证幂等 + 内容完整
- staging git_sha 与本 commit 一致

### F004 — 团队内部 demo README

**Executor：** generator
**估时：** ~2-3h

**实现：**

新建 `docs/internal/team-demo-guide.md`（en，单文件）：

```markdown
# KOLMatrix Internal Team Demo Guide

## 1. Login
- URL: https://kol.guangai.ai/login
- Admin: admin@kolmatrix.local / [team Notion 内部分享]
- Marketer: marketer@kolmatrix.local / [team Notion 内部分享]

## 2. 3 Journeys to Try

### Journey A: Find KOLs → Create Campaign → Send Email
1. Click "KOL Discovery" in sidebar
2. Set filters: Region=Asia, Followers>500K, Categories=RPG
3. Open Smart Match Dialog → enter Product context
4. Save 5-8 KOLs to a new Campaign (click "Save All to Campaign")
5. Open Campaign detail → review KOL panel
6. Click "Outreach" → select template → click AI Customize → preview → send 1 test email

### Journey B: Review Campaign → ROI → Weekly Report
1. Open existing "Honor of Kings Q1 Launch" Campaign (Completed status)
2. Note revenueRecorded = $120K → ROI auto-calculated
3. Visit /roi → see 4 KPIs + 30-day trend + AI Insights
4. Visit /weekly-report → click Generate (or use existing) → download PDF

### Journey C: Knowledge Base → AI Assets → Link to Campaign
1. Visit /knowledge-base
2. Open "Honor of Kings" product (has pre-generated aiAssets)
3. Open "Pokemon Go" or "Clash Royale" (aiAssets null)
4. Click "Generate AI assets" → wait 5-10s → see AI flow
5. Create new Campaign linking to this product

## 3. What to See on Each Page

### Dashboard
- 5 KPI + Workflow steps + CPI comparison (sample data) + 30d ROI trend + Recommended KOLs

### Discovery
- 15-dim filter + Smart Match Dialog (B7a embedding) + Save Search

### Database
- AI Intelligence panel (3 cards from B7b) + Tier/Game filters + bulk actions

### KOL Detail (/kols/[id])
- Banner + latest 6 videos + topic word cloud + real engagementRate (from B5)

### Campaigns
- List + Create + Detail with KOL panel + AI Suggestions (from B7b)

### Outreach
- Template selection (system + user) + AI customize + send + Templates library (from B4)

### CRM
- Stage distribution + funnel + total cooperation KPI

### ROI
- 4 KPIs + trend + AI Insights panel (from BM2)

### Weekly Report
- One-click generate + PDF export + share link (anonymous via /shared/weekly-report/[token])

## 4. Known Limits

- Demo data is shared across the team (do not use for production)
- B8 KOL similar recommendation + multilingual matching → coming after invitation week 2
- Resend webhook tracking (open / reply / bounce) → B4-extended (Post-MVP)
- BullMQ workers → currently in-memory stub (will be enabled in B5 BullMQ batch)
- AIGC API call cost: ~$0.02 per Smart Match / weekly report
- Production redeploy required after B5 (schema migration)

## 5. Feedback Channel

- 团队内部 Notion: [link to be filled by Planner]
- Slack: #kolmatrix-feedback
- 严重 bug: 创建 Github issue
```

**Acceptance：**
- 文件存在 `docs/internal/team-demo-guide.md`
- 5 sections 全（login / 3 journeys / 8 pages / known limits / feedback）
- 不需要 i18n（仅 en）
- 不需要截图（团队成员看实际页面）
- staging git_sha 与本 commit 一致

### F005 — Prod L2 烟测执行 + signoff

**Executor：** codex (Reviewer)
**估时：** ~0.5 day

**前置（Planner planning 阶段产出）：**

`docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md`（≥30 条 checkbox，Planner 在 verifying 阶段开始前起草）：

#### A. 健康基线（5 条）
- curl /api/health 返回 200 + healthy
- git_sha = 本 sprint last commit
- DB latency < 500ms
- redis = stub
- uptime > 60s

#### B. 公开 endpoint smoke（5 条）
- /en/login 200
- 9 个受保护路由（discovery / database / kols/[id] / knowledge-base / campaigns / outreach / crm / roi / weekly-report）→ 307 → /en/login
- /shared/weekly-report/invalid 404
- /api/health 公开
- kolquest.com 301 → kol.guangai.ai

#### C. 登录态功能验收（≥10 条）
- /en/dashboard：5 KPI + workflow + CPI + ROI 趋势 + 推荐 KOL 全显示
- /en/discovery：15 维 filter + Smart Match Dialog 弹出
- /en/database：3 卡 AI Intelligence + Tier filter
- /en/kols/[id]：banner + 最近 6 视频 + 词云 + 无 Audience tab
- /en/knowledge-base：5 Products（3 预生成 + 2 null）+ 点 generate 触发 AIGC
- /en/campaigns：3 demo Campaigns + filter
- /en/campaigns/:id：KOL panel + AI Suggestions
- /en/outreach：模板下拉 system + user + AI 定制
- /en/crm：6 卡 + 漏斗
- /en/roi：4 KPI + AI Insights
- /en/weekly-report：生成 + PDF 导出 + 分享链接

#### D. 跨 locale（4 条）
- /zh/dashboard 正常
- /zh/kols/[id] 词云 zh 显示正常
- /ja/discovery filter 译文正常
- /es/outreach 译文正常

#### E. 视觉基线（3 条）
- staging visual-regression 全绿
- prod 浏览器对比 staging 无视觉漂移
- mobile viewport 适配

#### F. 自动化（3 条）
- codex-e2e 跑 prod base-url：bm1-flow + journey-a + journey-b 全 PASS
- tests/integration 本地全绿
- CI main HEAD 全绿

#### G. 性能（可选 4 条）
- lighthouse perf ≥ 70
- LCP < 2.5s
- FID < 100ms
- CLS < 0.1

**Acceptance：**
- 全部 A-G 清单勾选
- 任何 P0/P1 阻断 → 立即写 evaluator_feedback + status=fixing
- P2/P3 残余风险 → 写 backlog 注明 priority 不阻塞
- 报告 ≥ 50 行，含烟测命令 + 关键 endpoint 数据
- signoff 中明示"prod 可承接团队内部 demo"

### F006 — Dashboard 真数据替换 mock（EmailPerformanceCard + RecentActivityCard）

**Executor：** generator
**估时：** ~5-7h（P0-1 ~3-4h + P0-2 ~2-3h）

**实现：**

1. **EmailPerformanceCard 真接 EmailLog（P0-1）**
   - 当前：`src/features/dashboard/EmailPerformanceCard.tsx` 用 `EMAIL_PERFORMANCE_DATA`（14 天 sine wave hardcoded mock）
   - 改造：新增 `src/lib/dashboard/email-performance.ts` 从 `EmailLog` 表 aggregate 14 天数据：
     ```typescript
     // 按 createdAt 切 14 天桶；status='sent' 计 sent；
     // openedAt!=null 计 opened；replyAt!=null 计 replied
     ```
   - 数据为空时（新 tenant）显示 friendly empty state："Send your first batch via /outreach to see performance trends"
   - 删除 `src/features/dashboard/mocks.ts` 中的 `EMAIL_PERFORMANCE_DATA`

2. **RecentActivityCard 真接 audit_log（P0-2）**
   - 当前：用 `RECENT_ACTIVITIES`（5 条 hardcoded 假活动）
   - 改造：新增 `src/lib/dashboard/recent-activity.ts` 从 `AuditLog` 表 query 当前 tenant 最近 5 条：
     ```typescript
     // SELECT actor_user_email, action, before_value, after_value, created_at
     // FROM audit_log
     // WHERE tenant_id = ?
     // ORDER BY created_at DESC
     // LIMIT 5
     ```
   - 把 audit_log 行转译为自然语言（i18n）：
     - `kol.relationship_status_changed` → "{actor} marked {kolName} as '{newStatus}'"
     - `campaign.created` → "{actor} created campaign '{name}'"
     - `kol.email_updated` → "{actor} added email for {kolName}"
     - 等
   - 数据为空时显示 friendly empty state："Activity from your team will appear here"
   - 删除 `src/features/dashboard/mocks.ts` 中的 `RECENT_ACTIVITIES`
   - 删除 `mocks.ts` 整个文件（如清空后无其他 export）

**Acceptance：**
- `src/features/dashboard/mocks.ts` 删除或清空
- Dashboard EmailPerformanceCard 显示当前 tenant 真实 EmailLog 14 天聚合
- Dashboard RecentActivityCard 显示当前 tenant 真实 audit_log 最近 5 条
- 新 tenant（空数据）显示友好 empty state
- i18n keys 新增（en/zh + 跑 i18n:translate 补 ja/ko/es）
- tests/integration/dashboard-real-data.test.ts 验证 EmailLog → 14 天聚合 + audit_log → 自然语言转译
- staging git_sha 与本 commit 一致

### F007 — 文案 polish 整理（登录页重写 + /campaigns AiSuggestionsCard + /api/health redis + /campaigns Import）

**Executor：** generator
**估时：** ~1.5h（原 30 min + 登录页重写 1h）

**实现：**

1. **登录页左侧文案完全重写（P0-5，2026-04-30 用户 4 轮讨论 lock）**

   **背景：** 当前文案虚假宣传严重（"800K+ creators / 94% AI 精度 / 9 locales / 200+ studios trust us / 5 假工作室名"），与 PRD §1.1 / §3.1 真实定位脱节。详细审计见对话记录（Q1-Q4 + Title C + Subtitle γ + 用户其他 4 项确认）。

   **i18n keys 改值（`messages/en.json` + `messages/zh.json` 的 `auth.login` 节点）：**

   ```jsonc
   // 改值
   "eyebrow":      "GAME KOL OPERATIONS · 2026"           // 原 "CREATOR OPERATIONS · 2026"
                   "游戏 KOL 运营中枢 · 2026"               // 原 "创作者运营中枢 · 2026"

   "heroTitle":    "<accent>The KOL command center</accent><br></br>for global game studios."
                   "为全球游戏工作室打造的<br></br><accent>KOL 营销指挥中心。</accent>"

   "heroSubtitle": "Across YouTube, TikTok, Twitch, and Bilibili — gaming KOL operations purpose-built for studios going global."
                   "覆盖 YouTube、TikTok、Twitch、Bilibili —— 为出海游戏工作室打造的游戏 KOL 运营平台。"

   "chipCreators": "2,500+ gaming creators"                // 原 "850K+ creators indexed"
                   "2,500+ 游戏创作者"                      // 原 "创作者库存 85 万+"

   "chipMatch":    "AI-powered KOL × Product matching"     // 原 "AI match precision 94%"
                   "AI 智能匹配 KOL × 产品"                 // 原 "AI 匹配精度 94%"

   "chipLocales":  "EN · ZH · JA · KO · ES"                // 原 "9 locales · 24/7 ops"
                   "5 种语言：中 · 英 · 日 · 韩 · 西"        // 原 "9 种语言 · 7×24 运营"

   // 删除（连带 LoginBrandOverlay.tsx 中相关引用）
   "chipStudios":  // DELETE
   "trustedBy":    // DELETE
   ```

   **`src/components/auth/LoginBrandOverlay.tsx` 改造：**
   - 删除 `chipStudios` chip 项（`chips` 数组从 4 个降到 3 个）
   - 删除 `const studios = ["LIGHTNING", "VOIDPEAK", "STARFORGE", "AURORA", "NEBULA"]` 数组
   - 删除整段 trust footer JSX（`{/* Trust footer */}` 注释 + 包裹 div）
   - 调整 layout 让中间 content 块视觉居中（删 trust footer 后底部空白；可加 `mb-auto` 或调整 flex spacing）

   **i18n 自动补 ja/ko/es：**
   - 跑 `npm run i18n:translate -- --target ja,ko,es`
   - 用户/团队 review 5 keys 关键译文（eyebrow / heroTitle / heroSubtitle / 3 chips）

   **Visual baseline 重新生成：**
   - `tests/screenshots/baseline/en-login.png`
   - `tests/screenshots/baseline/zh-login.png`

2. **/campaigns 列表 AiSuggestionsCard 文案修（P0-3，方案 c）**
   - 当前：`src/app/[locale]/(app)/campaigns/AiSuggestionsCard.tsx` 标 "Coming with B2"，但 B7b F002 已在 `/campaigns/[id]` 落地真实 AI Suggestions
   - 改造：移除 `comingTag` 紫色 badge；body 文案改为 "AI Suggestions are now live on each campaign — open any campaign to see personalized matches" + 主 CTA 链接到 `/campaigns/{firstActiveId}` 或保留通用 `/discovery` 链接
   - i18n：`campaigns.aiSuggestions.comingTag` 移除；`body` / `ctaLabel` 改文案

3. **/api/health redis 字段文案修（P0-4）**
   - 当前：`src/app/api/health/route.ts` 返回 `{status: "stub", note: "wired in B5 with BullMQ"}`
   - 改造：返回 `{status: "not_used", note: "BullMQ enables when production scale demands"}`
   - 单元 test 更新（`tests/unit/health-redis-status.test.ts`）

4. **/campaigns Header Import 按钮删除（P1-2 顺手）**
   - 当前：`src/app/[locale]/(app)/campaigns/page.tsx:101` 有 disabled "Import" 按钮
   - 改造：直接删除该按钮（PRD §12 已说 CSV 批量导入 = B1 完整版，MVP 不需要占位）

**Acceptance：**
- 登录页左侧 EN + ZH 文案与上述 spec lock 一致（5 keys 改值 + 2 keys 删除）
- LoginBrandOverlay.tsx 不再含假工作室数组 + trust footer 段
- ja/ko/es 自动 i18n:translate 补全 5 keys
- visual baseline en-login.png + zh-login.png 重新生成入库
- /campaigns 列表 AiSuggestionsCard 不再显示 "Coming with B2" badge；CTA 引导到详情页
- /api/health JSON 中 redis.status = "not_used"，note 文案产品化
- /campaigns Header 不再有 Import 按钮（直接 New Campaign CTA）
- existing tests 不破坏（i18n keys 只删不漏）
- staging git_sha 与本 commit 一致

## 3. 关键设计决策（已 lock）

| 决策 | 选定方案 | 理由 |
|---|---|---|
| MVP 受众 | 团队内部（不发外部种子用户） | 用户 2026-04-30 澄清 |
| Tenant 模式 | 单 Demo Studio tenant + 共用现有账号 | 零技术债（原本架构就支持） |
| Demo seed 脚本 | **不写** —— 用现有 prisma/seed.ts | 避免临时方案 |
| Dashboard CPI 卡 | hardcoded 假数据 + 行业基准来源标注 | PRD §12 容许；快速可信 |
| Q5 Product targetAudience 强制 | form-level zod min(1) | DB schema 保持 nullable |
| 5 款游戏选定 | Honor of Kings / Genshin / PUBG Mobile / Pokemon Go / Clash Royale | 多品类覆盖 |
| aiAssets 策略 | 3 预生成 + 2 null（混合）| 兼顾"完成态"和"AI 体验" |
| Onboarding 文档 | 单文件 README en（不要 PDF / 不要 i18n） | 团队内部够用 |
| Sprint 名 | MVP-internal-demo-prep | 用户 D4 选 B |
| **登录页文案** | 选项 A 整体重写（去虚假数字 + 加游戏垂直）+ Title C 指挥中心 + Subtitle γ 多平台前置 + Trust footer 删 | 用户 2026-04-30 4 轮讨论 lock；多平台叙事保留对应 BL-012 爬虫团队 ~2026-06-25 数据接入后零文案返工 |

## 4. 依赖关系

```
B5 done → 用户 prod redeploy → MVP-internal-demo-prep building
                                       ↓
                                F001 + F002 + F003 + F004 + F006 + F007 (Generator 串行)
                                       ↓
                                用户 prod redeploy + npm run db:seed
                                       ↓
                                F005 (Reviewer codex)
                                       ↓
                                done → BIx-mvp-polish-pass building
                                       ↓
                                团队 demo 启用
```

## 5. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| Dashboard 三元素布局影响 visual baseline | 中 | F001 含 baseline 更新；先 staging 验证 |
| CPI 数据被团队误以为真 | 低 | F001 角标 + 小字明示 "Sample data" |
| Q5 zod 改动影响现有 product 编辑 | 低 | 现有 product 全部已填 targetAudience，不影响；新建强制 |
| Demo Studio 数据被团队误改 | 中 | README §4 明示 "do not use for production" |
| AIGC 余额被团队点 generate 消耗 | 低 | F005 启动前监控余额；超阈值告警（手动） |
| Resend 真发邮件 | 低 | 团队内部测试时仅发到自己邮箱；README §4 提醒 |

## 6. 验收方式

### L1 自动化
- F001 dashboard 组件 unit + visual baseline test
- F002 product targetAudience required test
- F003 seed script integration test
- F004 README 存在性 test (light)
- typecheck / lint / 现有套件不退化

### L2 staging
- staging 跑 npm run db:seed → 5 Product 进 Demo Studio
- 浏览器登录 → 4 大 Journey 全程
- /dashboard 含 3 新元素

### L3 prod 烟测（F005 主体）
- ≥30 条 checklist 全勾
- Reviewer 签收

## 7. 引用文档

- `docs/specs/B5-kol-data-enrichment-spec.md`（前置批次）
- `docs/product/KOLMatrix-MVP-PRD.md`（PRD 总纲）
- `docs/product/MVP-gap-audit-2026-04-30.md`（本批次起源 + 全部决策溯源）
- `prisma/seed.ts`（演示数据基础）
- `.auto-memory/environment.md`（prod / staging URL + 测试账号 + AIGC 配额）

## 8. 启动检查清单（Generator 开工前）

- [ ] B5-kol-data-enrichment done + signoff
- [ ] 用户触发 prod deploy 完成（B5 schema 落地）
- [ ] prod /api/health 200
- [ ] aigcgateway 余额 ≥ $5（F003 预生成 aiAssets）
- [ ] Resend 域名 verified

## 9. 估时

| 环节 | 预估 | 执行者 |
|---|---|---|
| F001 Dashboard 三元素（workflow / CPI / 30d ROI 趋势）| ~1 day | Generator |
| F002 Q5 Product zod | ~30 min | Generator |
| F003 5 Products seed + aiAssets | ~2-3h | Generator |
| F004 团队 README | ~2-3h | Generator |
| F005 Prod L2 烟测 + signoff | ~0.5 day | codex (Reviewer) |
| **F006 Dashboard 真数据替 mock**（EmailPerformance + RecentActivity）| ~5-7h | Generator |
| **F007 文案 polish**（**登录页重写** + campaigns AiSuggestionsCard + /api/health redis + Import 按钮删）| ~1.5h | Generator |
| 缓冲 | ~3.5h | — |
| **总计** | **~3 day Generator + 0.5 day Reviewer** | — |

## 10. 用户决策（2026-04-30 全部 ✅）

| # | 问题 | 用户答复 |
|---|---|---|
| Q1 | Dashboard CPI 卡用 hardcoded 假数据 | ✅ B（hardcoded + 角标 + 行业公开报告基准） |
| Q2 | Q5 Product targetAudience 强制方式 | ✅ A（form-level zod min(1)） |
| Q3 | Onboarding docs 范围 | ⚠️ 大改：团队内部 README 1 份 |
| Q4 | Demo seed CLI 形态 | ⚠️ 大改：不写 seed:demo（用现有 prisma/seed.ts）|
| Q5 | B5 inclusion | ⚠️ A 方案：B5 单独先做，再起本批次 |
| D1 | 5 款游戏 | ✅ Honor of Kings / Genshin / PUBG Mobile / Pokemon Go / Clash Royale |
| D2 | aiAssets 策略 | ✅ C（混合 3 预生成 + 2 null） |
| D3 | README 5 sections | ✅ login / 3 journeys / 8 pages / known limits / feedback |
| D4 | Sprint 名 | ✅ B（MVP-internal-demo-prep） |

---

**Spec 状态：** decisions-locked, awaits B5 done

**与其他批次关系：**
- 依赖 B5-kol-data-enrichment done
- 不与 B8-ai-extensions 冲突（B8 邀请后第 2 周做，本批次 done 后才发邀请）
- 不与 B4-extended-email-system 冲突
