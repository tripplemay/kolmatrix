# BL-070 Staging Dogfood Spot Check 清单（F008 §5-§9 手动 checklist 实测指引）

> **起草：** 2026-05-20 北京 / Planner johnsong
> **批次：** BL-070-reach-insight-cleanup（Phase 4 第二批 / 项目近期最后一批）
> **F008 阶段：** Generator 域内 7/8 done @ f7eac8d → 切 status=verifying → Evaluator 接管 prod deploy + 12 项 checklist
> **执行者：** Evaluator (Codex Reviewer) + ≥5 marketer dogfood 测试者
> **状态：** Pending — Evaluator 接 verifying 阶段后逐项跑，将结果填入对应表 + 完工时 commit 落 `docs/test-reports/BL-070-signoff-2026-05-19.md` §4 12 项 checklist 表
> **关联：** spec §10 12 项 checklist / Generator handoff（progress.json.generator_handoff）/ scripts/bl070-prod-audit.sh (自动 §1-§4 §10-§12)

---

## §1 自动化项（bl070-prod-audit.sh 已 cover）— Evaluator 直接跑

执行：`ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh'`

| Checklist § | spec §10 # | 验证内容 |
|---|---|---|
| §1 | 1 | 4 路由 active：/en/brief, /en/match, /en/reach, /en/insight → 307→/login |
| §2 | 2 | 7 老路由 404：/en/dashboard, /en/discovery, /en/database, /en/outreach, /en/reports, /en/weekly-report, /en/knowledge-base |
| §3 | 3 | 5 locale × 4 路由 mount sanity（en/zh/ja/ko/es × brief+match+reach+insight = 20 sanity）|
| §4 | 12 | i18n-locale-coverage parity 8/8 PASS / 6 unmount 组件残余 0 / 9 i18n marker 残余 0 / 25 baseline PNG 数 / pm2 logs grep BL-070 errors 0 |
| §10 | 11 | prod /api/health git_sha == BL-070 final commit |
| §11 | 10 | 24h pm2 logs window 验证 0 新增 BL-070-related error（首跑后 24h 复跑）|
| §12 | 4 | cost cap 24h 累计：BL-070 自身 0 incremental cost；audit_log 24h sum cost_usd < $5/day/tenant |

**首跑触发：** prod deploy 完成立即（5min 内）
**24h 复跑触发：** prod deploy 后 24h（§11 pm2 logs window）
**期望结果：** PASS=11+ FAIL=0 WARN≤1（类比 BL-066 F009 prod-audit PASS=11/FAIL=0/WARN=0 标杆）

---

## §2 手动 checklist §5-§9（本 doc 重点）

### §5 — spec §10 #5：4 路由 e2e suite 全 PASS

**执行步骤：**
1. SSH staging 或本地：`gh run list --workflow=ci.yml --branch=main --limit=3 --json conclusion,headSha,databaseId`
2. 找 BL-070 final prod deploy commit 对应的 CI run → check E2E job 状态
3. 若需重跑：`gh run rerun <run-id> --failed-only`
4. 检查 e2e 4 个 spec 全 PASS：
   - `tests/e2e/brief-flow.spec.ts` 6 case
   - `tests/e2e/match-flow.spec.ts` 22 case（合并 BL-066/067/068 e2e）
   - `tests/e2e/reach-flow.spec.ts` 6 case
   - `tests/e2e/insight-flow.spec.ts` 6 case
5. 总 40+ case 全绿

**Acceptance：**

| 检查项 | 期望 | 实测 | 备注 |
|---|---|---|---|
| brief-flow.spec.ts | 6/6 PASS | ☐ | |
| match-flow.spec.ts | 22/22 PASS | ☐ | |
| reach-flow.spec.ts | 6/6 PASS | ☐ | |
| insight-flow.spec.ts | 6/6 PASS | ☐ | |
| Playwright project deps | visual / setup / chromium 全过 | ☐ | |

**失败处置：**
- 任何 case 红 → 看 gh run view --log 找根因
- E2E env 问题（如 AIGCGATEWAY env 缺）→ 沿用 v0.9.22 #12 mock infeasible→dogfood 替代模式（CI 跳 + staging 实测覆盖）
- 实质 bug → 触发 fix-round（progress.json status: verifying → fixing）

---

### §6 — spec §10 #6：视觉 baseline 全 PASS

**执行步骤：**
1. 同 §5 找 BL-070 final prod deploy CI run
2. check visual project 状态（Playwright visual regression）
3. 验 25 baselines 全 lock 新 IA chrome（per F007 generator notes）：
   - 4 路由全：en-brief.png + en-brief-products.png + en-match.png + en-match-with-campaign.png + en-campaign-detail.png + en-campaign-detail-detailed-dialog.png + en-reach.png + en-reach-detail.png + en-reach-templates.png + en-reach-templates-badge.png + en-insight.png + en-insight-reports.png + en-insight-weekly-report.png
   - 通用：dashboard / en-network-status-online
   - landing page 4 baselines（独立任务 ff2d407 commit 落地）
4. 8 老 baseline 已 git rm（per F007）：en-dashboard / en-discovery / en-database / en-outreach / en-reports / en-knowledge-base × 2 / en-campaigns-new

**Acceptance：**

| 检查项 | 期望 | 实测 |
|---|---|---|
| 新 baseline 全 PASS | 25 baselines 全绿 | ☐ |
| 8 老 baseline 已 git rm | grep tests/e2e/visual-regression.spec.ts 0 引用老 baseline | ☐ |
| visual project 一轮过 0 自修 | CI run 直接 PASS | ☐ |

**失败处置：**
- 漂移 > 2% threshold → 评估是真实视觉漂移还是 sub-pixel drift；如 sub-pixel 可调 maxDiffPixels；如真实漂移则触发 fix-round
- baseline 缺失 → 重 trigger `gh workflow run update-visual-baselines.yml`

---

### §7 — spec §10 #7：a11y 扫描 ≥90

**执行步骤：**
1. 用 Chrome DevTools Lighthouse 或 axe-core CLI
2. 4 个 IA 路由各跑 1 次 a11y audit:
   - /en/brief
   - /en/match
   - /en/reach
   - /en/insight
3. 期望 a11y score ≥90 each

**Acceptance：**

| 路由 | a11y score | 期望 ≥90 | 实测 | 主要 issues |
|---|---|---|---|---|
| /en/brief | — | ☐ | | |
| /en/match | — | ☐ | | |
| /en/reach | — | ☐ | | |
| /en/insight | — | ☐ | | |

**常见 a11y issues + 修复：**
- 缺 aria-label：BL-067 F003 已 cover `?` icon aria-label（i18n queryButtonLabel）
- color contrast：dark mode + brand color 容易踩；用 axe-core 报告调
- focus state：input bar + button 必须有 visible focus ring
- alt text：图片 / svg 必须有 alt 或 aria-hidden

**失败处置：**
- score <90 → 修关键项后重测；如非阻断（如 lighthouse 误报）记入 Soft-watch
- 期望 a11y 不阻断对外上线（marketer 内部 demo 不要求 WCAG AA）— Evaluator 自评是否触发 fix-round

---

### §8 — spec §10 #8：Lighthouse 性能 ≥80

**执行步骤：**
1. 同 §7 Lighthouse audit（performance category）
2. 4 IA 路由各跑（推荐 mobile + desktop 两次取 desktop 分数）
3. 期望 perf score ≥80 each

**Acceptance：**

| 路由 | perf score (desktop) | 期望 ≥80 | 实测 | 主要 issues |
|---|---|---|---|---|
| /en/brief | — | ☐ | | |
| /en/match | — | ☐ | | |
| /en/reach | — | ☐ | | |
| /en/insight | — | ☐ | | |

**常见 perf issues + 修复：**
- LCP (Largest Contentful Paint) > 2.5s：images 太大 → lazy load + 优化尺寸
- TBT (Total Blocking Time) > 200ms：JS 太重 → next/dynamic + 拆 chunk
- CLS (Cumulative Layout Shift) > 0.1：image 缺尺寸 → 加 width/height props

**失败处置：**
- score < 80 → 评估关键 metrics 实际影响；marketer 内部 demo 容忍度高
- 期望 perf 不阻断对外上线 — Evaluator 自评

---

### §9 — spec §10 #9：≥5 marketer dogfood spot check（端到端链路）

**核心实测路径**（每 marketer 跑完整 brief → match → reach → insight 4 路由 happy path）：

#### Step 1: /brief — 创建 Campaign

1. 登录 `https://kol.guangai.ai`（prod 或 staging 视 deploy 状态）
2. 进 `/brief`
3. **AI brief input bar 测试**（沿用 BL-069 F003 模式）：
   - 输入示例："Q2 推 PUBG Mobile 给东南亚游戏受众，预算 $10K"
   - 点 Generate → 等 5s 内 LLM 解析 + 表单自动填字段
   - 校对表单：product / markets / budget / dates / target_audience / categories
4. 修改任何字段（per BL-069 不变量 #6 已填字段保留 + AI 建议 diff hint）
5. 点 Submit → 期望 router.push 到 `/match?campaignId=<newId>`

**Acceptance：**

| 检查项 | 期望 | 实测 |
|---|---|---|
| AI brief Generate 成功 (parse rate ≥ 80%) | ☐ | |
| 表单字段自动填 (5+ 字段) | ☐ | |
| Submit 跳 /match?campaignId | ☐ | |

#### Step 2: /match — Campaign 详情页 AI 推荐主面板

1. 自动到达 `/match?campaignId=xxx` → AiRecommendationPanel mount
2. 等 ~30s 内 top 30 KOL 显（BL-067 F005 prewarm worker 已 enqueue 提前生成 short explanation）
3. reload 页面 → 验 cache hit 时显 LLM short（非 C2 占位）
4. **每张卡测试**：
   - 短解释引用 4 维度信号（follower / engagement / category / 内容质量）
   - 卡片右上 '?' icon 可点
   - 点 '?' icon → DetailedExplanationDialog 5 段（matchScore / categoryFit / recentActivity / audienceFit / brandHistory）
5. **Refine 测试**（BL-068 F003）：
   - 顶部 RefineInputBar 输入："减少 micro tier，多加女性受众"
   - 点 Refine → toast 'Reranked: ...' + pool 重排
   - 点 Reset to AI default → pool 回原 valueScore desc
6. **Accept KOL 衔接 Reach**：
   - 点接受 5 个 KOL
   - 验 toast 'View in Reach' CTA（BL-070 F001 新加）
   - 点 CTA → 跳 `/reach/[campaignId]`

**Acceptance：**

| 检查项 | 期望 | 实测 |
|---|---|---|
| top 30 KOL 显 (cache hit short LLM 解释) | ☐ | |
| '?' icon dialog 5 段 | ☐ | |
| Refine 重排成功 | ☐ | |
| Reset to AI default | ☐ | |
| Accept KOL → 'View in Reach' toast | ☐ | |
| 'View in Reach' → /reach/[campaignId] | ☐ | |

#### Step 3: /reach — 触达

1. 到 `/reach/[campaignId]` → 显本 campaign 已接受 KOL 列表
2. 选 1 个 KOL → 邮件 composer
3. **AI 邮件个性化测试**（BL-070 F002 customize.ts 已迁移 runAigcAction SDK）：
   - 点 'Customize email' 或类似按钮
   - 等 LLM 返回个性化邮件 (5s 内)
   - 验邮件内容引用 KOL 数据
4. 编辑邮件 → 调度发送或 dry run

**Acceptance：**

| 检查项 | 期望 | 实测 |
|---|---|---|
| /reach mount + 已接受 KOL 列表 | ☐ | |
| 邮件 composer 可用 | ☐ | |
| AI 邮件个性化（customize.ts → runAigcAction）| ☐ | |
| 邮件 thread / schedule 可用 (out-of-scope BL-070 不动逻辑) | ☐ | |

#### Step 4: /insight — 数据回顾

1. 到 `/insight` → 默认 tab=dashboard
2. **3 tab 切换**（BL-070 F003）：
   - tab=dashboard → KPI cards / activity feed / ROI
   - tab=reports → weekly report list / analytics
   - tab=analytics → analytics 子页
3. URL `?tab=*` state 持久
4. 老 `/dashboard /reports /weekly-report/* /analytics` 4 条 301 redirect 验

**Acceptance：**

| 检查项 | 期望 | 实测 |
|---|---|---|
| /insight default tab=dashboard | ☐ | |
| tab 切换 (dashboard / reports / analytics) | ☐ | |
| 老路由 redirect 301: /dashboard, /reports, /weekly-report, /analytics | ☐ | |

#### Step 5: 5 locale 切换 spot check

每位 marketer 跑完 en 链路后切到其它 4 locale（zh / ja / ko / es）：

1. URL `/zh/brief` → 验 zh i18n cover
2. 任 1 个 KOL `?` icon → 验 detailed dialog 5 段 zh 内容
3. Refine query 用 zh: "减少 micro tier，多加女性受众" → 验 LLM 返 zh feedback

**Acceptance：**

| Locale | brief 表单 | match dialog 5 段 | refine zh query | 备注 |
|---|---|---|---|---|
| zh | ☐ | ☐ | ☐ | |
| ja | ☐ | ☐ | ☐ | |
| ko | ☐ | ☐ | ☐ | |
| es | ☐ | ☐ | ☐ | |

#### 5 marketer 汇总

| Marketer | Step 1 brief | Step 2 match | Step 3 reach | Step 4 insight | Step 5 locale | 0 P0/P1 bug | 备注 |
|---|---|---|---|---|---|---|---|
| 1 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| 2 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| 3 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| 4 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| 5 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |

**Acceptance：** ≥5 marketer 全过 0 P0/P1 bug → §9 PASS

---

## §3 Soft-watch（不阻断 signoff，独立跟踪）

| ID | 内容 | 触发 fix-round 条件 |
|---|---|---|
| S1 | BL-069 24h parse gate 边际通过 80.95% | dogfood 期间观察 cost-audit 输出 parse rate；若 <80% 则 prompt 调优 follow-up batch |
| S2 | a11y score < 90 部分路由 | 评估关键 issue；marketer 内部 demo 不阻断 |
| S3 | Lighthouse perf < 80 部分路由 | 评估关键 metric；marketer 内部 demo 不阻断 |
| S4 | 5 marketer dogfood 找到 P2/P3 bug | 入 Phase 5 backlog 不阻断本批次 signoff |

---

## §4 Signoff 触发条件

**全部 §1-§9 通过 + 12 项 checklist 全 PASS + Soft-watch S1-S4 无升级 → 触发 signoff：**

1. Evaluator 填 `docs/test-reports/BL-070-signoff-2026-05-19.md` §4 12 项 checklist 表 Status 列具体计数
2. 填 §1 时间线（具体 timestamp + run id + audit script PASS/FAIL/WARN）
3. §7 最终签字
4. progress.json `status: verifying → done`
5. features.json F008 status → completed

**触发 fix-round 的条件：**

任意 §5-§9 失败 + 失败属 BL-070 引入回归（非 BL-066/067/068/069 sediment）→ status `verifying → fixing` + Generator 回炉修复 + 复跑相关 spot check + status `fixing → reverifying` → 再走 Reviewer 复验。

---

## References

- `docs/specs/BL-070-reach-insight-cleanup-spec.md` §10 12 项 checklist（spot check 触发条件源）
- `progress.json.generator_handoff`（Generator 域内交付 + Evaluator 接管清单）
- `docs/test-reports/BL-070-signoff-2026-05-19.md`（signoff doc skeleton, Evaluator 终签）
- `scripts/bl070-prod-audit.sh`（自动化 §1-§4 §10-§12）
- `docs/test-reports/BL-066-signoff-2026-05-15.md`（signoff doc 模板参考）
- `docs/test-reports/BL-069-signoff-2026-05-18.md`（signoff doc + cap simulation 模式参考）
- `framework/archive/proposed-learnings-archive-v0.9.22.md`（v0.9.22 13 条沉淀 + 待写 12 段 framework/harness/*.md）
