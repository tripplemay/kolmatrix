---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BI2-deployment-automation** — status=fixing（F002 等 Planner 重裁决 B1/B2/C；F006/F008 待 Reviewer 演练）
  - F002 方案 A（spec §2.1 instances=2 + `npm start`）2026-04-20 下午上 VPS 实测两轮：Round A EADDRINUSE crash loop 116×；Round A'（script: next 直连）56/60（93%）仍差 4×000。详见 `docs/specs/BI2-f002-round2-adjudication.md`，Kimi 以短格式回 #1:B1/B2/C 裁决。
  - VPS 此刻：两 worker id 8/9 restart=2 均 online；公网 non-reload 100% 200；pm2 save 已锁双实例态。**不要手动 `pm2 start ecosystem.config.js`**，reload 仍有丢包窗口。
  - Prod DB seed 已跑：1 tenant + admin/Sarah + 12 KOL + 3 campaigns + 4 templates + 300 emailLogs
  - DB 命名方案 A 对齐完毕（`kolmatrix`）
  - 仍 TBD：AIGCGATEWAY_API_KEY / RESEND_API_KEY（B2/B4 前）
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
