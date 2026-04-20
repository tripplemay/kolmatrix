---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BI3-domain-and-tls** — status=**verifying** 7/7 features 完成，移交 Reviewer 验收
  - F001 SSL Labs A+ + HSTS / F002 staging vhost+LE cert / F003 staging app PM2 fork 3002 + 独立 DB kolmatrix_staging / F004 certbot.timer + deploy-hook + dry-run 3 张全绿 / F005 cert-expiry-check.sh + cron 08:00 JST + Resend 告警端到端（FAKE_DAYS=5 已实测发 2 封邮件）/ F006 kolquest.com + www 301 → 主站 / F007 tls-staging-runbook.md 268 行 9 段
- **BI2-deployment-automation** ✅ 已完成签收
- **BI1-test-infrastructure** ✅ 已完成签收
- **B0-foundation** ✅ 已完成签收

## 角色分配（BI3）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 关键决策（详见 docs/adr/）
- ADR-001 Option α infra-first / ADR-002 技术栈最新版 / ADR-003 像素级还原
- ADR-004 F010 12 组件 / ADR-005 §11.2 组件口径 / ADR-006 pre-impl 审计
- ADR-007 RLS / ADR-008 严格手工验收（作废）/ ADR-009 aigcgateway
- ADR-010 kolquest.com 品牌域（redirect + send 子域发件）

## 后续顺序（Option α）
BI3 → B1 KOL Database → B2 AI 评分 + BullMQ → B3 Campaigns → B4 邮件触达 → B5 KOL Discovery → B6+

## Framework 版本
v0.9.2；BI3 待沉淀 1 条 proposed-learning（Resend 发件域根/子域踩坑 — 待 Planner done 阶段处理）

## 设计稿（14 张就绪 V1-V5）
V1-V4 9 张 + V5 5 张入库；V6+ 产品知识库 / 设置 / 团队管理 / 数据源配置 / 竞品分析

## 关键环境提醒
- 生产 DB `kolmatrix`（不是 kolmatrix_prod）
- 生产 URL `https://kol.guangai.ai` — SSL Labs A+ 已实测（F001）
- Staging URL `https://staging.kol.guangai.ai` — PM2 fork / 独立 DB kolmatrix_staging / 噪音防护 X-Robots-Tag noindex
- Resend 发件地址实测为 `marketer@kolquest.com`（环境 md 待 Planner 修正）

## 待团队决策（不阻塞）
- KOL Discovery 产品定义 23 题（B5 前必须定）

## 已知 gap
- Next 16 middleware → proxy 迁移 / ja/ko/es 翻译 / Stitch Variant B/C + V4 冗余 screen 待删
