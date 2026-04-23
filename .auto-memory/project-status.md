---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BM1-console-kol-core** — status=**reverifying**（fix_rounds=1 done，交 Reviewer 复验 L1+L2）
  - Round 1 fix: loginAction locale-prefixed redirect + 去 `networkidle` 等待 + KPI 断言放宽 + saved row 15s timeout
  - Staging E2E 5/5 已过 + CI 全 8 job 绿
  - F009 visual baseline 仍留 Reviewer 在 linux runner 上 `--update-snapshots` 解锁
  - pre-impl 审计 `docs/specs/BM1-f001-schema-preimpl-audit.md` 裁决 #A:A #B:A #C:A #D:A+C #E:C #F:A（#E 偏离 Gen，归一化 0-100）
- **BI4** ✅ done 一轮过（5/5 PASS fix_rounds=0，framework v0.9.3 沉淀 VPS artifact in-git 硬要求）
- 所有前置批次 ✅：B0 / BI1 / BI2 / BI3 / BAux1 / BI4

## MVP 现状
- PRD v1.0 + §13 8 答复全锁
- Stitch 设计稿 18 张（V1-V7 全）
- KOL seed 415 gaming + 2109 non-gaming 入库 JSON（$0.91 成本）
- Prod 已上 `4b05cb6`（BAux1 + BI4 F001/F002/F004）
- Framework v0.9.3（deploy-patterns §2 VPS artifact in-git 必检）

## 角色分配（BM1）
- Planner: johnsong（2026-04-23 接手 Kimi）/ Generator: johnsong / Evaluator: Reviewer

## MVP 路线（32-37 天总目标）
BAux1 ✅ → BI4 ✅ → **BM1（9f 7-10 天）** → BM2（~13f 10-14 天）→ MVP demo → 种子用户反馈

## 关键决策（详见 MVP PRD §11）
- Product USP 必填 / Google OAuth disabled / AI 走 aigcgateway Action（BM2 用）
- AI 匹配分不做 MVP（字段保留）/ KOL 价值分用简单公式
- 15 维 filter schema 前置 + UI 空态友好提示
- Browser locale detection auto / AI 周报给客户看 PDF+share link
- **BM1/BM2 L2 验收强制走 staging**（2026-04-23 用户决议，偏离 BAux1/BI4 L1-only 实践）

## Planner 并行动作（BM1 building 期间）
- ✅ BM2 spec 起草完（11 features，commit `cbdc7ec`，`docs/specs/BM2-campaign-outreach-roi-spec.md`）
- ✅ aigcgateway 3 Action 已建 + dry_run + real call 验证：
  - `kol-email-customize` cmob2z6j00001bnole7i8lg9h (claude-haiku-4.5)
  - `roi-insights` cmob2zgae000jbnnuue2i7uaf (gemini-3-flash)
  - `weekly-report-for-client` cmob2zqkp0001bnnvel4vjapu (gemini-3-flash)
- ⏳ 待命处理 Generator F004+ pre-impl 审计请求（F003 一轮落地无审计）

## 环境
- 生产 DB `kolmatrix` / staging `kolmatrix_staging`
- Resend 发件 `marketer@kolquest.com`
- aigcgateway `https://aigc.guangai.ai/v1`
