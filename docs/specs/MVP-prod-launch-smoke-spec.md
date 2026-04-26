---
name: MVP-prod-launch-smoke
description: MVP 上线前 prod L2 烟测 micro-batch（从 MVP-seed-demo-prep F004 拆出独立批次）
status: draft
created_by: Kimi (Planner)
created_at: 2026-04-27
estimated_effort: ~1 day（micro-batch）
prerequisites:
  - MVP-visual-fidelity-hotfix done + signoff 入 git
  - 用户手动触发 prod deploy（GitHub Actions workflow_dispatch）
  - prod deploy 成功 + git_sha 验证
---

# MVP-prod-launch-smoke — Prod L2 烟测 micro-batch

## 1. 背景与目标

从 `MVP-seed-demo-prep-spec.md` F004 拆出的独立 micro-batch。理由：

- **解耦**：prod L2 烟测不依赖 demo prep（F001-F003 demo 准备工作）；prod deploy 成功后立即可跑
- **早发现问题**：如 prod 烟测发现 P0/P1 阻断，直接进 fixing 流程，不连累 demo prep 进度
- **平行执行**：demo prep（Generator）和 prod 烟测（Reviewer）可同时进行，缩短 MVP 上线总时长 ~2 day

## 2. 范围

### In Scope（2 features）

1. **F001** — Prod L2 烟测清单起草（Planner）
2. **F002** — Reviewer 在 prod 执行清单 + 出 signoff 报告

### Out of Scope

- 自动化 prod E2E（已有 staging E2E 覆盖；prod 烟测以手动 + 自动化 spot check 混合）
- 性能压测（独立 ops 任务，B5+）
- 安全扫描（独立 sec batch）

## 3. 关键设计决策

| 决策 | 选定方案 | 理由 |
|---|---|---|
| 烟测分工 | **F001 Planner 起草 + F002 Reviewer 执行** | 同 BM2-L2-staging-checklist 模式 |
| 自动化范围 | **Reviewer 用 codex-e2e + Playwright 跑 staging suite 但 base-url 切到 prod** | 复用已有 spec，不重写 |
| 邮件真发限制 | **仅 1 封测试邮件到 marketer 自己 email，禁止给真实 KOL 发** | 避免污染真实数据 |
| AI Action 真调 | **2 次：1 次 outreach AI 定制 + 1 次 weekly-report 生成** | 验证 aigcgateway prod 链路；消耗 ~$0.05 |
| 视觉验证 | **Reviewer 浏览器并排 prod vs Stitch HTML 5 页**（hotfix 后视觉应达 ≥9/10） | 沿用 hotfix L2 验收标准 |
| 失败处理 | **任何 P0/P1 → 立即 status=fixing + Generator hotfix；P2/P3 → backlog 不阻塞 demo 上线** | 严格分级，避免无限 polish |
| 报告路径 | `docs/test-reports/MVP-prod-launch-signoff-<date>.md` | 同 signoff 命名约定 |

## 4. 功能列表

### F001 — Prod L2 烟测清单起草

**实现：** Planner 起草 `docs/test-cases/MVP-prod-launch-smoke-checklist.md`，参照 `BM2-L2-staging-checklist-2026-04-26.md` 格式 + 升级到 prod 场景。

**清单内容（≥ 30 条 checkbox）：**

#### A. 健康基线（5 条）
- [ ] `curl https://kol.guangai.ai/api/health` 返回 200 + status=healthy
- [ ] git_sha 字段不是 "unknown"（如是 unknown 说明 BL-002 仍未修，不阻塞但记录）
- [ ] DB latency_ms < 500
- [ ] redis check status=stub（B5 才上 BullMQ）
- [ ] uptime_seconds > 60（确认 deploy 后服务稳定）

#### B. 公开 endpoint smoke（5 条）
- [ ] `/en/login` 200
- [ ] 6 个受保护路由 `/en/{discovery,campaigns,outreach,crm,roi,weekly-report}` 全部 307 → `/en/login`
- [ ] `/shared/weekly-report/invalid-token` 404
- [ ] `/api/health` 公开可访问无 auth
- [ ] kolquest.com 301 → kol.guangai.ai（BI3 brand redirect）

#### C. 登录态功能验收（同 BM2 L2 staging 11 features）
- [ ] F001 schema：`/en/database` 加载 KOL 表显示
- [ ] F002 EmailTemplate：`/en/outreach` 模板下拉显示 5 en + 切 zh 显示 5 zh = 10 模板
- [ ] F003 /campaigns 列表：3 seed campaigns 显示 + filter status=active 生效
- [ ] F004 /campaigns/new：必填校验 + 提交跳转
- [ ] F005 /campaigns/:id 详情：Header 4 KPI + Add KOL modal + contactStatus dropdown
- [ ] F006 /outreach AI 定制：调 aigcgateway Action kol-email-customize + 显示 AI 版
- [ ] F006 邮件真发：发 1 封到 marketer 测试邮箱（禁止给真实 KOL）
- [ ] F007 /crm overview：6 卡阶段分布 + 漏斗 + 合作总额 + 关系变化表
- [ ] F008 ROI API：GET /api/roi/{summary,trend,campaigns} 全部 200
- [ ] F009 /roi 页：4 KPI 卡 + 趋势图 + AI Insights 点击调 aigcgateway gemini-3-flash
- [ ] F010 /weekly-report：生成 + PDF 导出 + 分享链接 + 隐身浏览器匿名访问

#### D. 跨租户隔离（3 条）
- [ ] 浏览器 A marketer 登 tenantA → 浏览器 B admin 登（同 tenant 跳过；如新建 demo tenant 则验证看不到 A 数据）
- [ ] 隐身请求 GET /api/campaigns 无 cookie → 401/307
- [ ] 隐身访问 prod 任意受保护路由 → 307 redirect

#### E. 视觉还原度（5 条，hotfix 后基线）
- [ ] /en/discovery vs Stitch kol-discovery.html 浏览器并排 ≥ 9/10
- [ ] /en/database vs kol-database.html ≥ 9/10
- [ ] /en/campaigns vs campaigns-list.html ≥ 9/10
- [ ] /en/campaigns/:id vs campaign-detail.html ≥ 9/10
- [ ] /en/kols/[id] vs kol-detail.html ≥ 9/10

#### F. 性能基线（4 条，可选）
- [ ] lighthouse perf score ≥ 70（5 个核心页平均）
- [ ] LCP < 2.5s（Largest Contentful Paint）
- [ ] FID < 100ms（First Input Delay）
- [ ] CLS < 0.1（Cumulative Layout Shift）

#### G. 自动化（5 条）
- [ ] codex-e2e 跑 prod base-url：bm1-flow + journey-a + journey-b + marketer-dashboard 4 spec PASS
- [ ] visual-regression 在 prod 跑（如 darwin 本机则 platform skip 可接受）
- [ ] tests/integration 在本地跑通（不在 prod 跑）
- [ ] tests/unit 在本地跑通
- [ ] CI run（main HEAD）全绿确认

**Acceptance：**
- 清单 ≥ 30 条 checkbox
- 每条含 URL + 期望响应 + 失败信号
- 视觉差异条目明确"≥ 9/10"评级标准

### F002 — Reviewer 执行 + signoff

**实现：** Reviewer 按清单逐条执行，写 `docs/test-reports/MVP-prod-launch-signoff-2026-MM-DD.md`。

**Acceptance：**
- 全部 A-G 清单勾选
- 任何 P0/P1 阻断 → 立即写 evaluator_feedback + status=fixing
- P2/P3 残余风险 → 写 backlog 注明 priority 不阻塞
- 报告 ≥ 50 行，含烟测命令 + 截图 + 数据
- signoff 中明示"prod 可承接种子用户邀请"或"建议先 hotfix"

## 5. 依赖关系

```
hotfix done → 用户触发 prod deploy → Reviewer L2 烟测（本批次）→ signoff PASS → demo 邀请发送
                                          │
                                          └── 如 FAIL → fixing → Generator → reverifying → 重跑
```

## 6. 风险与对策

| 风险 | 严重度 | 对策 |
|---|---|---|
| prod 与 staging 行为漂移（BL-013 修复后 staging 绿但 prod 漂移） | 中 | F002 全程对照 staging L2 报告（BM2-l2-staging-reverifying-2026-04-26.md），任何差异即记录 |
| AI Action prod key 限流 / 余额耗尽 | 低 | F002 启动前检查 aigcgateway 余额 ≥ $30 |
| 真发邮件意外发到真实 KOL | 高 | F002 acceptance 强调"仅 1 封到 marketer 自己" + Reviewer 二次确认 |
| 视觉评级主观分歧 | 中 | F002 ≥ 9/10 标准 + Reviewer 截图对比 + 用户最终复核 |

## 7. 验收方式（Evaluator 阶段）

按状态机：本批次启动 = `verifying` 阶段（无 building，因 F001 是 Planner 工作 + F002 是 Reviewer 工作）

实际状态流转：`new → planning → verifying → done`（无 building，因为 F001 起草不算代码 + F002 是 evaluator 工作）

**等等** — 状态机要求「全部 executor:codex 时跳过 building 直接 verifying」。本批次 F001 executor 该是 planner（spec 起草）还是 codex？按规则：
- 如果 F001 标 executor=codex（让 Reviewer 起草清单 + 执行）→ 整批次跳 building 直接 verifying
- 如果 F001 是 Planner 工作（不属 generator 也不属 codex）→ 算 spec 起草，不进 features.json
- **决策：** F001 由 Planner 在 planning 阶段起草（不入 features.json）；F002 单条入 features.json，executor=codex → 批次跳 building 直接 verifying

修订 features 列表：
- ~~F001 Planner 起草清单~~ → 移到 planning 阶段产出
- F001 Reviewer 执行清单 + signoff（executor=codex）

## 8. 估时

| 环节 | 预估 | 执行者 |
|---|---|---|
| Planner 起草清单（planning 阶段） | ~1h | Planner |
| Reviewer 执行清单 + signoff | ~3-4h | Reviewer |
| 缓冲 + 反复 | ~1h | — |
| **总计** | **~半天** | — |

## 9. 与 MVP 上线时间线

| 节点 | 预估 |
|---|---|
| MVP-visual-fidelity-hotfix done | ~2026-05-02 |
| 用户触发 prod deploy（含 hotfix） | 2026-05-02 |
| **MVP-prod-launch-smoke 启动**（本批次，与 demo-prep 平行） | 2026-05-02 |
| MVP-prod-launch-smoke done | 2026-05-02（半天）|
| MVP-seed-demo-prep done | ~2026-05-05（demo prep 4 features） |
| 首批种子用户邀请发出 | 2026-05-05 |

**关键：本批次 done 是 demo 发邀请的硬前提**（prod 没烟测过不能发邀请）

## 10. 引用文档

- `docs/test-cases/BM2-L2-staging-checklist-2026-04-26.md`（参照清单格式）
- `docs/test-reports/BM2-campaign-outreach-roi-l2-staging-reverifying-2026-04-26.md`（staging 对照基线）
- `docs/specs/MVP-seed-demo-prep-spec.md`（关联 demo prep 批次，本批次拆出来源）
- `.auto-memory/environment.md`（prod URL + 测试账号 + aigcgateway key）

## 11. 启动检查清单

- [ ] hotfix done + signoff
- [ ] 用户触发 prod deploy 完成
- [ ] prod /api/health 200 验证
- [ ] aigcgateway 余额 ≥ $30

---

**Spec 状态：** 用户决策 #5 "按你的建议执行" 已确认拆为独立 micro-batch（2026-04-27 Planner 决策落地）

**与 MVP-seed-demo-prep 关系：** 本批次拆自原 F004，原 spec F004 已删除，原 spec features 数从 5 改为 4
