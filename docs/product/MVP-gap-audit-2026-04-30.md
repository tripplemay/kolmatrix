# MVP 落地差距审计 — 2026-04-30

> **作者：** Planner（johnsong）
> **审计对象：** `docs/product/KOLMatrix-MVP-PRD.md` v1.0（2026-04-21）vs. 当前代码 / 数据库 / 线上状态
> **生产 HEAD：** `1cf2764` （`https://kol.guangai.ai/api/health` 验证 healthy）
> **Staging HEAD：** `31ab6c0`
> **代码 HEAD：** `1cf2764`（远端已对齐）

---

## TL;DR

**核心结论：** MVP DoD（PRD §2.1）的 **7 步端到端 Journey 全部可执行**，11 个页面全部已建，关键 Schema / AI 能力 / 邮件发送链路全部到位。生产环境已部署最新 `1cf2764`，AIGCGATEWAY 与 Resend key 均已配置。

**真正阻塞 MVP 上线的事项有 3 类，均为非工程性事务：**
1. **生产 DB 未 seed**（`environment.md:91` 标注"未"）—— 需 SSH 跑 `npm run db:seed` 才能登录 demo
2. **MVP-prod-launch-smoke 与 MVP-seed-demo-prep 两个 spec 未执行签收**（spec 在库，无 signoff）
3. **Q5 强制要求 Product 字段未完全落地** ——`uniqueSellingPoints` required，`targetAudience` 仍 nullable

**有 2 个功能按计划推迟到 MVP 邀请发出后**（不是缺失，是 PMF 叙事策略）：
- B8-F001 KOL 相似推荐（"找到下一个"）
- B8-F002 多语言 KOL 跨区匹配（中文 marketer 找日韩 KOL）

**Dashboard 实现与 PRD §4.1 文字描述有 3 处偏差**（DoD 不依赖，但 spec 不一致）：
- ❌ 工作流 6 步图
- ❌ CPI 竞品对比卡（PRD §12 已说 hardcoded 占位即可）
- ❌ 30 天 ROI 趋势图（已在 `/roi` 页，未在 Dashboard 重复）

---

## 1. MVP DoD §2.1 七步 Journey 审计

| # | DoD 步骤 | 落地证据 | 状态 |
|---|---|---|---|
| 1 | KOL 库筛选（地区/粉丝/类目）找 5-10 个 | `/discovery` 15 维 filter + Smart Match Dialog（B7a F002）+ Save Search（B7b F003）| ✅ |
| 2 | 创建 Campaign 关联 Product | `/campaigns/new` + `Campaign.productId` 必填（schema） | ✅ |
| 3 | 加 KOL 到 Campaign，每人录 kolFee | `KolCampaign.kolFee` Decimal（schema）+ `/campaigns/[id]` panel | ✅ |
| 4 | 选模板 + AI 定制邮件给有 email 的 KOL | `/outreach` + `kol-email-customize` action（aigcgateway）+ B4 模板库 union load | ✅ |
| 5 | 手动录入 Revenue | `Campaign.revenueRecorded` Decimal + `/campaigns/[id]` Server Action | ✅ |
| 6 | ROI 页 / 控制台看 Campaign ROI% | `/roi` 4 KPI + 趋势 + 表格 + AI Insights（`RoiInsightsPanel`） | ✅ |
| 7 | AI 周报一键生成 + PDF 导出 | `/weekly-report` + `weekly-report-for-client` action + `window.print()` 触发"Save as PDF" | ⚠️ ⓘ |

**ⓘ 注：** 周报"PDF 导出"用浏览器原生 `window.print()` + 打印样式表，需用户在打印对话框选"Save as PDF"。不是真正的"一键直接下载 PDF"，但 MVP 可接受。如要升级，需引入 jsPDF / Puppeteer。

---

## 2. PRD §4.1 页面清单审计

| # | PRD 页面 | 路由 | 文件 | 状态 |
|---|---|---|---|---|
| 0 | 登录 / 请求访问 | `/login` `/request-access` `/request-access/success` | `src/app/[locale]/login/page.tsx` 等 | ✅ |
| 1 | 控制台 | `/dashboard` | `src/app/[locale]/(app)/dashboard/page.tsx` | ⚠️ 见 §3.1 |
| 2 | KOL 发现 | `/discovery` | `src/app/[locale]/(app)/discovery/page.tsx` | ✅ |
| 3 | KOL 库 | `/database` | `src/app/[locale]/(app)/database/page.tsx` + Insights 三卡（B7b F001）| ✅ |
| 4 | KOL 画像 | `/kols/[id]` | `src/app/[locale]/(app)/kols/[id]/page.tsx` | ✅ |
| 5 | 产品知识库 | `/knowledge-base` | `src/app/[locale]/(app)/knowledge-base/page.tsx` + AI assets pipeline | ✅ |
| 6 | 活动管理 | `/campaigns` `/campaigns/new` `/campaigns/[id]` | 3 文件齐全 | ✅ |
| 7 | 邮件触达 | `/outreach` `/outreach/templates` | B4 templates 入库 | ✅ |
| 8 | CRM 简化版 | `/crm` | `src/app/[locale]/(app)/crm/page.tsx` + `/api/crm/overview` | ✅ |
| 9 | ROI 追踪 | `/roi` | `src/app/[locale]/(app)/roi/page.tsx` + `RoiInsightsPanel` + 3 个 API | ✅ |
| 10 | AI 周报 | `/weekly-report` `/shared/weekly-report/[token]` | BM2-F010 落地 + 匿名分享链接 | ✅ |

**总结：11/11 页面已构建。**

---

## 3. 偏差与缺失（按严重度排序）

### 🟥 P0：MVP 上线前必须处理（3 项）

#### 3.1 Dashboard 实现与 PRD §4.1 不一致

PRD §4.1 描述：
> 4 KPI + **工作流 6 步图** + **TOP KOL 合作概览** + **CPI 对比** + **近 30 天 ROI 趋势**

实际 `src/app/[locale]/(app)/dashboard/page.tsx`:
- ✅ KPI Row（5 个 KPI，比 PRD 多 1 个）
- ✅ Recommended KOLs（TOP 5 by valueScore）—— 等价 PRD "TOP KOL"
- ❌ **无工作流 6 步图**（PRD §4.1 明确列出）
- ❌ **无 CPI 竞品对比卡**（PRD §12 容许 hardcoded 占位，但实际未实装）
- ❌ **无 30 天 ROI 趋势图**（独立 `/roi` 页有趋势，Dashboard 未冗余展示）
- ➕ 实际多了：QuickActions / EmailPerformanceCard / RecentActivityCard / ActiveCampaignsSection

**裁决建议：**
- "工作流 6 步图" + "30 天 ROI 趋势" 是用户首屏关键引导（onboarding 价值高）—— **建议补**
- "CPI 竞品对比" 即使 hardcoded 也是核心叙事素材 —— **建议补**（hardcoded 30min 可做）
- 替代方案：Planner 与用户对齐这是有意识的 MVP-vf 重写决策，则更新 PRD §4.1 记录该偏差，无需补

#### 3.2 生产 DB 未 seed（环境就绪问题）

`.auto-memory/environment.md:91` 明确：
```
DB 已 seed？未。prod DB 是空壳（迁移已 apply，无业务数据）。
```

**影响：** 用户拿到登录页也无法登录 demo flow（依赖 Sarah Chen / Admin 种子）。

**修复路径：**
```bash
ssh tripplezhou@34.180.93.185 'cd /opt/kolmatrix && npm run db:seed'
```

#### 3.3 Q5 Product 字段强制要求未完全落地

PRD §13 Q5 用户答复："强制要求"。

实际 `src/app/[locale]/(app)/knowledge-base/actions.ts`:
- `uniqueSellingPoints` ✅ required
- `targetAudience` ❌ nullable（`?? null`）

**影响：** AI 推广素材生成（PRD §7）依赖 targetAudience；空白时素材质量差。

**修复路径：** Generator 1 commit 改 schema + form validation + zod。

---

### 🟨 P1：Spec 未签收但 spec 已起草（2 个 spec 闲置）

| Spec | 路径 | 用途 | 状态 |
|---|---|---|---|
| **MVP-prod-launch-smoke** | `docs/specs/MVP-prod-launch-smoke-spec.md` | 生产上线烟测 | ⚠️ 无 signoff |
| **MVP-seed-demo-prep** | `docs/specs/MVP-seed-demo-prep-spec.md` | 邀请前 demo 数据准备 | ⚠️ 无 signoff |

**裁决建议：** 任选其一作为下一批次，配合 §3.2 生产 seed 一起执行。

### 🟨 P1：B4-extended-email-system 未实装

PRD §11.4 + §12 说 "完整合规方案 B4 做"（webhook / 退订 / 跟踪）。**实际 B4 被 scope 缩为 email-template-library**（已 done）。

完整 B4 spec 在 `docs/specs/B4-extended-email-system-spec.md` 仍未执行。

**对 MVP 影响：** PRD §11.4/§11.6 已明确 webhook + 完整退订系统 = MVP 不做 / B4 做。当前 outreach 用"邮件底自然语言 opt-out + 人工处理"。**MVP 不阻塞**，但 demo 期间需向种子用户说明 webhook 跟踪是后续迭代。

---

### 🟦 P2：按计划推迟（非缺失）

#### B8-ai-extensions（决策 lock，邀请发出后启动）

`docs/specs/B8-ai-extensions-spec.md` status=`decisions-locked`，trigger=`邀请发出后立即`：

| Feature | 内容 | 战略价值 |
|---|---|---|
| F001 | KOL 相似推荐（详情页"找到下一个"） | 留存（类比 Spotify） |
| F002 | 多语言 KOL 跨区匹配（中文找日韩） | 差异化能力 |

**结论：** 这是 PMF 叙事策略 —— "种子用户第 2 周看到新功能上线"。**不是 gap。**

---

### 🟦 P2：Out of Scope（PRD §12 明确不做）

| 项 | 推迟到 |
|---|---|
| CSV 批量导入 | B1 完整版 |
| KOL 标签 CRUD | B1 |
| 全文搜索 | B1 |
| 活动日历 / 甘特图 | B3+ |
| BullMQ workers 真跑 | B5 |
| 退订自动化 / Resend webhook | B4-extended |
| 客户协同筛选 | B7（已 scope 重定义） |
| 竞品分析 / Settings / Pricing | B9-B10+ |
| YouTube Data API 自动 sync | ✅ **已解锁并落地**（B6 done） |

---

## 4. PRD §6 数据模型审计

### 4.1 17 张 Prisma 模型现状

| 类别 | 表 | 状态 |
|---|---|---|
| Auth/租户 | Tenant / User / Account / Session / VerificationToken / AccessRequest | ✅ |
| KOL | Kol（含 15 维扩展 + valueScore + relationshipStatus）| ✅ |
| 产品 | Product（PRD §6.2 全字段）| ✅ |
| Campaign | Campaign / KolCampaign（= PRD CampaignKol，含 kolFee/matchScore）| ✅ |
| Metric | CampaignMetric | ✅ |
| Email | EmailLog / EmailTemplate | ✅ |
| Search | SavedSearch | ✅ |
| Report | WeeklyReport | ✅ |
| 守门 | EventLog / AuditLog（BI4）| ✅ |

### 4.2 PRD 与实现的 schema 偏差

| PRD 设计 | 实际实现 | 评估 |
|---|---|---|
| GameCategory + Kol_GameCategory（多对多）| `Kol.categories` `String[]`（free-text array）| ⚠️ 简化但更轻量 — 可接受 |
| `CampaignKol` 表名 | `KolCampaign` | 命名差异不影响功能 |

---

## 5. PRD §7 AI 能力清单

| AI 能力 | PRD 是否做 | 实际落地 | 证据 |
|---|---|---|---|
| KOL 价值分 | ✅ MVP | ✅ | `Kol.valueScore` + `computeKolValueScore()` |
| KOL 类目打标 | ✅ 已执行 | ✅ | MVP-kol-seed-redo signoff |
| AI 定制邮件 | ✅ MVP | ✅ | `kol-email-customize` aigcgateway action |
| AI 周报 | ✅ MVP | ✅ | `weekly-report-for-client` aigcgateway action |
| AI 推广素材 | ✅ MVP | ✅ | `src/lib/products/generateAiAssets.ts` |
| Smart Match（embedding）| ✅ B7 | ✅ | B7a F001/F002 signoff（pgvector + bge-m3）|
| AI Insights 自动分析 | ✅ B7 | ✅ | `RoiInsightsPanel` + `/database` Intelligence + `/campaigns/[id]` Suggestions |
| KOL 相似推荐 | 🆕 B7→B8 | ❌ B8 未启动 | 计划内推迟 |
| 跨语言 KOL 匹配 | 🆕 B7→B8 | ❌ B8 未启动 | 计划内推迟 |

---

## 6. PRD §13 开放问题落地

| Q | 用户答复 | 落地状态 |
|---|---|---|
| Q1 AI 打标 review | 二次复审通过即上 | ✅ MVP-kol-seed-redo done |
| Q2 XLSX 数据量够吗 | 二次复审够 MVP | ✅ |
| Q3 AI 定制邮件 context | 用 aigcgateway action/template | ✅ `kol-email-customize` |
| Q4 周报对象 | 给客户看 | ✅ `weekly-report-for-client` action 名验证 |
| **Q5 Product 强制字段** | 强制要求 | ⚠️ **uniqueSellingPoints required，targetAudience nullable —— 部分** |
| Q6 Google OAuth disabled | 接受 | ✅ disabled + tooltip |
| Q7 浏览器语言自动跳 | 自动跳 | ✅ middleware Accept-Language |
| Q8 ROI AI Insights | 需要 | ✅ RoiInsightsPanel |

---

## 7. 生产上线就绪 Checklist

| 项 | 状态 | 备注 |
|---|---|---|
| 生产代码已部署最新 | ✅ | `kol.guangai.ai/api/health` git_sha=1cf2764 |
| 数据库迁移已 apply | ✅ | DB latency 81ms healthy |
| 数据库已 seed | ❌ | **阻塞登录 demo flow** |
| AIGCGATEWAY_API_KEY | ✅ | 67 chars 已配 |
| RESEND_API_KEY | ✅ | 36 chars 已配 |
| TLS 证书 | ✅ | Let's Encrypt 到期 2026-07-19 |
| Nginx 反代 | ✅ | BI3 落地 |
| PM2 cluster + systemd | ✅ | BI2 落地 |
| 部署 workflow（手动触发）| ✅ | BI2-F003 |
| 自动备份 cron | ✅ | BI2-F004 |
| 自动回滚链路 | ✅ | BI2-F006 |
| Staging 同构 | ✅ | BI3 + BIx-staging-automation |
| 5 语言 i18n | ✅ | en/zh/ja/ko/es 全译 |
| Prod 烟测脚本/checklist | ❌ | MVP-prod-launch-smoke spec 未执行 |
| Demo 数据 seed 包 | ❌ | MVP-seed-demo-prep spec 未执行 |

---

## 8. 推荐下一批次（按收益排序）

### 选项 A：MVP-launch-readiness（推荐）⭐
**包含：** §3.1 Dashboard 补 3 元素 + §3.2 prod seed + §3.3 Q5 Product 字段 + MVP-prod-launch-smoke 执行 + MVP-seed-demo-prep 执行。
**预估：** 2-3 天 Generator 工作 + 1 天 Evaluator。
**收益：** 直接清理掉所有 P0 阻塞 → MVP 可邀请种子用户。

### 选项 B：B8-ai-extensions 提前
**包含：** KOL 相似推荐 + 跨语言匹配 2 features。
**风险：** 违反 PRD §11 "PMF 叙事"决策（邀请第 2 周再上线，否则没"产品在迭代"信号）。

### 选项 C：B4-extended-email-system
**包含：** Resend webhook / 自动退订 / 邮件跟踪。
**适合：** MVP 邀请发出后用户反馈集中在邮件合规与跟踪时再做。

---

## 9. 参考文档

- PRD：`docs/product/KOLMatrix-MVP-PRD.md`
- Roadmap：`docs/specs/roadmap.md`
- 部署 runbook：`docs/dev/deployment-runbook.md`
- 18 个已签收批次的 signoff 报告：`docs/test-reports/*-signoff-*.md`
- Backlog 未完成项：`backlog.json`（剩 BL-003 / BL-011 / BL-012 三条，均 deferred 或 low）

---

**审计执行 commit：** 当前会话 Planner（johnsong）独立任务产出，不修改状态机文件。
