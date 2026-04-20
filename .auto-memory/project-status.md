---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BI3-domain-and-tls** — status=building，7 features 等 Generator 开工
  - 执行顺序：F001 prod HTTPS 审计+conf 入库 → F002 staging 子域 → F003 staging app 进程 → F004 cert auto-renew → F005 续期失败告警 → F006 kolquest.com 301 → F007 runbook+Nginx conf 入库
  - 前置条件：.env.staging 已在 VPS `/opt/kolmatrix-staging-init/` 生成（Planner 预备）；DNS A 记录 staging.kol.guangai.ai 由用户去加
- **BI2-deployment-automation** ✅ 已完成签收（8/8 PASS，fix_rounds=2，zero-downtime + 自动回滚 + prod bootstrap 全闭环）
- **BI1-test-infrastructure** ✅ 已完成签收（framework v0.9.1 沉淀）
- **B0-foundation** ✅ 已完成签收

## 角色分配（BI3，沿用）
- Planner: Kimi / Generator: johnsong / Evaluator: Reviewer

## 关键决策（详见 docs/adr/）
- ADR-001 Option α infra-first / ADR-002 技术栈最新版 / ADR-003 像素级还原 ±2px/ΔE<2
- ADR-004 F010 12 组件锁定 / ADR-005 §11.2 组件接入口径 / ADR-006 pre-impl 审计模式
- ADR-007 多租户 RLS 策略 / ADR-008 严格手工验收（BI1 后作废）
- ADR-009 aigcgateway 集成（@guangai/aigc-sdk + 3 档模型 + Action prompt + $100/月）
- ADR-010 kolquest.com 品牌域（redirect + send 子域发件，DNS 已配完 2026-04-19）

## 后续顺序（Option α 已锁定）
BI3 → B1 KOL Database → B2 AI 评分 + BullMQ → B3 Campaigns → B4 邮件触达 → B5 KOL Discovery → B6+

## Framework 版本
v0.9.2 — BI2 done 沉淀 2 条 learnings：database-patterns §2 DB 命名 migration-consistency + deploy-patterns §1 PM2 zero-downtime 3 条件

## 设计稿状态（9 张就绪 V1-V4）
Dashboard / KOL Discovery / KOL Detail / Campaigns 列表+详情 / KOL Database / Email Center / Client Review / Email Tracking
V5 批次 5 张待生成（登录 v2 游戏氛围版 / 注册 v2 / 邮件模板编辑器 / 发送队列 / 退订管理），prompt 就绪 `design-draft/stitch-references/V5-prompts.md`

## 关键环境提醒
- 生产数据库固定名 `kolmatrix`（不是 `kolmatrix_prod` —— BI2 DB 命名裁决方案 A）
- 生产 URL `https://kol.guangai.ai` 已 HTTPS（BI2 bootstrap），SSL Labs A+ 待 BI3-F001 验证
- .env.production 已含真实 AIGCGATEWAY_API_KEY + RESEND_API_KEY（2026-04-20 用户提供）

## 待团队决策（不阻塞 BI3）
- KOL Discovery 产品定义 — `docs/product/kol-discovery-clarification.md` 23 题（B5 前必须定）

## 已知 gap（非阻塞）
- Next 16 middleware.ts → proxy.ts 迁移待后续批次
- ja/ko/es 多语言文案待翻译
- Stitch Variant B/C 项目（`9900459935539855080` / `7841901791452897882`）需手动删除
- Stitch V4 压缩冗余 screen `219e3547` / `46df7ce5` / `d3f92c57` 待手动删除

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
