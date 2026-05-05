---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-035 后端 HIGH + UX + AI 服务端协调 — DONE 2026-05-05 ~22:30（first-round PASS @ c9cfed3，fix_rounds=0）
- 13/13 PASS：F010 fetchWithRetry 共享 + jitter / F003 AI rate-limit 6 endpoint（10/min/tenantId + 100/day; 20/min/userId for sendBatch）/ F009 kol_campaign 索引 / F012 paginator nulls 修饰符（discovery mock 沉底，用户报告闭环）/ F004 createShareToken 服务端 origin / F005 product ownership preflight / F001 password min(12) + seed 升级 / F002 withPlatformAdmin 收紧 / F008 sendBatch 50→8 + 60s timeout / F011 dead code 删 / F013 actions/run wrap + inventory / F007 PII 脱敏 + EmailLog 30d retention / F006 Resend webhook svix 验签
- L2 Codex staging 6 项端到端实证（详 docs/test-reports/BL-035-verifying-2026-05-05.md）+ Planner 临时担任 evaluator 写完整 signoff（用户 2026-05-05 ~22:30 授权方案 A，与 BL-020/BL-034 同模式）
- signoff: docs/test-reports/BL-035-backend-high-and-ux-and-aigc-actions-signoff-2026-05-05.md（6 项 Soft-watch S1-S6 全有兜底）
## ✅ BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 — DONE 2026-05-05
## ✅ BL-033 / BL-032 / BL-031 / BL-030 / BL-027 / BL-025 / BL-026 — DONE 2026-05-03~04
## 用户手工待办（按优先级）
1. **BL-035 + BL-034 + BL-020 prod redeploy 大合并**：SSH prod 写 8 个 env vars（KOLMATRIX_APP_PASSWORD / HEALTH_DETAIL_TOKEN / AI_DAILY_COST_USD_PER_TENANT_MAX=5.00 / RESEND_WEBHOOK_SECRET / EMAIL_MOCK_VERBOSE=false / DISABLE_AI_RATELIMIT 留空 / DISABLE_BATCH_RATELIMIT 留空 / HIDE_DEMO_SEED_KOLS=true）→ Resend Dashboard 配 webhook URL `https://kol.guangai.ai/api/webhooks/resend` + svix secret → VPS crontab 加 `0 2 * * * cd /opt/kolmatrix && npx tsx scripts/redact-old-email-logs.ts --apply` → GH Actions Deploy → 浏览器+endpoint 验证
2. **aigcgateway 控制台 7 Action template 改**（BL-035 S5）：用 mcp__aigc-gateway create_action_version + activate_version 按 inventory `docs/specs/BL-035-F013-actions-run-inventory.md` 改 max_tokens（500/1000/2000/4000）+ system prompt untrusted clause（kol-email-customize / roi-insights / weekly-report-for-client / kol-database-intelligence / kol-campaign-suggestions / kol-topic-extract / kol-email-generator）
3. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期**：观察期满后用户驱动 prod redeploy
4. **F005/F008/F013 prod 真测**（S1-S3 + S4 真 Resend bounce）：第 2 个 tenant 启用后 cross-tenant updateProduct/deleteProduct 测；outreach composer 选 ≥9 KOL 触发 batch_too_large；aigcgateway logs 抽样核对 USER_VIDEO_TITLE 包裹；测试邮件触发 hard bounce 验 EmailLog.status + Kol.email 清空
5. **F005 cost-cap event_log staging 实测**（继承自 BL-034 S6）+ **Pokemon Go 邮件模板 v1 prod 浏览器验证**（继承自 2026-05-05 ops）
6. ~2026-05-09 BIx F004 staging YouTube sync 走查 + BL-034 unused import 2 个下批次顺手清（BL-035 S6）
## 关键决议（已 lock）
- BL-035 D1-D9 + Planner 22:30 方案 A（受限项 Soft-watch 兜底 + 临时担任 evaluator 完成 signoff）
- BL-020 / BL-034 / v0.9.11 / v0.9.12 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator；BL-035 verifying 由 Codex 短版 notes + Planner 临时担任 evaluator 完成 signoff 联合（harness §1.5 用户授权 + 铁律 6 记账，与 BL-020/BL-034 同模式）
- Backlog 19 条（剩 BL-024 ghost-controls / BL-040+041 PRD 偏差 / BL-012 crawler-sync / BL-014/15/16 post-MVP 等）
- 时间线：05-05 BL-035 done → 05-06~07 用户手工待办执行 + prod redeploy 大合并 → 05-08~10 BL-024 → 05-11 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
