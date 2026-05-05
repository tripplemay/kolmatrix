---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-035 后端 HIGH + UX + AI 服务端协调 — building 13/13 done @ 0b3557a（待 staging deploy 切 reverifying）
- 13/13 features：F010 fetchWithRetry 共享 + jitter / F003 AI rate-limit 6 endpoint（10/min/tenantId + 100/day; 20/min/userId for sendBatch）/ F009 kol_campaign 索引 / F012 paginator nulls 修饰符（discovery mock 沉底 — 用户 2026-05-05 报闭环）/ F004 createShareToken 服务端 origin / F005 updateProduct/deleteProduct ownership preflight / F001 password min(12) + seed 升级 KOLMatrix@2026! / F002 withPlatformAdmin 收紧 / F008 sendBatch 50→8 + 60s timeout / F011 dead code 删 / F013 actions/run wrap + inventory 文档 / F007 PII 脱敏 + EmailLog 30d retention 脚本 / F006 Resend webhook svix 验签
- L1：tsc 0 errors / lint 3 既有 warning / 单元 962/965 PASS（3 既有 flake）/ +50 新 case
- 待 staging deploy（generator.md §硬要求）：用户 SSH staging 跑 git pull + npm ci + prisma migrate deploy + GIT_SHA build + pm2 reload，验 git_sha = main HEAD + health 200 + db ok 后 Generator 切 status=verifying
## ✅ BL-034 后端深度安全 / 数据隔离 — DONE 2026-05-05 ~12:00（reverifying PASS @ 07a6db4，fix_rounds=1）
## ✅ Framework v0.9.12 — DONE 2026-05-05 ~01:00（BL-020 + backend-audit 沉淀，5 条 learnings 全 Accept）
## ✅ BL-020 前端安全整改 — DONE 2026-05-05 ~01:00
## ✅ BL-033 / BL-032 / BL-031 / BL-030 / BL-027 / BL-025 / BL-026 — DONE 2026-05-03~04
## 用户手工待办（按优先级）
1. **BL-035 staging deploy**（必须先做，blocks reverifying）：SSH `tripplezhou@34.180.93.185` → `cd /opt/kolmatrix-staging && set -a && source .env.staging && set +a && git pull --ff-only origin main && npm ci --include=dev && npx prisma migrate deploy && NODE_OPTIONS='--max-old-space-size=4096' GIT_SHA=$(git rev-parse --short HEAD) npm run build && pm2 reload kolmatrix-staging --update-env`，验 `curl -s https://staging.kol.guangai.ai/api/health | jq` git_sha=0b3557a + status=healthy
2. **BL-035 done 后 4 项 user 手工待办**（spec §6.1）：SSH .env.staging + .env.production 加 RESEND_WEBHOOK_SECRET（Resend Dashboard 生成）+ EMAIL_MOCK_VERBOSE=false + Resend Dashboard 配 webhook URL `https://kol.guangai.ai/api/webhooks/resend` + svix secret + VPS crontab 配 `0 2 * * * cd /opt/kolmatrix && npx tsx scripts/redact-old-email-logs.ts --apply >> /var/log/kolmatrix-redact.log 2>&1` + aigcgateway 控制台 7 Action template max_tokens + untrusted clause（mcp__aigc-gateway，inventory `docs/specs/BL-035-F013-actions-run-inventory.md §2`）
3. **BL-034 done 后 5 项 user 手工待办** + **BL-034 + BL-020 prod redeploy**（合并）+ **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期** + **F005 cost-cap event_log staging 实测** + **Pokemon Go 邮件模板 v1 prod 浏览器验证** + ~2026-05-09 BIx F004 staging YouTube sync 走查（继承自 BL-034 done）
## 关键决议（已 lock）
- BL-034 + BL-035 D1-D9 + Planner 14:00 方案 A（F005 fix-round 1 cost-cap MVP + F013 推 BL-035）
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 19 条（已扣 BL-035；剩 BL-024 ghost-controls / BL-040+041 PRD 偏差 / BL-012 crawler-sync / BL-014/15/16 post-MVP 等）
- 时间线：05-05 BL-035 building done（待 staging deploy + Reviewer 复验）→ 05-08~10 BL-024 → 05-11 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
