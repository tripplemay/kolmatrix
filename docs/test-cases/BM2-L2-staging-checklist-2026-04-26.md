# BM2 L2 Staging 功能验收清单

> **目的：** 补 Reviewer L1 之后的 L2 staging 功能性烟测（evaluator.md "L2 staging 强制" 要求），确认 BM2 11 features 的非视觉功能在 staging 真跑通。
> **范围：** **仅功能性烟测**，视觉差异（Stitch 还原度 🟡 中度）out of scope，留 MVP-visual-fidelity hotfix 处理。
> **执行者：** Reviewer
> **起草者：** Kimi (Planner)
> **起草时间：** 2026-04-26 21:55
> **Staging commit：** `eb36bdd`（main HEAD，刚由 Planner SSH deploy 完成）

---

## 0. 前置环境（Planner 已完成）

- [x] Staging deploy `eb36bdd`（main HEAD）— 本地 a075c02 → eb36bdd
- [x] migrate deploy 应用最后一个 migration `20260425000000_F010_weekly_report_unique`
- [x] npm ci --include=dev（解决 build-time @tailwindcss/postcss 缺失，详见**残余风险 §1**）
- [x] build 成功
- [x] pm2 restart kolmatrix-staging → online
- [x] db seed → 1 tenant / 2 users / 12 kols / 3 campaigns / **10 EmailTemplates** ✓ / 300 EmailLogs

**Health：** `https://staging.kol.guangai.ai/api/health` → status=healthy, DB ok 174ms（git_sha=unknown 是 BL-002 已知，本批次不修）

**公开 endpoint smoke（Planner 已跑）：**
- [x] `/en/login` 200
- [x] 6 个受保护路由 `/en/{discovery,campaigns,outreach,crm,roi,weekly-report}` 全部 307 → `/en/login`（locale-prefixed 正确，BM1 F009 教训落地 ✓）
- [x] `/shared/weekly-report/invalid-token` 404（F010 token 校验生效 ✓）

---

## 1. 登录前置

- 测试账号：`marketer@kolmatrix.local` / `KOLM@2026!`
- 浏览器：Chrome（隐身模式）
- 期望：登录后 URL = `https://staging.kol.guangai.ai/en/dashboard`

---

## 2. 功能验收清单（按 features.json F001-F011 顺序）

### F001 — Schema migration applied

- [ ] `/en/database` 加载，KOL 表显示（说明 schema 表存在 + RLS 工作）
- [ ] DB 内确认（Planner 已 ssh 验证 migrate deploy "All migrations have been successfully applied"）

### F002 — EmailTemplate seed 10 套

- [ ] `/en/outreach` 页面 EmailTemplate selector 下拉显示至少 5 个 system 模板（locale=en 过滤后应 5 个）
- [ ] 切换 locale 到 zh：`/zh/outreach` 模板下拉显示 5 个 zh 模板
- [ ] **期望：** 5×en + 5×zh = 10 模板（Planner seed 输出 ✓）

### F003 — /campaigns 列表

- [ ] `/en/campaigns` 200 显示（导航栏 active=Campaigns）
- [ ] 显示 seed 的 3 个 campaigns（campaign1 / campaign2 / campaign3）
- [ ] 顶部 '新建 Campaign' 按钮可点跳 `/en/campaigns/new`
- [ ] filter status=active → 列表筛选生效

### F004 — /campaigns/new 表单

- [ ] `/en/campaigns/new` 200
- [ ] 必填校验：name 留空提交 → 报错
- [ ] productId dropdown 显示 seed 的产品（如有）
- [ ] 提交合法表单 → redirect 到 `/en/campaigns/<新id>`，详情页显示新 campaign

### F005 — /campaigns/:id 详情 + KOL Panel

- [ ] 打开任一 seed campaign 详情页
- [ ] Header 4 KPI 卡显示（Budget/Spend/Revenue/ROI%）
- [ ] '添加 KOL' modal 弹层（注：本版本仍是手写 modal，hotfix F005 才换 Dialog）
- [ ] modal 列出 saved KOLs（isSaved=true）且排除已在本 campaign 的
- [ ] 添加 KOL → modal 关闭，KOL 列表立即更新（revalidate 生效）
- [ ] 修改 contactStatus dropdown → 状态更新成功
- [ ] kolFee 输入 → onBlur 后 spendTotal 重算正确

### F006 — /outreach AI 定制 + Resend 发邮件

- [ ] `/en/outreach?campaignId=<id>` 加载，campaign selector 预选
- [ ] KolCampaign 行勾选；无 email 的 KOL 标灰 + tooltip
- [ ] **AI 定制按钮：** 点击 → AiCustomizeDialog 弹层 → 调 aigcgateway Action `kol-email-customize` → 显示原版 vs AI 版（如失败留意 stripCodeFence 教训，BL-001 已修）
- [ ] **发送邮件：** 选 1 个有 email 的 KOL → 发送 → EmailLog 写入（status=mock_sent 或 sent）
- [ ] **关键：** 由于 staging 配了 RESEND_API_KEY 真发，请用 1 个**测试邮箱**（如 marketer 自己 email）做发送测试，避免给真实 KOL 发邮件
- [ ] event_log 写入：email.sent / email.ai_customize_clicked / email.ai_customize_accepted

### F007 — /crm overview

- [ ] `/en/crm` 200
- [ ] Section 1 阶段分布 6 卡显示数量（按 Kol.relationshipStatus）
- [ ] Section 2 漏斗图渲染（prospect→first_contact→negotiating→long_term）
- [ ] Section 3 合作总额 KPI 真算（Σ KolCampaign.kolFee where status ∈ signed/delivered/paid）
- [ ] Section 4 最近关系变化表（audit_log 查 kol.relationship_status_changed 最近 30 条）

### F008 — ROI 引擎 API

- [ ] `GET /api/roi/summary` 200 + JSON 含 totalSpend / totalRevenue / avgRoi / topCampaign / campaignCount
- [ ] `GET /api/roi/trend?days=30` 200 + JSON 数组按日聚合
- [ ] `GET /api/roi/campaigns` 200 + JSON 数组按 roiPercent DESC

### F009 — /roi 页 + AI Insights

- [ ] `/en/roi` 200
- [ ] 4 KPI 卡（TotalSpend/TotalRevenue/AvgROI%/TopCampaign ROI）
- [ ] 30 天趋势 recharts line chart 渲染（spend vs revenue + ROI% 次轴）
- [ ] Campaign ROI 表按 roiPercent DESC
- [ ] **AI Insights：** 点 'Generate Insights' → 调 aigcgateway Action `roi-insights` (Gemini) → 显示 3-5 条 bilingual 洞察 match locale
- [ ] localStorage cache key `roi-insights-{tenantId}-{YYYYMMDD}` 写入；'重新生成' 按钮可强刷

### F010 — /weekly-report 生成 + PDF + 分享

- [ ] `/en/weekly-report` 200，date picker 默认过去 7 天
- [ ] 点 '生成周报' → 调 aigcgateway Action `weekly-report-for-client` (Gemini) → 显示 markdown 5 段式渲染
- [ ] WeeklyReport 写入 DB（contentMd 非空 / summaryJson 含 tenant snapshot）
- [ ] **PDF 导出：** 点 'PDF' → 浏览器 print preview → 单击 PDF 保存可下载（@media print 隐藏 nav/sidebar）
- [ ] **分享链接：** 点 '生成分享' → POST /api/weekly-reports/:id/share-token → 显示 32 字符 token URL
- [ ] **匿名访问：** 复制 share URL（`/shared/weekly-report/<token>`），隐身浏览器打开 → 显示 markdown 渲染（不要求登录），含 brand header
- [ ] 历史周报切换 `/weekly-report?id=:id` 显示最近 10 份

### F011 — Tests + visual baselines（已在 L1 完成 PASS）

- [x] 已在 L1 PASS（不重做）

---

## 3. 跨租户隔离烟测（强制，5 min）

- [ ] 浏览器 A 用 marketer@kolmatrix.local 登录 tenantA → 创建 1 个 campaign 'L2-test-A'
- [ ] 浏览器 B（隐身）用 admin@kolmatrix.local 登录 → 检查 `/en/campaigns` 看不到 'L2-test-A'（如 admin 是同 tenant 则跳过这条；本 seed 应 admin/marketer 同 tenant，仅做单租户验证）
- [ ] 隐身浏览器请求受保护 API `GET /api/campaigns` 无 cookie → 401/307

---

## 4. 残余风险（写入 signoff Phase 2）

### 4.1 staging build 依赖问题（**新发现**）

- **现象：** staging 用 `NODE_ENV=production` 时 `npm ci` 默认 `--omit=dev`，导致 `@tailwindcss/postcss` 不装，build fail。
- **临时修复：** Planner deploy 时用 `npm ci --include=dev`。
- **长期修复（建议加入 backlog）：** `@tailwindcss/postcss` + 其他 build-time PostCSS 插件应移到 `dependencies`，或 staging deploy script 显式 `npm ci --include=dev`。**同时影响 prod**（prod 下次 deploy 同坑），需要 BIx-staging-automation 批次或 polish 批次统一处理。
- **TODO：** Reviewer 在 signoff Phase 2 标记此为 P2 backlog 候选项（不阻塞 BM2 done）。

### 4.2 git_sha=unknown（已知 BL-002）

- staging health endpoint git_sha=unknown 仍未修；prod 正常显示 sha
- 不阻塞 BM2 done（已有 backlog）

### 4.3 视觉差异（已知 🟡 中度）

- 留 MVP-visual-fidelity hotfix 处理
- 本 L2 不评估视觉

---

## 5. 通过判定

- 全部 F001-F010 勾选 + 跨租户烟测勾选 → BM2 L2 PASS
- 任何 P0/P1 阻断（破坏核心路径）→ status 回 fixing，Generator 修复
- 仅 P2 残余风险（如 build-time 依赖）→ 写 backlog，不阻塞 done

---

## 6. Reviewer 签收 Phase 2 模板

L2 完成后 Reviewer 在 `docs/test-reports/BM2-campaign-outreach-roi-signoff-2026-04-26.md` **追加** §"L2 Staging 验收（2026-04-26 21:xx）"段落：

```markdown
## L2 Staging 验收（2026-04-26 21:xx）

> 触发：Planner 回退 status reverifying，补 L2 强制要求
> Staging URL: https://staging.kol.guangai.ai
> Staging commit: eb36bdd

### 功能验收（F001-F010）
- [全部勾选清单结果]

### 跨租户烟测
- [...]

### 残余风险
- P2: staging NODE_ENV=production 下 npm ci 漏装 @tailwindcss/postcss build-time 依赖（详见 docs/test-cases/BM2-L2-staging-checklist-2026-04-26.md §4.1）— 加入 backlog
- P2: BL-002 staging git_sha=unknown 仍存在（已有 backlog）
- 视觉差异留 MVP-visual-fidelity hotfix

### 结论
BM2 L2 PASS / FAIL，status → done / fixing
```

---

**清单就绪，等 Reviewer 接手。**
