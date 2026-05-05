---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-024 B4 ghost-controls 实装 mini-batch — BUILDING（spec lock @ 2026-05-05 22:45；F006 hotfix 加 23:05；Q2 ops 23:30 partial done）
- 6/6 全 generator（F001 F002 done @ 6447664 / 其余 4 pending）：F002 ✅ /roi 时间 toggle / F003 ⏳ /weekly-report range / F001 ⏳ /database 头 3 按钮 / F004 ⏳ /outreach/tracking / F005 ⏳ /outreach/suppression / F006 ⏳ BL-034 F001 deploy yml env bridge retroactive fix（hotfix 追加）
- 用户 2026-05-05 22:30 决议方案 B（A+B+C+D-2+D-3 5 features）+ 23:05 决议方案 A（F006 hotfix 加入；CRIT-1 fix 实际未在 prod 生效）+ 23:30 全权 Q2 ops 用户授权完成
- spec：docs/specs/BL-024-ghost-controls-cleanup-spec.md（D1-D8 + §F006 + §5 v0.9.11/v0.9.12 dogfood + §7 推荐顺序）
- ✅ Q2 ops by Planner（用户全权 22:50）：5 prod env vars + 4 staging env vars + 2 Resend webhooks（svix verified）+ 6 aigcgateway Action v2 active（system prompt addendum 完整 dogfood，max_tokens 推 Soft-watch — mcp schema 缺字段）+ VPS crontab redact daily + staging deploy 25385351690 SUCCESS @ 9746543（health/db/redis 全 ok，token gate + svix 验签全实测通过）
## ✅ BL-035 / BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 / BL-033~BL-026 — DONE 2026-05-03~05
## 用户手工待办（按优先级）
1. **🟡 BL-024 F006 done + KOLMATRIX_APP_PASSWORD 落地 + prod GH Actions Deploy（合并触发）**：等 Generator 推 F006 done（deploy yml `set -a; source .env`）→ 你生成 random KOLMATRIX_APP_PASSWORD（openssl rand -hex 16）写 prod .env.production + 同步 DATABASE_URL 中 kolmatrix_app 角色密码部分（用户主导，DATABASE_URL 改密风险高需手术级 ops）→ GH Actions trigger Deploy to Production → curl health 验 git_sha 对齐 + 5 错密码 toast 验 rate-limit + Resend 测试邮件 hard-bounce 验 EmailLog.status + Kol.email=null
2. **aigcgateway Dashboard UI 设 6 Action max_tokens**（Q2 ops 推 Soft-watch — mcp schema 缺）：登录 https://aigc.guangai.ai 控制台，按 inventory `docs/specs/BL-035-F013-actions-run-inventory.md §2` 矩阵改：kol-email-customize=2000 / roi-insights=4000 / weekly-report-for-client=4000 / kol-database-intelligence=1000 / campaign-next-action-suggest=1000 / kol-topic-extract=500（system prompt addendum 已 v2 active by Planner ops）
3. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期**：观察期满后驱动 prod redeploy（与 #1 合并是 OK 的）
4. **BL-035 F005/F008/F013 + F006 prod 真测**（S1-S4 + #1 完成后）：第 2 tenant 启用 + outreach composer ≥9 KOL + aigcgateway logs 抽样 + 测试邮件 hard bounce
5. **BL-034 F005 cost-cap event_log staging 实测** + **Pokemon Go v1 prod 浏览器验证**（继承）
6. **BL-024 done 后 prod 浏览器 5 处 walk** + ~05-09 BIx F004 + BL-034 unused import 顺手清
## 关键决议（已 lock）
- BL-024 D1-D8 + F006 hotfix（CRIT-1 retroactive）+ Planner Q2 ops 23:30 partial done（KOLMATRIX_APP_PASSWORD + prod Deploy 留用户）
- BL-035 / BL-034 / BL-020 / v0.9.11 / v0.9.12 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）；BL-024 F006 + 其它 features Generator 主导，Reviewer Codex 验收
- Backlog 18 条（剩 BL-040+BL-041 / BL-012 crawler-sync / BL-021 / BL-022 / BL-014/15/16 post-MVP）
- 时间线：05-05 Q2 ops done → 05-06~07 BL-024 + F006 + 用户驱动 prod Deploy → 05-08~10 BL-040+BL-041 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
