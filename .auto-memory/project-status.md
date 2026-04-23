---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BI4-architectural-guardrails** — status=building，5 features 等 Generator 开工
  - F001 Job Queue interface / F002 event_log / F003 audit_log / F004 Cursor pagination / F005 KOL tsvector
  - 全独立 infra，~2-3 天；完成后 BM1/BM2 直接调用这些基建
- **BAux1-auth-pages** ✅ 已签收（4/4 PASS, fix_rounds=3, 2026-04-23）
- 所有前置批次 ✅：B0 · BI1 · BI2 · BI3 · BAux1

## 当前阶段：MVP 纵向路线（2026-04-21 pivot）
- MVP PRD v1.0 已写 + 用户答 §13 8 问（`docs/product/KOLMatrix-MVP-PRD.md`）
- KOL seed 415 gaming 入库（$0.91 两阶段 AI 打标）
- Stitch 设计稿 18 张入库（V1-V7 全就绪；2026-04-23 V6 ROI + V7 3 张新入库）

## 角色分配（BI4，沿用）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 后续 MVP 路线（32-37 天总目标）
BAux1 ✅ → **BI4 架构护栏**（5 features, 2-3 天）→ BM1 控制台+KOL核心(~9f, 7-10 天) → BM2 Campaign+联系+CRM+ROI+周报(~13f, 10-14 天) → MVP 上线 → 种子用户反馈

## 关键决策（详见 docs/adr/ 和 MVP PRD §11）
- ADR-001~010 基建；MVP §11 8 条业务决策（Google OAuth disabled / AI 走 aigcgateway Action / AI 周报给客户看 / Product USP 必填 / 浏览器语言自动跳 等）

## Framework
v0.9.2（BI2 DB 命名 + PM2 zero-downtime 3 条件）；BAux1 round 3 经验暂未沉淀（无新通用规律）

## 待补（非阻塞）
- MOBA/二次元/沙盒 KOL 数据（MVP demo 类目稀疏）
- aigcgateway 3 个 Action 待建：kol-email-customize / roi-insights / weekly-report-for-client（Planner 在 BM1 期间做）

## 环境
- 生产 DB `kolmatrix`（非 kolmatrix_prod）/ staging DB `kolmatrix_staging`
- Resend 发件 `marketer@kolquest.com` 根域
