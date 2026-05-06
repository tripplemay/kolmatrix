---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-040 Q5 Product targetAudience 字段改 required — VERIFYING（push @ 37d4a8c + 用户 2026-05-06 12:10 override C+D）
- 1/1 done：F001 DB+全栈类型清理（23 文件 + migration 20260507000000_target_audience_required + schema.prisma 去? + 5 处 TS type + 2 处 actions.ts + generateAiAssets.ts:175 删 ?? 'Not specified' + UI 保留 + kol-embed.ts + 13 处 test fixture + 新测 3 case 全 PASS）
- 本机守门：tsc 0 / lint 0 errors / 11 受影响 integration files 91 tests 全 PASS / new test 3/3 PASS
- CI 25415177126：BL-040 相关 5/5 job PASS（Lint/Unit/Typecheck/Build/Migration validate）；2 项 pre-existing fail 无关（material-symbols woff2 stale + database-fidelity export disabled，BL-024 F004/F005 遗留）
- Staging deploy 25415574990：git_pull/migrate/build/pm2-restart 全 PASS（migration applied at staging git_sha=37d4a8c）；health 503 因 BL-024 F006/F007 retroactive .env.staging 漏配 KOLMATRIX_APP_PASSWORD（BL-040 无关，已入 BL-043）
- spec scope 偏差留 Planner judgement：email-generator.ts:74 + video-script-generator.ts:80 同样含 ?? 'Not specified'，本批次未动（铁律 #10）
- v0.9.14 候选已写入 framework/proposed-learnings.md（done 阶段交用户决议）
## ✅ BL-024 + Framework v0.9.13 + BL-024 F007 retroactive + prod redeploy 大合并 — DONE 2026-05-06 ~08:00（CRIT-1 retroactive 完整闭环 @ 8be3115）
## ✅ BL-035 / BL-034 / Framework v0.9.12 / BL-020 / Framework v0.9.11 / BL-033~BL-026 — DONE 2026-05-03~05
## ✅ BL-041 Dashboard 3 元素 — 已 done by MVP-internal-demo-prep-F001 commit 4fd778b @ 2026-05-01（audit 过期 retroactive 关闭）
## 用户手工待办（按优先级）
1. ~~prod redeploy 大合并 + KOLMATRIX_APP_PASSWORD 落地~~ ✅ DONE by Planner ops 2026-05-06 ~08:00
1.5. ~~aigcgateway UI 设 6 Action max_tokens~~ ❌ CANCELED 2026-05-06（aigcgateway Action 抽象层不绑定；治理入 BL-042 post-MVP）
2. **🆕 staging .env.staging 加 KOLMATRIX_APP_PASSWORD 落地**（同 prod 值，~5min SSH）— BL-043 短期人工修复，恢复 staging health 200。BL-040 verifying 期间 Reviewer 走 prod/local，不阻塞，但 staging health 持续 503 直到此修复
3. **BL-020 F006 CSP + BL-034 F008 NULLIF 1 周 staging 观察期**（被动 — 满后下次 prod redeploy 时一并触发）
4. **BL-035 F005/F008/F013 + F006 prod 真测**：第 2 tenant 启用 + outreach composer ≥9 KOL + aigcgateway logs 抽样 + 测试邮件 hard bounce
5. **BL-034 F005 cost-cap event_log staging 实测**（继承）+ **Pokemon Go v1 prod 浏览器验证**（继承）
6. **BL-024 prod 浏览器 5 处 walk** + ~05-09 BIx F004 + BL-024 SW-1 visual baseline tracking-list/suppression-list.png + BL-034 unused import 顺手清
7. **BL-040 done 后 prod 浏览器创建 Product 不填 targetAudience 验证 + KB AI 生成 prompt 不含 'Not specified'**
## 关键决议（已 lock）
- BL-040 verifying 切换：用户 2026-05-06 12:10 决议 C+D（C override staging-health 硬要求 + D BL-024 F008 retroactive 入 backlog 作 BL-043）
- v0.9.14 候选「audit 起草前必须 grep 实物状态」入 proposed-learnings（v0.9.9 铁律 1 反向应用 + v0.9.13 §5.1 同根问题延伸 + BL-040 spec 起草时 grep 漏 ?? 'Not specified' 完整模式 reaffirm）
- BL-035 / BL-034 / BL-020 / BL-024 / v0.9.11~v0.9.13 — 不动
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 18 条（新增 BL-043 deploy-staging.yml 闭合 staging-side gap medium / 余 BL-042 max_tokens / BL-012 crawler-sync / BL-021 Suspense / BL-022 列表 / BL-014~17 / BL-019 / BL-023 / BL-025~BL-027 等 deferred）
- 时间线：05-06 BL-040 verifying → Reviewer reverifying → done → 05-06~07 用户业务测继承待办 #2-#7 → 05-08~10 buffer / BL-021 评估 → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
