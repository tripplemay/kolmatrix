# KOLMatrix MVP 版本 PRD

> **文档状态：** 📝 审阅草稿 v1.0
> **日期：** 2026-04-21
> **主持人：** Planner (Kimi)
> **审阅对象：** tripplezhou（产品负责人）+ johnsong（Generator）+ Reviewer + 团队其他成员
> **父文档：** `docs/specs/PRD.md`（完整 v1.0 PRD）
> **本文与父文档关系：** MVP 是父文档完整功能清单的**纵向子集**（取每个领域最小部分连成端到端闭环），不是新产品定义

---

## 📋 审阅说明

请团队成员按角色关注：

| 角色 | 重点审阅章节 |
|---|---|
| **产品** | §2 目标 · §4 功能范围 · §5 用户 Journey · §11 关键决策 · §13 开放问题 |
| **运营 / 客户侧** | §3 用户画像 · §7 AI 能力边界 · §13 开放问题（体验 / 合规） |
| **开发** | §6 数据模型 · §8 技术栈 · §9 批次时间线 · §12 Out of scope |
| **设计** | §8.2 视觉设计 · §5 Journey（关键页面交互） |

**审阅方式：** 在 Github PR 评论 / 或直接在本文件加 `> [名字] 意见：xxx` 行内批注。

**截止反馈时间：** 建议 2 工作日内，避免阻塞 MVP 启动（当前 Option α infra 已收官，BAux1 辅助批次在跑）。

---

## 1. 背景与为什么做 MVP

### 1.1 完整产品的定位（不变）

KOLMatrix 是全球游戏 KOL/KOC 智能营销管理 SaaS，目标填补 4 类竞品空白：
- **卧兔**：游戏垂直深但海外弱、AI 弱
- **NoxInfluencer**：数据大但无智能匹配 + 无触达工具
- **Upfluence / AspireIQ**：CRM 成熟但游戏场景弱
- **Grin**：全流程但极贵 + 无中文

（详见父 PRD §1 §2）

### 1.2 为什么走 MVP 而不直接做完整版

1. **产品方向仍需用户验证** — 23 题 KOL Discovery 澄清部分未定，上完整版风险高
2. **基建已收官**（B0 + BI1 + BI2 + BI3 全部 done）—— 从基建阶段进入业务验证阶段最合适
3. **2 周产出 → 5 周产出** 之间是 **3 倍学习速度**，有利于 PMF 探索
4. **资源约束** — 小团队（1 Planner / 1 Generator / 1 Reviewer）纵向更易 manageable
5. **设计稿就绪** — V1-V5 已有 14 张（MVP 复用 9 张，见 §8.2）

### 1.3 MVP 与完整版的关系

```
完整 PRD（B1 + B2 + B3 + B4 + B5 + B6+）
  ├── MVP 取 30-40% 最小闭环
  │   └── 验证 KOL 营销工作流是否满足游戏厂商真实需求
  ▼
上线 → 种子用户 → 反馈迭代
  │
  └── Post-MVP 逐步补齐深度：AI 评分 / 匹配度 / 自动数据同步 / 竞品分析 / ...
```

---

## 2. MVP 目标与成功指标

### 2.1 DoD（Definition of Done）

用户在 `https://kol.guangai.ai/` 登录后，**在一个 session 内可以完成**：
1. 在 KOL 库里按地区 / 粉丝数 / 游戏类目筛选到 5-10 个目标 KOL
2. 创建一个 Campaign（关联到某个已录入产品）
3. 把筛选的 KOL 加入 Campaign，每人录入 kolFee
4. 用固定模板 + AI 定制按钮给有 email 的 KOL 发邮件
5. 手动录入该 Campaign 的 Revenue 数据
6. 在 ROI 页 / 控制台看到 Campaign 的 ROI%
7. 一键生成 AI 周报并导出 PDF

### 2.2 成功指标（MVP 上线 4 周内）

| 指标 | 目标 | 衡量方式 |
|---|---|---|
| **种子用户数** | 3-5 家游戏工作室 | 实际注册并使用的 tenant |
| **端到端完成率** | 每家 tenant ≥ 1 次完整 Journey | 数据埋点统计 |
| **用户对 AI 周报态度** | ≥ 60% 认为"有用" | 主观问卷 |
| **AI 定制邮件采纳率** | ≥ 40%（用户点了 AI 定制且没改回固定模板） | 事件日志 |
| **KOL 回复率** | 基准数据采集（非硬指标） | CRM 沟通记录 |

---

## 3. 用户画像与核心场景

### 3.1 目标用户（收敛）

**主用户：游戏工作室的 marketing manager / 影响者关系负责人**

- 背景：国内出海厂商（如米哈游 / 莉莉丝 / 网易雷火等中小到中型规模）
- 痛点：
  - 现在用 NoxInfluencer 找人，Excel 管进度，Gmail 手动发邮件 —— 碎片化
  - 算 ROI 靠 BA 在 GA/Stripe 拉数据拼接 —— 费时
  - 每周给老板汇报要手工做 PPT —— 痛苦
  - 英语不是 native，给海外 KOL 写邮件心慌

### 3.2 MVP 核心场景（3 个典型 Journey）

**Journey A：新 Campaign 找 KOL + 触达（最常见）**
```
登录 → 控制台点"新建活动" → 填 Campaign 名 + 关联 Product(游戏)
  → 跳 KOL 发现 → 筛（地区/粉丝/类目）→ 勾 8 个 → "加入本活动"
  → 回 Campaign 详情 → 录每人 kolFee → 批量选"用固定模板 + AI 定制"
  → 点 "发送" → 有 email 的走 Resend，无 email 的弹出手动复制面板
```

**Journey B：复盘 ROI + 周报**
```
Campaign 结束 → 打开 Campaign 详情 → "录入 Revenue"填 $42,000
  → 系统自动算 ROI = (Revenue - Σkolfee) / Σkolfee × 100%
  → 回 ROI 追踪页看全局 → 点"生成 AI 周报" → 阅读 → 导出 PDF 发老板
```

**Journey C：产品资料准备（前置）**
```
首次用 → 进"产品知识库" → 录入《王者荣耀》（名/品类/目标受众/独特卖点）
  → 点"AI 生成推广素材" → 得到 3 套邮件模板 + 2 套短视频脚本
  → 以后新建 Campaign 关联此 Product，发邮件自动用这些素材作 context
```

---

## 4. 功能范围（MVP 含 9 页 + 1 隐藏页）

### 4.1 **MVP 必做（9 页 + 登录注册）**

| # | 页面 | 路由 | 核心功能 | 批次 |
|---|---|---|---|---|
| 0 | 登录 / 请求访问 | `/login` `/request-access` | Email+密码 + Request Access 表单 | **BAux1**（running）|
| 1 | **控制台** | `/` | 4 KPI + 工作流 6 步图 + TOP KOL 合作概览 + CPI 对比 + 近 30 天 ROI 趋势 | BM1 |
| 2 | **KOL 发现** | `/discovery` | 15 维筛选 UI + 价值分 + 标签 + 保存到候选 | BM1 |
| 3 | **KOL 库** | `/database` | 已保存的 KOL 列表 + 批量操作 | BM1 |
| 4 | **KOL 画像** | `/kol-profile` 或 `/kols/:id` | 详情页（基础信息 + 合作历史 + 沟通记录）| BM1 |
| 5 | **产品知识库** | `/knowledge-base` | 录入游戏 + AI 生成推广素材 | BM1 |
| 6 | **活动管理** | `/campaigns` + `/campaigns/:id` | 新建 + 列表 + 详情（关联 Product + KOL 面板 + 进度） | BM2 |
| 7 | **邮件触达** | `/outreach` | 选 KOL + 选模板 + AI 定制 + 发送 + 发件记录 | BM2 |
| 8 | **CRM 简化版** | `/crm` | 阶段分布 + 漏斗 + 合作总额 KPI（不接 webhook）| BM2 |
| 9 | **ROI 追踪** | `/roi` | 预算 + 4 KPI + 30 天趋势 + Campaign ROI 表 + AI Insights | BM2 |
| 10 | **AI 周报** | `/weekly-report` | 一键生成 + PDF 导出 | BM2 |

### 4.2 **MVP 不做（明确排除，Post-MVP 再考虑）**

| 页面 | 所属未来批次 |
|---|---|
| 活动日历 `/calendar` | B3+（列表视图 MVP 足够）|
| 竞品分析 `/competitors` | B10 远期 |
| 产品文档 `/prd` / 订阅升级 `/pricing` | B9 +（SaaS 运营用）|
| 设置 `/settings` | B9 |
| 高级 CRM（打开率 / 回复率追踪） | B4（需要 Resend webhook）|
| AI 匹配分（KOL × Product 适配度）| B2（需 AI 评分管道）|
| 批量 CSV 导入 / 全文搜索 / 标签 CRUD 等 B1 完整功能 | B1 完整版 |

---

## 5. 用户 Journey 图（细化）

```
┌─────────────────────────────────────────────────────────────────┐
│  首次使用 / 邀请注册 (BAux1)                                       │
│  ↓ admin 在后台审批 AccessRequest → 建 tenant 和 user 给客户      │
└─────────────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Journey C: 产品入库 (BM1)                                       │
│  /knowledge-base → 录入游戏产品 → AI 生成推广素材                 │
│  ↓ (Product 实体已存在，后续 Campaign 可引用)                     │
└─────────────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Journey A: KOL 筛选 + 触达 (BM1 + BM2)                          │
│  /discovery (筛选) → ⚡保存 → /campaigns/new (新建)              │
│   → 添加 KOL + 录 kolFee → /outreach (选模板 + AI 定制 + 发)     │
│   → CampaignKol.contactStatus 更新 → 邮件发出                    │
└─────────────────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│  Journey B: 复盘 ROI (BM2)                                       │
│  Campaign 结束 → 详情页录 Revenue → 自动算 ROI                   │
│   → /roi 看全局 → /weekly-report 一键生成 → 导出 PDF             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. 数据模型（MVP 关键表）

### 6.1 完整表清单（8 张核心 + 7 张已有）

已有（B0 / BI3 建立，不改或微调）：
- `Tenant` / `User` / `AccessRequest`（邀请审核）/ `Session`
- `Kol`（已有，MVP 扩字段见下）
- `Campaign`（已有，MVP 扩字段见下）
- `CampaignKol`（已有，MVP 扩字段见下）
- `EmailLog`（已有）

MVP 新增：
- **`Product`**（新表，游戏产品 / Tenant 侧资产）
- **`CampaignMetric`**（新表，ROI 原子数据：impressions/clicks/conversions/revenue）
- **`EmailTemplate`**（新表，模板存储）
- **`GameCategory`** + `Kol_GameCategory`（多对多，AI 打标用）
- **`event_log`** + **`audit_log`**（BI4 guard rails）

### 6.2 Product 实体（新）

```prisma
model Product {
  id                  String   @id @default(cuid())
  tenantId            String
  name                String   // "Honor of Kings"
  category            String   // MOBA/RPG/FPS/手游/二次元/...
  targetAudience      String?
  uniqueSellingPoints String?  @db.Text
  downloadUrl         String?
  aiAssets            Json?    // { emailTemplates: [...], videoScripts: [...] }
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
  campaigns           Campaign[]
  @@index([tenantId])
}
```

### 6.3 Kol 扩展（15 维 filter 前置 schema）

```diff
  model Kol {
    id / tenantId / platform / handle / name / followerCount / ...（已有）

+   // MVP 有数据：
+   gameCategories        GameCategory[]  // AI 打标（多对多）
+   countryIso            String?  @db.Char(2)  // US/UK/...

+   // MVP 无数据 / nullable 预留：
+   language              String?  @db.VarChar(5)
+   engagementRate        Decimal?
+   avgViewsPerVideo      Int?
+   uploadsPerMonth       Int?
+   lastUploadAt          DateTime?
+   monetizationStatus    MonetizationStatus?   // enum
+   brandSafetyRating     BrandSafety?          // enum
+   knownBrandCollabs     String[]
+   customTags            KolTag[]
+   audienceDemographics  Json?
+   engagementAuthenticity Int?

+   // MVP AI 生成：
+   valueScore            Int?       // 0-100 独立价值分
+   tags                  String[]   // 自由标签"手游测评"/"高粘性"/"英语母语"

+   // MVP CRM（tenant-scoped relationship）：
+   relationshipStatus    String @default("prospect")
+   // enum: prospect / first_contact / negotiating / long_term / paused / terminated
  }
```

### 6.4 CampaignKol 扩展

```diff
  model CampaignKol {
    id / campaignId / kolId / ...（已有）

+   kolFee          Decimal?     // 单 KOL 费用，USD
+   matchScore      Int?         // 匹配分（MVP 不计算，字段预留）
    contactStatus   String       // pending/contacted/quoted/signed/delivered/paid (6 状态)
    @@unique([campaignId, kolId])
  }
```

### 6.5 Campaign 扩展

```diff
  model Campaign {
    id / tenantId / name / ...（已有）

+   productId       String       // 必填，关联 Product
+   budget          Decimal?     // 预算
+   spendTotal      Decimal      // 实际花费 = Σ CampaignKol.kolFee（computed 或 aggregated）
+   revenueRecorded Decimal?     // 手动录入 Revenue
+   status          String       @default("draft")  // draft/active/completed
+   startedAt       DateTime?
+   closedAt        DateTime?
  }
```

### 6.6 CampaignMetric（新表，ROI 数据粒度）

```prisma
model CampaignMetric {
  id          String   @id @default(cuid())
  campaignId  String
  recordedAt  DateTime
  impressions Int?
  clicks      Int?
  conversions Int?
  attributedRevenue Decimal?
  source      String?  // manual / youtube-api / ga4 (MVP 只手动)
  @@index([campaignId, recordedAt])
}
```

### 6.7 EmailTemplate（新表）

```prisma
model EmailTemplate {
  id          String  @id @default(cuid())
  tenantId    String?       // null = system template
  name        String        // "初次询价" / "跟进提醒"
  subject     String
  body        String  @db.Text
  variables   Json          // [{token:"{{kol.name}}", description:"KOL 名称"}]
  type        String        @default("system")  // system / user
  createdAt   DateTime @default(now())
  @@index([tenantId, type])
}
```

MVP seed 3-5 套系统模板（初次询价 / 跟进 / 签约邀请）。用户无法 CRUD（B4 做）。

---

## 7. AI 能力边界

MVP 用 **aigcgateway**（已接入）提供 3 档 AI 能力：

| AI 能力 | 模型 | MVP 是否做 | 使用场景 |
|---|---|---|---|
| **KOL 价值分** | claude-haiku-4.5 | ✅ | 基于 followers / 互动率 / 类目简单公式 + AI 加权 |
| **KOL 类目打标** | claude-haiku-4.5（已跑 pilot）| ✅ 已执行 | Seed 时一次性打标，~$1 成本 |
| **AI 定制邮件** | claude-haiku-4.5 或 gemini-3-flash | ✅ | 邮件模板 × Product × KOL context → 个性化改写 |
| **AI 周报生成** | gemini-3-flash（长 context）| ✅ | 读 CRM/ROI/待办 → 生成 markdown → 前端转 PDF |
| **AI 推广素材生成** | gpt-image / gemini-3-pro-image（图）+ claude-haiku-4.5（文） | ✅ 基础版 | 从 Product 字段生成：邮件模板 3 套 + 短视频脚本 2 套 |
| ~~KOL × Product 匹配分~~ | — | ❌ MVP 外 | 需要 embedding 管道（B2）|
| ~~AI Insights 自动分析~~ | — | ❌ MVP 外 | 需要 ROI 数据积累足够（BM2 后 B2 做）|

---

## 8. 视觉与技术

### 8.1 技术栈（沿用）

- Next.js 16 App Router + React 19.2 + TypeScript + Tailwind v4
- PostgreSQL 16（多租户 RLS）+ Prisma 7
- Redis（预留 BullMQ，MVP 不真用）
- NextAuth v5（Credentials + Google disabled）
- Resend 邮件（`marketer@kolquest.com` 根域）
- next-intl i18n（MVP 支持 en + zh，ja/ko/es 回退 en）
- aigcgateway（`https://aigc.guangai.ai/v1`）
- PM2 cluster 2 instances + wait_ready（BI2 guard 过）
- 部署：GitHub Actions `Deploy to Production` workflow
- Staging：`staging.kol.guangai.ai`（BI3 就位）

### 8.2 视觉设计

- **设计语言**：Neural Velocity（深色 navy #0b1326 + 电流青 #00E5FF + 玻璃拟态）
- **Design System**：已沉淀到 `design-draft/design-system.md`
- **Stitch 设计稿**（14 张已就绪，MVP 复用 9 张）：
  - V1 Dashboard ✅
  - V2 KOL Discovery ✅ / KOL Detail ✅
  - V3 Campaigns 列表 ✅ / Campaign 详情 ✅ / KOL Database ✅ / Email Center ✅
  - V4 Client Review ❌ MVP 外 / Email Tracking ❌ B4
  - V5 Login v2 ✅ / Signup v2 ✅ / Email Template Editor ❌ B4 / Email Send Queue ❌ B4 / Unsubscribe ❌ B4
  - V6 ROI Tracking （prompt 已起草，等 Stitch 生成）✅ 即将入库
- **MVP 需新出但未起草**：产品知识库页 / CRM 简化页 / AI 周报页 — 由 Planner 在 BM1/BM2 spec 期间补出 V7 prompts

---

## 9. 批次拆分与时间线

```
当前 ─► BAux1 (running)        登录/注册/AccessRequest UI                       4 features
             │
             ▼
        BI4 架构护栏             Job Queue / event_log / audit_log / Cursor    5 features
             │                   pagination / tsvector index
             ▼                                                                   2-3 days
        BM1 控制台 + KOL 核心    Product 表 / KOL schema/seed / Discovery      9-10 features
             │                   筛选 / Database / KOL 画像 / 知识库 +
             │                   AI 素材 / 控制台数据接入 / 测试                7-10 days
             ▼
        BM2 Campaign + 联系 +    Campaign schema / 新建/列表/详情 /             11-12 features
            CRM + ROI + 周报     EmailTemplate / 发送流 / AI 定制 /
             │                   CRM 简化页 / ROI 引擎 / ROI 独立页 /           8-12 days
             ▼                   AI 周报 / 测试
        MVP 上线 (~15-25 天)
             │
             ▼
        种子用户 3-5 家
             │
             ▼
        迭代
```

**总 Generator 工作量估：20-25 天**
（Planner 并行投入：spec + 裁决 + 打标 + 图片生成等，不计入 Generator timeline）

---

## 10. 运维与数据

### 10.1 初始数据

- **KOL seed**：XLSX 2524 条 YouTube 微网红（500-10K 粉丝）已有。AI 打标 + 游戏过滤（方案 C）筛掉非游戏类，预估保留 ~700-1000 条真游戏 KOL
- **Product seed**：空，由 tenant 自行录入（demo 阶段可 seed 2-3 个示范 product）
- **EmailTemplate seed**：3-5 套系统固定模板（初次询价 / 跟进 / 签约邀请 / 拒绝跟进 / ...）

### 10.2 邮件发件

- 发件域：`marketer@kolquest.com`（根域已 verified，BI3-F005 验证）
- 策略：有 email 的 KOL 走 Resend；无 email 的生成推介文案 + 手动 YouTube 私信
- 合规：邮件底自然语言 opt-out（"reply STOP"），人工处理，**不接 Resend webhook**（MVP 阶段降级，B4 完整合规方案）
- 速率：10 msg/min 防 abuse flag

### 10.3 邀请制 Auth

- 访问 /request-access 填表 → `AccessRequest` 表写入 → admin 邮件通知
- admin 手动审批 → SSH 到 DB 改 status='approved' + 建 Tenant + User（MVP 阶段）
- B9 做审批管理 UI

---

## 11. 关键决策记录（选 / 不选的理由）

### 11.1 做了纵向 MVP 而非继续横向 B1-B5

✅ **选择：** 纵向 MVP（每领域浅层 + 端到端闭环）
❌ **放弃：** 继续横向（每批次深层 + 要 4-6 周才完整）
**理由：** Infra 已收官进业务验证期、产品方向仍待用户反馈、Schema 前置完整可规避纵向风险、2-3 倍迭代速度有利 PMF

### 11.2 Google OAuth 按钮 disabled 而非实装

✅ disabled + "Coming soon" tooltip
**理由：** UI 忠实 Stitch 设计 / 不扩后端 scope / Google Cloud 配置由用户掌控

### 11.3 AI 匹配分不做 MVP

❌ 不做（字段预留 Kol.matchScore / CampaignKol.matchScore）
**理由：** 需要 embedding + similarity 管道（B2 级别）/ MVP 不依赖它 demo 足够

### 11.4 CRM 只做简化版（不接 webhook）

✅ 阶段分布 + 漏斗 + KPI 看板，manual 录入状态
❌ 打开率 / 回复率 / 回信追踪（需要 Resend webhook）
**理由：** webhook 合规 + 架构复杂度大（要单独 endpoint + event_log 积累），B4 完整做

### 11.5 ROI Revenue 手动录入

✅ 纯手动，closed Campaign 时 marketer 录
❌ GA4 / Shopify / Meta Ads 自动追踪
**理由：** 自动追踪需要客户外部系统集成（复杂 + 因客户而异）；手动录入已满足内部 ROI 计算

### 11.6 合规退订"最小合规"

✅ 邮件底自然语言 opt-out + 人工处理
❌ 完整自动化退订系统（unsubscribe 链接 + suppression list）
**理由：** MVP 发送量小（每天几十封）人工可 handle；完整系统 B4 做

### 11.7 架构 guard rails 前置做成 BI4 批次

✅ 5 个 guard rails 独立做一个小批次（Job Queue / event_log / audit_log / cursor pagination / tsvector）
❌ 嵌入 BM1/BM2 做
**理由：** 避免 MVP 业务批次 spec 臃肿 + Generator 一批次一主题 + 未来零返工

### 11.8 AI 打标策略：方案 C（过滤 + 精细打标）

✅ 先 AI 二值过滤（gaming 是 / 否）→ 仅对 gaming 细分类目
❌ 全量直接分类
**理由：** Pilot 发现 XLSX 数据混入大量非游戏 KOL（拳击 / 家庭博客 / 电子产品）；过滤后的数据 demo 质量更高

---

## 12. Out of Scope（明确不做）

- ❌ CSV / Excel 批量导入 KOL（B1 完整版）
- ❌ KOL 标签 CRUD（MVP 只读 AI 生成标签）
- ❌ KOL 状态流转完整版（MVP 的 8 状态是 relationshipStatus + contactStatus 简化）
- ❌ 全文搜索（基础 fuzzy name 足够）
- ❌ 竞品 CPI 实时数据（原型首页有展示位，MVP 用 hardcoded 示例数据）
- ❌ 活动日历 / 甘特图（列表视图足够）
- ❌ 多 Product 组合 / Product 模板
- ❌ BullMQ workers 真实跑（Job Queue interface 有但 executor 是 in-memory stub）
- ❌ YouTube Data API 自动 sync（MVP 只 XLSX 静态 seed）
- ❌ 邮件模板编辑器（B4）
- ❌ 邮件队列监控页（B4）
- ❌ 退订管理自动化（B4）
- ❌ 客户协同筛选页（B7）
- ❌ 竞品分析 / 知识库 / PRD / Pricing / Settings 页（B9/B10+）
- ❌ API 开放（B11 远期）

---

## 13. 开放问题（待团队讨论）

以下问题在定稿 MVP spec 前需要确认：

### 🟥 P0（影响数据基础）

**Q1. AI 打标结果 review 流程**
AI 标好后如何 review？由 admin 用户手动看 sample 30 条 sign-off，还是直接上？

reply：第二次复审之后的结果可以直接上

**Q2. XLSX 质量偏低怎么处理**
Pilot 发现 XLSX 有大量非游戏 KOL（估计 40-60%）。方案 C 会过滤掉，但剩下可能只有 ~700-1000 条。对 MVP demo 够吗？还是建议团队补数据源？

reply：第二次复审之后的结果，够 mvp 使用了
### 🟨 P1（影响用户体验）

**Q3. AI 定制邮件的 context**
AI 定制按钮点了之后，LLM 拿到：Product 信息 + KOL 信息 + 模板。会生成什么？（举例：重写 subject 行 + 改写 body 前 1-2 句）

reply：你使用 aigcgateway 的 action 和 template 能力，创建一个模板，后期再优化

**Q4. AI 周报的覆盖范围**
周报包含：本周触达 N 个 KOL / ROI 数据 / top 5 performers / 待跟进 10 个 —— 还是更简洁？格式给客户看还是给老板看？

reply：给客户看

**Q5. Product 录入是否要求所有字段**
"独特卖点" 空白的话 AI 素材生成效果差，要强制要求吗？

 reply:强制要求
### 🟩 P2（影响产品叙事）

**Q6. 登录 "Continue with Google" disabled 是否合适**
Stitch 设计有这按钮。MVP 禁用 tooltip "Coming soon"。团队是否接受？还是建议完全移除？

reply：可以接受

**Q7. 默认语言切换**
用户首次访问 `/` 是否自动按浏览器语言跳 `/en/` 或 `/zh/`？还是统一默认 `/en/`？

reply：自动按浏览器语言跳

**Q8. ROI 页的 AI Insights 是否 MVP 做**
原型有 "AI Insights" 卡片显示"TikTok campaigns outperforming by 2.3×"等洞察。MVP 是否用 aigcgateway 生成这类洞察？还是 Post-MVP？

reply：需要

---

## 14. 风险与依赖

| 风险 | 影响 | 缓解 |
|---|---|---|
| aigcgateway 稳定性 | 高（本周已踩 3 次坑）| 所有 AI 调用都有 fallback（模板 / 默认值 / 报错降级）|
| XLSX 数据质量低 | 中 | 方案 C 过滤 + 团队审 sample；若 demo 效果差再评估补数据源 |
| 用户不愿手动录 Revenue | 中 | UI 做清晰引导 + 提供快速录入浮层（不需要跳详情页）|
| CRM 简化版达不到预期 | 中 | 和用户首次 demo 后 collect feedback，快速迭代 |
| Resend 账户被标 spam | 低 | MVP 发送量小 + 自然语言 opt-out + 手动处理 STOP 可 handle |
| ROI 公式过于简单 | 中 | spec 保留 `revenueRecorded` + `CampaignMetric` 表双轨，将来公式升级只改 view |

---

## 15. 审阅 Checklist（给团队）

请勾选你看过并同意（或标注 "N/A" / 提出 issue）：

- [ ] §1 背景 + MVP vs 完整版关系
- [ ] §2 MVP DoD + 4 周成功指标
- [ ] §3 目标用户（marketing manager 出海游戏厂商）是否精准
- [ ] §4 9 页功能清单 + Out of scope
- [ ] §5 3 个典型 Journey 是否覆盖核心场景
- [ ] §6 数据模型关键扩展（尤其 Product + 15 维 Kol）
- [ ] §7 AI 能力边界（MVP 做/不做）
- [ ] §8 技术栈 + 视觉
- [ ] §9 批次时间线（20-25 天）
- [ ] §11 关键决策的理由是否合理
- [ ] §12 Out of scope 清单
- [ ] §13 8 个开放问题（回答每一题或标注"由 Planner 决定"）
- [ ] §14 风险与缓解

---

## 16. 下一步（PRD 审阅通过后）

1. **Planner** 根据团队反馈修订本文 → v1.1 定稿
2. **Planner** BAux1 done 后启动 BI4 spec（架构 guard rails）
3. **Planner** BI4 done 后启动 BM1 + BM2 spec
4. **Generator** 按 spec 执行
5. **Reviewer** 按 spec Acceptance 复验

---

## 17. 文档版本与追踪

| 版本 | 日期 | 修订内容 | 作者 |
|---|---|---|---|
| v1.0 | 2026-04-21 | 初版，供团队审阅 | Planner (Kimi) |

**相关文档：**
- 完整 PRD: `docs/specs/PRD.md`
- KOL Discovery 澄清: `docs/product/kol-discovery-clarification.md`
- Roadmap: `docs/specs/roadmap.md`
- 视觉基调: `docs/specs/visual-baseline.md`
- Stitch 参考: `design-draft/stitch-references/`
- 原型网站（团队制作）: https://kol.saga1001.com/
- Framework 沉淀: `framework/harness/database-patterns.md` + `deploy-patterns.md`
