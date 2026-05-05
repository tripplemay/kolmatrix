---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-024 B4 ghost-controls 实装 mini-batch — BUILDING（spec lock @ 2026-05-05 22:45）
- 5/5 全 generator pending：F002 /roi 时间 toggle (7D/30D/90D/All-time) — 先做（BIx F001 范式）/ F003 /weekly-report Last Week+Last Month toggle（28-day 窗口聚合）/ F001 /database 头 3 按钮（Export CSV 复用 /api/crm/export-csv + Import CSV 新模块 + Add KOL form）/ F004 /outreach/tracking 列表（BL-035 F006 EmailLog.status 复用）/ F005 /outreach/suppression 列表（BL-035 F006 audit_log+Kol.email=null 复用）
- 用户 2026-05-05 22:30 决议方案 B：A+B+C+D-2+D-3 = 5 features；D-1 Send Queue 推 BL-040+ 与 BullMQ 实装合批；E /knowledge-base Import CSV defer 真客户反馈；F /database BulkDelete 推 B6 destructive 完整批次
- spec：docs/specs/BL-024-ghost-controls-cleanup-spec.md（D1-D8 决策 + §5 v0.9.11/v0.9.12 dogfood + §6.1 2 项 user 手工待办 + §7 推荐顺序 F002 → F003 → F001-1 → F001-2 → F001-3 → F004 → F005）
- 来源：Planner 2026-05-02 prod 排查（基线 6f33a55）+ prod-mvp-readiness audit 2026-05-04 §4 排定
- 预估 2.5 day building + 0.5 day verifying
## ✅ BL-035 后端 HIGH + UX + AI 服务端协调 — DONE 2026-05-05 ~22:30（first-round PASS @ c9cfed3，fix_rounds=0）
- 13/13 PASS + signoff（6 项 Soft-watch S1-S6 全有兜底）；详见 docs/test-reports/BL-035-...-signoff-2026-05-05.md
## ✅ BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 — DONE 2026-05-05
## ✅ BL-033 / BL-032 / BL-031 / BL-030 / BL-027 / BL-025 / BL-026 — DONE 2026-05-03~04
## 用户手工待办（按优先级）
1. **BL-035 + BL-034 + BL-020 prod redeploy 大合并**：SSH prod 写 8 个 env vars（KOLMATRIX_APP_PASSWORD / HEALTH_DETAIL_TOKEN / AI_DAILY_COST_USD_PER_TENANT_MAX=5.00 / RESEND_WEBHOOK_SECRET / EMAIL_MOCK_VERBOSE=false / DISABLE_AI_RATELIMIT 留空 / DISABLE_BATCH_RATELIMIT 留空 / HIDE_DEMO_SEED_KOLS=true）→ Resend Dashboard 配 webhook URL + svix secret → VPS crontab 加 redact-old-email-logs.ts daily → GH Actions Deploy → 浏览器+endpoint 验证
2. **aigcgateway 控制台 7 Action template 改**（BL-035 S5）：用 mcp__aigc-gateway create_action_version + activate_version 按 inventory `docs/specs/BL-035-F013-actions-run-inventory.md` 改 max_tokens + system prompt untrusted clause
3. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期**：观察期满后用户驱动 prod redeploy
4. **BL-035 F005/F008/F013 + F006 prod 真测**（S1-S4）：第 2 个 tenant 启用 + outreach composer ≥9 KOL + aigcgateway logs 抽样 + 测试邮件 hard bounce
5. **BL-034 F005 cost-cap event_log staging 实测** + **Pokemon Go 邮件模板 v1 prod 浏览器验证**（继承）
6. **BL-024 done 后 prod redeploy 浏览器 5 处 walk**（spec §6.1）：/zh/database 头 3 按钮 + /zh/roi 4 range / /zh/weekly-report 2 range Last Month 数据 / /zh/outreach/tracking + /zh/outreach/suppression 列表
7. ~2026-05-09 BIx F004 staging YouTube sync 走查 + BL-034 unused import 2 个下批次顺手清（BL-035 S6 已落 BL-024 顺手清空间）
## 关键决议（已 lock）
- BL-024 D1-D8 + 用户 2026-05-05 22:30 方案 B（A+B+C+D-2+D-3 5 features）
- BL-035 / BL-034 / BL-020 / v0.9.11 / v0.9.12 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 18 条（已扣 BL-024；剩 BL-040+BL-041 / BL-012 crawler-sync / BL-014/15/16 post-MVP / BL-022 / BL-021 等）
- 时间线：05-05~07 BL-024 (现) → 05-08~10 BL-040+BL-041 → 05-11~12 BL-012 / BL-021 (post-MVP buffer) → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
