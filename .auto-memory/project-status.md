---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BI2-deployment-automation** — status=reverifying, fix_rounds=1。8/8 代码 + VPS bootstrap + 3 个 runtime fix（3c418bc/a6b1fd0/0a382f4）全部就位。
  - 实测 VPS：/api/health 200 healthy，/login 200 Sign in，未登录 /en/dashboard 307→/login ✓
  - Prod DB seed 已跑（2026-04-20 Planner 执行）：1 tenant + admin/Sarah Chen + 12 KOLs + 3 campaigns + 4 templates + 300 emailLogs
  - DB 命名 spec 坑 Planner 裁决方案 A（接受固定名 `kolmatrix`）：environment.md / architecture.md / BI2 spec / infrastructure.md / runbook 文案全对齐
  - 仍 TBD：用户再触发 1 次 deploy-prod.yml 让 .git_sha 从 'unknown' 变真；AIGCGATEWAY_API_KEY / RESEND_API_KEY 填真值（B2/B4 前）
  - VPS 详细快照见 .auto-memory/environment.md；Reviewer round 2 执行清单见 progress.json.generator_handoff
- **BI1-test-infrastructure** ✅ 已完成签收（10/10 + Round 1 fix + reverify 通过，framework v0.9.1 沉淀）
- **B0-foundation** ✅ 已完成签收（10/10 + 12 PASS 0 FAIL，Round 3 reverify 通过）

## 角色分配（BI2，沿用 B0/BI1）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## BI1 10 features 执行顺序（强制）
F001 Vitest → F002 Testcontainers → F003 Playwright → F004 MSW → F005 Fixtures →
F006 B0 unit tests → F007 B0 RLS+Auth integration → F008 marketer E2E →
F009 视觉回归基线 → F010 CI 4 新 jobs

## 关键决策（详见 docs/adr/）
- ADR-001 Option α infra-first / ADR-002 技术栈最新版 / ADR-003 像素级还原 ±2px/ΔE<2
- ADR-004 F010 12 组件锁定 / ADR-005 §11.2 组件接入口径 / ADR-006 pre-impl 审计模式
- ADR-007 多租户 RLS 策略 / ADR-008 严格手工验收（BI1 后作废）
- ADR-009 aigcgateway 集成（@guangai/aigc-sdk + 3 档模型 + Action prompt + $100/月）
- ADR-010 kolquest.com 品牌域（redirect + send 子域发件，DNS 已配完 2026-04-19）

## 后续顺序（已锁定 Option α）
BI1 → BI2 部署自动化 → BI3 域名 TLS + Staging → B1 KOL Database → B2+

## 设计稿状态（9 张就绪：V1-V4）
V1-V3：Dashboard / KOL Discovery / KOL Detail / Campaigns 列表 / Campaign 详情 / KOL Database / Email Center
V4：Client Review（客户协同筛选，B3）+ Email Tracking 详情（B4）
产品知识库推迟至 V5；design-draft/stitch-references/ HTML + PNG 全部入库

## 待团队决策（不阻塞 BI1-BI3）
- **KOL Discovery 产品定义** —— 澄清文档 `docs/product/kol-discovery-clarification.md` 23 题待团队会议决定（B5 前必须完成；决策后触发 B1/B3/B5 spec 调整 + ADR-011 AI Match）

## 已知 gap（非阻塞）
- Next 16 middleware.ts → proxy.ts 迁移留给后续批次
- ja/ko/es messages 未翻译待译员
- Stitch Variant B/C 项目（`9900459935539855080` / `7841901791452897882`）需手动删除
- Resend Dashboard 点 Verify（用户动作，5 分钟）+ CF token 手动 revoke

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
