# MVP Polish 审计报告 — 2026-04-30

> **作者：** Planner（johnsong）
> **审计对象：** 所有 11 个 MVP 页面 + 跨页问题（数据 / UI / UX / i18n / 性能）
> **目标：** 找出**已经在 production 但需要 polish** 的功能点和页面（区别于"已规划但未做"的功能）
> **范围参考：** 已签收 18 批次 + 当前 in-flight 批次（B5 + 已锁 MVP-internal-demo-prep）
> **生产 HEAD：** `1cf2764`

---

## TL;DR

**已经规划解决的 polish（不在本报告范围）：**
- ✅ KOL 详情页数据稀疏 → **B5 in flight**（banner / 6 视频 / 词云 / 真 engagement）
- ✅ Dashboard 缺 PRD §4.1 三元素 → **MVP-internal-demo-prep F001 已锁**
- ✅ Q5 Product targetAudience 强制 → **MVP-internal-demo-prep F002 已锁**
- ✅ 5 款 demo 游戏 Products → **MVP-internal-demo-prep F003 已锁**

**本报告独立发现的 polish 点：8 类共 23 项。** 其中 P0（建议 MVP-internal-demo-prep 期间一起修）4 项，P1（独立 micro-batch / 团队 demo 后期补）11 项，P2（Post-MVP 收口）8 项。

---

## P0 — 建议并入 MVP-internal-demo-prep（4 项，~半天工时）

### P0-1. Dashboard EmailPerformanceCard 仍是 14 天 mock 数据
**位置：** `src/features/dashboard/mocks.ts` + `src/features/dashboard/EmailPerformanceCard.tsx`
**问题：** EmailPerformanceCard 用 `EMAIL_PERFORMANCE_DATA`（14 天 sine wave 模拟，sent / opened / replied 全 fake）渲染。注释明确写"mock，B3+ 替换"。
**对内部 demo 影响：** 团队成员看到的"Email Performance"图与实际 EmailLog 完全脱钩；切换 tenant 数据也不变 → demo 失真。
**修复方案：** 改为从 EmailLog 表 aggregate 14 天真实 sent/opened/replied（前 14 天没有数据时友好 empty state "Send your first batch via /outreach"）。
**估时：** ~3-4h（DB query + 数据 mapping + empty state）
**建议归属：** MVP-internal-demo-prep 加个 F006

### P0-2. Dashboard RecentActivityCard 仍是 5 条 mock 数据
**位置：** `src/features/dashboard/mocks.ts` 的 `RECENT_ACTIVITIES`
**问题：** 5 条 hardcoded 活动（"Sarah Chen added 3 KOLs to Honor of Kings campaign"等）固定不变。
**对内部 demo 影响：** 团队看不到自己刚做的操作（点了 Smart Match / 创建了 Campaign 都没反映到这里）。
**修复方案：** 从 `audit_log`（BI4 落地）按 tenant 拉最近 5 条（已有 actor_user / action / before/after / created_at 字段，转译为 "Sarah Chen marked NeonHaze as 'first_contact'" 这类自然语言）。
**估时：** ~2-3h（已有数据，只需 query + i18n 翻译）
**建议归属：** MVP-internal-demo-prep F006（与 P0-1 合并）

### P0-3. /campaigns 列表 AiSuggestionsCard 仍标 "Coming with B2"
**位置：** `src/app/[locale]/(app)/campaigns/AiSuggestionsCard.tsx`
**问题：** 文件 header 注释："live AI matching engine ships with B2"，UI 上显示 `<span>Coming Tag</span>` purple badge。
**实际：** B7b F002 已在 `/campaigns/[id]` 落地真实 AI Suggestions（`AiSuggestionsClient.tsx`）。**列表页这个卡片仍是占位。**
**对内部 demo 影响：** 团队看到列表页"AI Suggestions Coming"，进了详情页又看到"AI Suggestions"在工作 → 一致性差。
**修复方案：**
- a. 升级为列表级别 AI（如"为本季 3 个 active campaigns 推荐共 X 个 KOL"）—— ~半天
- b. 直接删除列表页这个卡片（详情页已有真 AI，列表上不需要） —— 5 min
- c. 改文案为 "AI Suggestions live on each campaign" + 引导到详情页 —— 30 min
**建议归属：** MVP-internal-demo-prep 决策点 + 选 b 或 c

### P0-4. /api/health redis 字段返回 stub
**位置：** `src/app/api/health/route.ts`
**问题：** redis check 永远返回 `{status: "stub", note: "wired in B5 with BullMQ"}`。
**对内部 demo 影响：** 如果团队 review `/api/health` JSON（产品成熟度证据），看到 stub 会觉得"还没做完"。BullMQ 真接入是 Post-MVP（PRD §12 已说 BullMQ workers 不真跑）。
**修复方案：**
- a. 文案改为 `{status: "not_used", note: "BullMQ enables in production scale"}` —— 5 min（更产品化的措辞）
- b. 真接 Redis ping（不接 BullMQ workers）—— 30 min（验证 Redis 实例可达）
**建议归属：** MVP-internal-demo-prep 加进 F005 prod smoke checklist + 简单文案修

---

## P1 — 独立 micro-batch 或团队 demo 后期补（11 项）

### P1-1. /crm Header 3 个 ghost 控件（disabled with tooltip）
**位置：** `src/app/[locale]/(app)/crm/CrmHeader.tsx`
**问题：** 时间 toggle 仅 "Last 90d" 可点（thisQuarter / allTime disabled），Export CSV disabled，"+Manual log" disabled。3/4 控件灰着。
**guardrail 状态：** 已加 tooltip（per `ui-fidelity-guardrail.md`）—— 不算违规
**对内部 demo 影响：** "怎么这么多功能没做" 直观感受
**修复方案：** 时间 toggle 真接（CRM 数据按 `audit_log.created_at` 范围过滤，~4h）；Export CSV 真做（~2h）；Manual log 暂留 disabled 等 B4-extended 的 webhook
**建议归属：** B4-extended-email-system 批次扩范围，或独立 BIx-crm-polish 批次

### P1-2. /campaigns Header Import 按钮 disabled
**位置：** `src/app/[locale]/(app)/campaigns/page.tsx:101`
**问题：** "Import" 按钮 disabled
**修复方案：** PRD §12 已说 CSV 批量导入 = B1 完整版。MVP 阶段保持 disabled 但**改文案**为 "Import (Coming in B1)" 或直接移除按钮
**建议归属：** 简单文案修，~10 min，可并入 P0-3 同 commit

### P1-3. /campaigns CampaignsFilterBar Owner filter disabled
**位置：** `src/app/[locale]/(app)/campaigns/CampaignsFilterBar.tsx`
**问题：** Owner filter disabled (MVP solo-tenant)
**修复方案：** MVP 阶段单 Demo Studio tenant 的话团队成员都用同一组 admin/marketer，Owner 就 2 个值。可以**真做** owner filter（~30 min）让团队 demo 时看到。
**建议归属：** 可独立 micro-batch，或并入 polish micro-batch

### P1-4. /database BulkActionBar Email 按钮 disabled
**位置：** `src/app/[locale]/(app)/database/BulkActionBar.tsx`
**问题：** Email 按钮 disabled，注释说 "point users at /outreach instead"
**修复方案：** 可以变成"跳转按钮"（点了就跳到 /outreach 带 ?kolIds=... 预选）—— ~30 min
**建议归属：** 独立 polish micro-batch

### P1-5. Dashboard 移动端响应式不足
**位置：** `src/app/[locale]/(app)/dashboard/page.tsx`
**问题：** 全文件仅 3 处 responsive breakpoint（`grid-cols-1 lg:grid-cols-3` / `xl:grid-cols-5` / 1 处其他）。在 mobile（< 640px）和 tablet（640-1024）布局可能崩。
**对内部 demo 影响：** 如果团队成员手机点开看 demo，体验差
**修复方案：** 全 11 页 mobile 适配 spot check + 必要修复 ~半天-1 day
**建议归属：** 独立 BIx-mobile-responsive 批次（含所有 11 页）

### P1-6. ja/ko/es 翻译质量未由人工审
**位置：** `messages/{ja,ko,es}/*.json`
**问题：** MVP-i18n batch 用 doubao-pro 自动翻译，仅 zh 由用户手动 review。ja/ko/es 翻译质量依赖 LLM。可能有不地道用语 / 翻译错误。
**修复方案：** 找 native speaker / 团队 ja/ko/es 母语成员 review 100-200 个高频 key
**建议归属：** Post-MVP，根据团队语言能力安排

### P1-7. 视觉回归基线只 Linux 平台跑
**位置：** `tests/e2e/visual-regression.spec.ts` (13 个 test.skip with platform check)
**问题：** 非 Linux runner 全部跳过 visual-regression。其他 OS 上的开发者 / Reviewer 看不到漂移。
**对内部 demo 影响：** 无（只是测试覆盖差）
**修复方案：** 起 macOS / Windows 跑 baseline + Docker 跑统一容器（要 ~1 day infrastructure work）
**建议归属：** Post-MVP infra 优化批次

### P1-8. /weekly-report PDF 导出依赖浏览器原生 print
**位置：** `src/app/[locale]/(app)/weekly-report/WeeklyReportClientActions.tsx`
**问题：** Download PDF 实际是 `window.print()` + 打印样式表，需用户在打印对话框选 "Save as PDF"。不是真"一键下载 PDF"
**对内部 demo 影响：** 团队第一次点 Download PDF 看到打印对话框可能困惑
**修复方案：**
- a. 加帮助文案 "Save as PDF in the print dialog" —— 5 min
- b. 接 jsPDF 真生成 PDF —— ~半天，但样式难还原
- c. 接 puppeteer 服务端渲染 PDF —— ~1 day，准确但成本高
**建议归属：** a 立刻做（5 min），b/c Post-MVP 评估

### P1-9. 邮件真发 fallback 时静默成功（mock_sent）
**位置：** `src/lib/email/resend.ts`
**问题：** 当 RESEND_API_KEY 未设时返回 `{mocked: true}` + EmailLog 标 status=`mock_sent`。
**对内部 demo 影响：** prod 已配 RESEND_API_KEY ✓，所以这条理论不触发。但如果 key 失效或 reset 后没及时更新，会"假装发出去"
**修复方案：** 加监控告警（如果 mock_sent 计数 > 0/天 → 告警）；或配 fail-fast 模式（无 key 时 throw 而不是 mock fallback）
**建议归属：** Post-MVP ops 收口

### P1-10. Loading / Empty / Error 状态全页面 spot check 未做
**问题：** 11 页中只有 /outreach 明确审过 error state（saveError / sendError / patchError）。其他页的 empty state（如新 tenant 还没数据）和 error state（如 API 报错）未系统检查。
**对内部 demo 影响：** 团队成员遇到边界 case 可能看到空白屏 / 不友好 error
**修复方案：** 11 页 × 3 状态（loading / empty / error）spot check + 必要修复
**建议归属：** 独立 BIx-edge-states 批次（~1.5-2 day）

### P1-11. /shared/weekly-report/[token] 分享链接的过期时间 / 撤销机制
**问题：** 周报分享链接生成（B7b F002 / BM2-F010）但**未审过过期时间是否可控 / 撤销是否生效**。
**修复方案：** 检查代码，如有 issue 加上过期时间字段 + revoke API
**建议归属：** Post-MVP（团队内部 demo 不会真分享给外部）

---

## P2 — Post-MVP 收口（8 项）

### P2-1. AccessRequest 无 admin 后台审批 UI
**问题：** PRD §10.3 已说 "manual SSH 改 status='approved'"，admin UI = B9。Post-MVP 接客户后才痛。

### P2-2. 性能审计未做（lighthouse / LCP / CLS）
**问题：** 没数据。Post-MVP 上线后真用户访问采指标即可。

### P2-3. 可访问性审计未做（aria / keyboard nav / screen reader）
**问题：** 团队内部 demo 可不要求；公开后必须做。

### P2-4. KOL 详情页旧 audience demographics tab placeholder（B5 即将隐藏）
**问题：** B5 F004 in flight 解决。

### P2-5. /api/health 公开无 rate limit
**问题：** 公网可被 DDoS 探测。Post-MVP 加 nginx rate limit。

### P2-6. CRM Recent Changes 限制 30 条
**位置：** `src/app/[locale]/(app)/crm/CrmRecentChanges.tsx`（推测）
**问题：** PRD §11.4 简化版 CRM。现 audit_log 显示最近 30 条不分页。多了之后可能过长。
**建议归属：** B4-extended 范围

### P2-7. /knowledge-base 上传图片 / 下载链接缺乏验证
**问题：** Product 的 `downloadUrl` field 没 URL validation；图片上传未审过 size limit / MIME 校验
**建议归属：** Post-MVP security 收口

### P2-8. EmailTemplate 多语言切换不自动联动 KOL 语言
**问题：** /outreach 选模板时手动按 locale 切。智能匹配（KOL 语言 → 选对应 locale 模板）= Post-MVP

---

## 跨页 polish 主题汇总

### 主题 A：Mock / 占位数据残留
- Dashboard EmailPerformance + RecentActivity（**P0-1, P0-2**）
- /campaigns AiSuggestionsCard（**P0-3**）

### 主题 B：Ghost Controls（disabled with tooltip）— guardrail 已加，但量大
- /crm Header 3 个（**P1-1**）
- /campaigns Import + Owner filter（**P1-2, P1-3**）
- /database BulkActionBar Email（**P1-4**）
- 共 6 个 disabled 控件，给团队第一感是"半成品"

### 主题 C：移动端 / 跨设备适配
- 仅 dashboard 抽样发现 breakpoint 不足（**P1-5**），其他页未审
- 团队 demo 如有 mobile 场景需补

### 主题 D：i18n 质量
- 5 语言全译 ✓，但 ja/ko/es 仅 LLM 自动翻译未人审（**P1-6**）

### 主题 E：测试覆盖
- visual regression 平台限制（**P1-7**）
- edge states 系统性 spot check 缺（**P1-10**）

### 主题 F：UX 边界
- PDF 导出"一键"措辞与实际 print 对话框不一致（**P1-8**）
- 邮件 fail-silent fallback（**P1-9**）

---

## 执行优先级建议

### 立即处理（建议并入 MVP-internal-demo-prep 当前 sprint）
| 项 | 工时 | 加载到现有 features 中 |
|---|---|---|
| **P0-1** Dashboard EmailPerformance 真接 EmailLog | ~3-4h | 加为 F006 一部分 |
| **P0-2** Dashboard RecentActivity 真接 audit_log | ~2-3h | 加为 F006 一部分 |
| **P0-3** /campaigns AiSuggestionsCard 改文案/删除（选 b 或 c） | 5-30 min | 加为 F007 |
| **P0-4** /api/health redis 文案改产品化 | 5 min | 加为 F007 一部分 |

**建议：** MVP-internal-demo-prep 5 features → 增加 F006 (Dashboard 真数据) + F007 (文案 polish 整理) = 7 features，工时 +1 day。

### 独立 micro-batch（B5 + MVP-internal-demo-prep 都 done 后）
- BIx-polish-pass：P1-2 / P1-3 / P1-4 / P1-8a / P1-10（~2-3 day）
- 主题：清掉 ghost controls + 加 edge states

### Post-MVP 收口
- 全 P2 项 + P1-5 mobile + P1-6 i18n 翻译质量 + P1-7 visual baseline 跨平台

---

## 引用文档

- `docs/test-reports/BM1-BM2-ui-fidelity-audit-2026-04-24.md`（前次 UI fidelity 大审计）
- `docs/test-reports/MVP-visual-fidelity-hotfix-signoff-2026-04-27.md`（5 页 hotfix 已闭环）
- `docs/test-reports/B7b-placeholder-and-ai-aux-signoff-2026-04-29.md`（占位升级真 AI）
- `framework/harness/ui-fidelity-guardrail.md`（ghost controls + tooltip 硬要求）
- `docs/product/MVP-gap-audit-2026-04-30.md`（MVP 功能对齐审计）
- `docs/specs/MVP-internal-demo-prep-spec.md`（建议加 F006/F007）

---

**审计执行 commit：** Planner（johnsong）独立任务产出，不修改状态机文件。
