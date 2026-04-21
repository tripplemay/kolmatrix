---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BAux1-auth-pages** — status=building，4 features 等 Generator 开工（B1 前辅助批次）
  - F001 AccessRequest DB + F002 登录页 UI 重写（可并行）→ F003 请求访问页面 → F004 测试
  - Hero 图已入库 `public/brand/login-hero.png` + `signup-hero.png`（gpt-image 1024×1024 无水印）
  - Planner 同步进 B1 planning 准备
- **Option α infra-first 已收官** ✅ BAux1 后进 B1 KOL Database 业务批次
- **BI3-domain-and-tls** ✅ 已完成签收（7/7 PASS, fix_rounds=0 一轮过）
  - 生产/品牌域 SSL Labs A+（kol.guangai.ai / kolquest.com）
  - staging HTTPS + 独立 PM2 fork(3002) + 独立 DB `kolmatrix_staging`
  - certbot.timer + deploy hook + 到期告警 cron 全验证通过
  - runbook staging DB reset 实操通过（kols=12, users=2）
- **BI2-deployment-automation** ✅ 已签收（8/8 zero-downtime + 自动回滚 + prod bootstrap）
- **BI1-test-infrastructure** ✅ 已签收（framework v0.9.1 沉淀）
- **B0-foundation** ✅ 已签收

## 角色分配（BAux1，沿用）
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
