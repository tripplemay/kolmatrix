---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BM1-console-kol-core** — status=building，9 features 等 Generator 开工（MVP 业务批次 1/2）
  - F001 schema → F002 seed → F003 知识库 / F004 Discovery 并行 → F005 Database → F006 画像 → F007 Dashboard → F008 locale → F009 tests
  - 估 7-10 天，完成后 MVP 4 功能达成 2 个（控制台 + 筛选）
- **BI4** ✅ done 一轮过（5/5 PASS fix_rounds=0，framework v0.9.3 沉淀 VPS artifact in-git 硬要求）
- 所有前置批次 ✅：B0 / BI1 / BI2 / BI3 / BAux1 / BI4

## MVP 现状
- PRD v1.0 + §13 8 答复全锁
- Stitch 设计稿 18 张（V1-V7 全）
- KOL seed 415 gaming + 2109 non-gaming 入库 JSON（$0.91 成本）
- Prod 已上 `4b05cb6`（BAux1 + BI4 F001/F002/F004）
- Framework v0.9.3（deploy-patterns §2 VPS artifact in-git 必检）

## 角色分配（BM1，沿用）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## MVP 路线（32-37 天总目标）
BAux1 ✅ → BI4 ✅ → **BM1（9f 7-10 天）** → BM2（~13f 10-14 天）→ MVP demo → 种子用户反馈

## 关键决策（详见 MVP PRD §11）
- Product USP 必填 / Google OAuth disabled / AI 走 aigcgateway Action（BM2 用）
- AI 匹配分不做 MVP（字段保留）/ KOL 价值分用简单公式
- 15 维 filter schema 前置 + UI 空态友好提示
- Browser locale detection auto / AI 周报给客户看 PDF+share link

## Planner 并行动作（BM1 building 期间）
- 起草 BM2 spec（Campaign + 联系 + CRM + ROI + AI 周报，~13 features）
- 创建 aigcgateway 3 Action：kol-email-customize / roi-insights / weekly-report-for-client

## 环境
- 生产 DB `kolmatrix` / staging `kolmatrix_staging`
- Resend 发件 `marketer@kolquest.com`
- aigcgateway `https://aigc.guangai.ai/v1`
