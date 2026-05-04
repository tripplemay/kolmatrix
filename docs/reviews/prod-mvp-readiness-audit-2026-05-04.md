# Prod MVP 链路全面体检 — 2026-05-04

> **作者：** Claude CLI（独立任务模式，不修改状态机）
> **审计 commit 基线：** prod `c0b3782` / staging `cc1658d` / main `b99353c`
> **数据来源：** `progress.json` / `features.json` / `backlog.json` / 18 个 signoff / `docs/product/MVP-gap-audit-2026-04-30.md` / 全代码 grep（disabled + ghost-control + 安全点位）/ 实测 prod & staging /api/health

---

## TL;DR — 一句话结论

**MVP 7 步端到端 Journey 在 prod 全部跑得通**，11 个页面齐全，关键 schema / AI / Email / RLS / 国际化 / 监控全部到位。但**对外邀请客户前还有 18 项必须闭环**，分四个池子：

| 池子 | 数量 | 严重度 | 阻塞性 |
|---|---|---|---|
| **A. BL-033 in-flight 修复**（已 plan 未上线） | 4 项 | 高 | 团队内部 demo 已被 prod 用户连报 |
| **B. BL-020 安全 mini-batch**（high backlog） | 6 安全 + 2 UI | Critical / High | 对外客户前必修（含 SQL/XSS/Rate-limit） |
| **C. BL-024 ghost controls 实装** | 8 处 disabled | Medium | UI 已展示但未实装 — 暴露产品成熟度 |
| **D. PRD spec 偏差残留** | 4 项 | Medium-Low | 不破 DoD 但与 PRD §4.1 / §13 不一致 |

**当前 prod 落后 main 4 commit**（BL-033 building 中、framework v0.9.9、BL-032 prod backfill 状态文件）。BL-033 上线即清掉池子 A。**池子 B 必须排进 BL-020 mini-batch；池子 C 排进 BL-024 mini-batch**——两个都已 plan 在 backlog，未启动。

---

## 1. 部署版本对位

| 环境 | git_sha | 与 main 差距 | 健康 |
|---|---|---|---|
| **Prod** `kol.guangai.ai` | `c0b3782` | 落后 4 commit（BL-033 + framework v0.9.9 + BL-032 backfill state） | ✅ healthy / DB latency 16ms |
| **Staging** `staging.kol.guangai.ai` | `cc1658d` | 落后 1 commit（仅 state files） | ✅ healthy / DB latency 23ms |
| **main** | `b99353c` | — | BL-033 building, 0/4 features done |

**已安全到 prod 的批次：** BL-025 / BL-026 / BL-027 / BL-030 / BL-031 / BL-032（含代码层 Mustache 强制 + KB→Asset 数据通路 + Composer locale 修复 + Asset Library + UX 重构 + Hotfix）。BL-032 prod backfill 已通过 SSH 跑过（25 行旧数据已转 Mustache）。

---

## 2. 池子 A — BL-033 in-flight 修复（4 项，prod 用户已连报 2 个）

**当前状态：** `progress.json: building` / 0/4 done / 仅 spec 已写。

| ID | 严重度 | 用户感知 | 代码确认未修 |
|---|---|---|---|
| **F001 Checkbox unchecked 视觉永显 ✓** | Critical UI Bug | /zh/outreach KOL 选择框假勾视觉错乱 | `src/components/ui/Checkbox.tsx:69` 仍含 `keepMounted` |
| **F002 `{{date}}` token + backfill** | Medium | Send Test 邮件含 `[DATE]` 字面量 1 行残留 | `SubstituteVariables` interface 未含 `date`；scripts/convert-bracket-tokens-to-mustache 第 5 映射未补 |
| **F003 Server-side AI placeholder validation** | Medium | 新 KB AI 生成若漏 Mustache 又写库（v0.9.9 §3 未落地） | `src/lib/products/generateAiAssets.ts` 未含 `AiPlaceholderViolationError` 或 `validateNoBracketPlaceholders` |
| **F004 /assets i18n 完整接入** | High UX | /zh/assets 60+ 处硬编码英文（30 t() vs 60+ 硬编码） | `messages/{zh,en,ja,ko,es}.json` 5 文件均缺 `assets` 命名空间（仅 zh.json 一处 `assetsReady` 残留） |

**建议：** Generator 接 BL-033 building 角色，按 spec 落地 4 features → Reviewer 验收 → prod redeploy。

---

## 3. 池子 B — BL-020 安全 mini-batch（6 安全 + 2 UI，全部未修）

**Backlog 优先级：high；2026-05-01 三 agent 并行审计产出，对外客户前必须落地。**

### 3.1 Critical / High 安全（6 项）

| 编号 | 描述 | 文件确认仍未修 |
|---|---|---|
| **CR-1** productId 缺 UUID 格式校验 | `knowledge-base/actions.ts:21-22` 仅 tenantId UUID_RE，`normalizeProductId` 只查非空 |
| **CR-2** AI 生成 URL 直渲染 `<a href>`（潜在 open redirect） | `campaigns/[id]/AiSuggestionsClient.tsx:150` `s.action_link` 仅用 `startsWith("/")`，无路径白名单 + 无 schema 校验 |
| **CR-3** `dangerouslySetInnerHTML` 内联脚本 | `discovery/FilterSidebar.tsx:344` 仍存在（当前常量安全，但反范式） |
| **H-S1** SQL 注入风险 | `src/lib/db.ts:60` `tx.$executeRawUnsafe(\`SET LOCAL app.tenant_id = '${tenantId}'\`)` — 字符串插值未参数化（`assertUuid` 兜底单点） |
| **H-S2** 登录无防爆破 / 限流 | 全 src 0 个 `@upstash/ratelimit` 引用；`login/actions.ts` 无 rate limit |
| **H-S3** HTTP 安全头部分缺失 / CSP 仍 Report-Only | `next.config.ts:71` `Content-Security-Policy-Report-Only`（X-Frame-Options/HSTS 已有），但**未切 enforce** |

### 3.2 顺手修 UI（2 项）

| 编号 | 描述 | 确认 |
|---|---|---|
| **UI-1** Dashboard QuickActions Campaigns 假死 | `src/features/dashboard/QuickActions.tsx:25` `{ key: "campaigns", href: null }` + "Coming soon" tooltip — 但 /campaigns 已上线（侧栏可进），卡片误导用户 |
| **UI-2** /discovery 暴露 12 条 demo_seed mock KOL | `src/lib/kol/filters.ts:387 buildKolWhere` 不含 `emailSource: { not: "demo_seed" }` 过滤；prod /discovery 直接看到 demo Studio mock，对外不专业 |

**建议：** BL-033 done → 立即起 BL-020 mini-batch（~0.5-1 day Generator + 0.25 day Reviewer + 一周 CSP-Report-Only 观察期后切 enforce）。

---

## 4. 池子 C — BL-024 ghost controls 实装（8 处 disabled）

**Backlog 优先级：medium；A/B/C 必做，D 决策点，E/F 不在范围。**

| 位置 | 文件 / 行号 | 当前状态 | 优先级 |
|---|---|---|---|
| **A. /database 头 3 按钮**（Export / Import / Add KOL） | `database/page.tsx:127-159` 三 disabled Button | 高 ROI，对外必用入口 |
| **B. /roi 时间范围 toggle**（7D/30D/90D/All） | `roi/RoiHeader.tsx:73-88` `30D` 唯一 active，其它 disabled+tooltip "B4" | 中 ROI |
| **C. /weekly-report 时间范围 toggle**（Last Week/Month） | `weekly-report/WeeklyReportHeader.tsx:85-100` Last Week active，Last Month disabled | 中 ROI |
| **D. /outreach 子导航 3 tabs**（Send Queue / Tracking / Suppression） | `outreach/OutreachTabs.tsx:79-89` 3 tabs disabled+tooltip "comingB4" | 工时高，启动时再裁 |
| **E. /knowledge-base Import CSV** | `knowledge-base/ProductsClient.tsx:62-72` button disabled | 低，deferred |
| **F. /database BulkActionBar Delete** | `database/BulkActionBar.tsx:73` disabled（destructive，B6 范围） | 不入本批次 |
| **/campaigns Import button** | `campaigns/page.tsx:6` 注释 "Import disabled" | 同 E，低 |
| **Dashboard QuickActions Campaigns** | 重复 UI-1，已收进 BL-020 | 顺手修 |

**建议：** BL-020 done → 起 BL-024 mini-batch（A/B/C 必做 ~1.5 day；D 启动时再裁；E deferred）。

---

## 5. 池子 D — PRD spec 偏差残留（4 项，DoD 不阻塞）

| 编号 | 来源 | 现状 | 建议 |
|---|---|---|---|
| **D1** Q5 Product `targetAudience` 应 required | PRD §13 Q5 用户答"强制要求"；MVP-gap-audit P0 §3.3 | `actions.ts:81/165 ?? null` + `schema.prisma:455 String?`：仍 nullable | 1 commit Schema migration + form validation + zod required（影响 AI 素材质量） |
| **D2** Dashboard 缺 PRD §4.1 三元素 | 工作流 6 步图 / CPI 对比卡 / 30 天 ROI 趋势图 | dashboard/page.tsx 未含 | hardcoded 30min 可补 CPI；6 步图 + 趋势图 ~2-3h（onboarding 价值高） |
| **D3** Weekly Report 真 PDF 导出 | BL-016 backlog；当前 `window.print()` + 打印样式表 | 用户须在打印对话框选 "Save as PDF" | deferred 到反馈触发；BIx F002 已加文案引导 |
| **D4** B4-extended-email-system（webhook / 退订 / 跟踪）未实装 | PRD §11.4 已明确 MVP 不做 | EmailLog 仅记发送状态，无 open/click/reply 事件 | 接客户合规反馈触发，本批次不做 |

---

## 6. 其他未实装功能 / 长尾 backlog（参考，非阻塞）

| ID | 内容 | 优先级 | 触发条件 |
|---|---|---|---|
| BL-021 | Suspense / loading.tsx 边界（11 路由） | medium | 团队反馈感知慢 |
| BL-022 | 列表页虚拟化（4 表） | deferred | 数据量 ≥ 500/tenant |
| BL-023 | KOL 评分体系升级（valueScore engagementScore=15 placeholder + Smart Match 拉宽） | medium | 前置依赖 BIx F004 done |
| BL-014 | ja/ko/es LLM 翻译人工审核 | low | 团队 ja/ko/es native review |
| BL-017 | /shared/weekly-report token 过期 + 撤销 | low | 接外部客户前 |
| BL-018 | 11 页全量 edge states 系统 spot check | low | post-MVP |
| BL-019 | Mobile responsive 11 页 | deferred | 真客户 mobile 需求 |
| BL-026 | 视频脚本投放 B/C 路径（邮件附件 / 单独投放） | deferred | 真客户场景触发 |
| BL-027 | Asset 富文本邮件编辑器（TipTap） | low | plain text + Markdown 不够 |
| BL-003 | /en 和 /en/ 404 | deferred | 自动 / 已 308 跳转覆盖 |
| BL-011 | `/api/kols/[id]` 路由统一 refactor | low | 不影响功能 |
| BL-012 | KOL crawler API 集成 sync worker | deferred | 爬虫团队 ~2026-06-15 交付 |

**Prod DB seed 状态：** 环境文档明确"未"（`environment.md:118`）— 如要给真客户进 demo 流，必须 SSH 跑 `npm run db:seed`（幂等）。但 BL-031 backfill / BL-032 backfill 等已在 prod DB 跑过，说明实际有部分业务数据；建议团队明确 prod DB 当前是"空壳 + backfill" 还是"未 seed"。

---

## 7. MVP DoD §2.1 七步 Journey 终态

| # | 步骤 | 状态 | 阻塞 |
|---|---|---|---|
| 1 | KOL 库筛选 5-10 KOL | ✅ | UI-2 暴露 mock 数据，对外客户前必修 |
| 2 | 创建 Campaign 关联 Product | ✅ | D1 targetAudience 应 required |
| 3 | 加 KOL 到 Campaign + kolFee | ✅ | — |
| 4 | 选模板 + AI 定制邮件 | ✅ | F001 Checkbox 视觉 bug + F004 /zh/assets 中英混杂 + F002 [DATE] 残留 |
| 5 | 录入 Revenue | ✅ | — |
| 6 | ROI 页 / Dashboard 看 ROI% | ✅ | B 时间 toggle ghost / D2 Dashboard 缺元素 |
| 7 | AI 周报一键生成 + PDF | ⚠️ | C 时间 toggle ghost / D3 PDF 仍是 print（可接受） |

**结论：** 7 步 Journey 全部跑得通，**严格 DoD 不被阻塞**；但池子 A+B+C 直接影响"对外客户接触"的产品成熟度感知。

---

## 8. 推荐执行顺序

| 阶段 | 内容 | 估时 | 触发条件 |
|---|---|---|---|
| **N+0** | 完成 BL-033（池子 A 4 项） | ~0.5 day Generator + Reviewer | 当前 building 中 |
| **N+1** | BL-020 安全 mini-batch（池子 B 8 项） | ~0.5-1 day + 1 周 CSP 观察期 | BL-033 done 立即起 |
| **N+2** | BL-024 ghost controls A+B+C（池子 C 必做项） | ~1.5 day + Reviewer | BL-020 done 起 |
| **N+3** | D1 Q5 Product 字段 required + D2 Dashboard 补 3 元素（池子 D） | ~0.5 day | BL-024 done 起 |
| **N+4** | Prod redeploy + 邀请种子用户 | — | N+3 done |

**池子 D 的 D3 / D4 + 长尾 backlog（BL-021/22/23 等）** 等真客户反馈或 PMF 信号触发，不阻塞首批邀请。

---

## 9. 风险提示

1. **prod 当前部署 `c0b3782` ≠ main `b99353c`**：BL-033 修复未上线，prod 用户已连报 Checkbox + /zh/assets 两个问题。**优先级最高：完成 BL-033 + redeploy**。
2. **BL-020 H-S1 SQL 注入兜底单点**：当前依赖 `assertUuid` 防御。若未来任何 caller 跳过该函数直接调 `withTenant(rawId, ...)`，立刻洞开。**对外客户前必修参数化**。
3. **BL-020 H-S2 登录无 rate-limit**：bcrypt cost=12 减缓单点，但并发请求可平行投喂。**对外客户前必修**（@upstash/ratelimit + Redis 已有 .env 配）。
4. **BL-020 UI-2 demo_seed mock KOL**：prod /discovery 12 条 hardcoded mock 暴露给客户。**对外前必加 env-var 过滤**（不能直接删 seed，会拆塌 300 EmailLog + 10 KolCampaign 强引用）。
5. **prod DB seed 状态不明**：environment.md 标"未"，但已跑过 backfill；建议 Planner / 用户明确当前真实数据状态，避免邀请客户后看到混杂数据。

---

**审计完毕。** 18 项明确阻塞 / 偏差全部锁文件 + 行号；3 个 mini-batch（BL-033 / BL-020 / BL-024）已 plan 在 backlog，按推荐顺序执行可在 ~3-4 day 全部清掉。
