---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BI3-domain-and-tls** ✅ 已完成签收（status=done，7/7 PASS）
  - 生产/品牌域 SSL Labs A+（kol.guangai.ai / kolquest.com）
  - staging HTTPS + 独立 PM2 fork（3002）+ 独立 DB `kolmatrix_staging`
  - certbot.timer + deploy hook + 到期告警 cron 脚本验证完成
  - runbook staging DB reset 实操通过（kols=12, users=2）
  - signoff: `docs/test-reports/BI3-domain-and-tls-signoff-2026-04-20.md`
- **BI2-deployment-automation** ✅ 已签收
- **BI1-test-infrastructure** ✅ 已签收
- **B0-foundation** ✅ 已签收

## 角色分配（BI3）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 后续顺序（Option α）
- B1 KOL Database → B2 AI 评分 + BullMQ → B3 Campaigns → B4 邮件触达 → B5 KOL Discovery

## 关键环境提醒
- 生产 DB 固定名：`kolmatrix`
- staging DB：`kolmatrix_staging`
- 待用户补全：`AIGCGATEWAY_API_KEY`（B2 前）、`RESEND_API_KEY`（B4 前）

## 已知非阻塞项
- Next 16 `middleware.ts` → `proxy.ts` 迁移待后续
- ja/ko/es 文案待翻译
