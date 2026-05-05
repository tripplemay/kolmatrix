---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-035 后端 HIGH + UX + AI 服务端协调 — BUILDING（spec lock @ 2026-05-05 15:00）
- 13/13 全 generator pending：F010 fetchWithRetry 共享 / F003 AI rate-limit 6 处（v0.9.11 §rate-limit dogfood）/ F009 kol_campaign 索引 / F012 paginator nulls 修饰符（discovery mock 沉底）/ F004 share token origin 服务端 / F005 product ownership preflight / F001 password min(12) / F002 withPlatformAdmin 收紧 / F006 Resend webhook 实装 / F007 PII 脱敏 + EmailLog 30d retention / F008 sendBatch 50→8 / F013 aigcgateway actions/run 协调（v0.9.11 §4 完整版）/ F011 死代码删
- 来源：docs/reviews/backend-full-scan-2026-05-04.md §2 (HIGH 11 项) + F012 用户 2026-05-05 报 + F013 BL-034 F005 推入
- spec：docs/specs/BL-035-backend-high-and-ux-and-aigc-actions-spec.md（D1-D9 决策 + §5 v0.9.11/v0.9.12 dogfood + §6.1 4 项 user 手工待办 + §7 推荐实装顺序 F010 → F003 → F009 → F012 → F004+F005 → F001+F002 → F006 → F007 → F008 → F013 → F011）
- 预估 5-7 day building + 1 day verifying
## ✅ Framework v0.9.12 — DONE 2026-05-05 ~14:30（BL-034 沉淀，3 条 learnings 全 Accept）
- pre-impl-adjudication.md §11 building 中段良性 partial-pending 变种 / database-patterns.md §8.1 cross-cutting helper 同 commit / deploy-patterns.md §5 auth-gated endpoint + bash 旧 bytecode / evaluator.md §17 lint warnings 矩阵；归档 framework/archive/proposed-learnings-archive-v0.9.12.md
## ✅ BL-034 后端深度安全 / 数据隔离 — DONE 2026-05-05 ~12:00（reverifying PASS @ 07a6db4，fix_rounds=1，0 PARTIAL/FAIL）
- 8/8 PASS + signoff（5 user 手工待办 + 8 Soft-watch 全有兜底）；详见 docs/test-reports/BL-034-...-signoff-2026-05-05.md
## ✅ Framework v0.9.11 / BL-020 / BL-033 / BL-032 / BL-031 / BL-030 / BL-027 / BL-025 / BL-026 — DONE 2026-05-03~05
## 用户手工待办（按优先级）
1. **BL-034 done 后 5 项 SSH 配置 + prod redeploy**（合并 BL-020）：SSH prod 写 KOLMATRIX_APP_PASSWORD（F001）+ HEALTH_DETAIL_TOKEN（F007）+ AI_DAILY_COST_USD_PER_TENANT_MAX（F005 prod=5.00 / staging=100）+ HIDE_DEMO_SEED_KOLS=true（BL-020 F008）→ GH Actions Deploy → 浏览器+endpoint 验证
2. **BL-035 done 后 4 项 SSH 配置**（spec §6.1）：RESEND_WEBHOOK_SECRET（F006）+ EMAIL_MOCK_VERBOSE=false（F007）+ Resend Dashboard webhook URL/secret 配 + VPS crontab 加 redact-old-email-logs.ts daily + aigcgateway 控制台 7 Action template 由 Planner ops 改 + verify
3. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期**：观察期满后用户驱动 prod redeploy
4. **F005 cost-cap event_log staging 实测**（S6）：触发 outreach customize 后 SSH psql 查 event_log type='ai.usage'
5. **Pokemon Go 邮件模板 v1 prod 浏览器验证**（2026-05-05 ops 后）：刷新 /zh/knowledge-base 看 Pokemon Go 卡 chip 应显 '4 email templates'
6. ~2026-05-09 BIx F004 staging YouTube sync 走查
## 关键决议（已 lock）
- BL-035 D1-D9 + 推荐实装顺序（F010 先做建立基础供 F003/F007 复用；F013 倒数依赖 F010+F003+BL-034 F005）
- v0.9.12 + v0.9.11 + BL-020 + BL-034 D1-D8 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 19 条（BL-035 已并入 features.json；剩 BL-024 / BL-040 / BL-041 等）
- 时间线：05-05 BL-034 done → 05-05~07 BL-035 (现) → 05-08~10 BL-024 → 05-11 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
