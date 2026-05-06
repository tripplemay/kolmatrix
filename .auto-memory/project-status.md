---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔍 BL-040 Q5 Product targetAudience 字段改 required — VERIFYING（staging 已修，等 Codex 重做完整 L2 @ 2026-05-06 15:55）
- staging .env.staging KOLMATRIX_APP_PASSWORD 已 sync prod 值 by Planner ops（铁律 6 用户授权）+ PM2 delete+sourced start (v0.9.7 §1) 解 PM2 env cache 问题；staging health 200 / db ok / redis ok / git_sha=37d4a8c 与 BL-040 F001 对齐
- 用户 2026-05-06 决议：让 Codex 按正常流程在 staging 做完整 L2 浏览器走查后再决议 done（不让 Planner 临时担任 evaluator，与 BL-020/BL-034/BL-035/BL-024 历史模式不同）
- Codex 短版 verifying notes (commit 8b8ce9d) 已标 PASS 6/6 但用 local fallback；现 staging 可用，请 Codex 在下次会话重做完整 L2 走查（详 progress.json johnsong session_notes 顶段「Reviewer Codex 请求」）
- 1/1 done：F001 DB+全栈类型清理（23 文件 + migration 20260507000000_target_audience_required + schema.prisma 去? + 5 处 TS type + 2 处 actions.ts + generateAiAssets.ts:175 删 ?? 'Not specified' + UI 保留 + kol-embed.ts + 13 处 test fixture + 新测 3 case 全 PASS）
- 本机守门：tsc 0 / lint 0 errors / 11 受影响 integration files 91 tests 全 PASS / new test 3/3 PASS
- CI 25415177126：BL-040 相关 5/5 job PASS（Lint/Unit/Typecheck/Build/Migration validate）；2 项 pre-existing fail 无关（material-symbols woff2 stale + database-fidelity export disabled，BL-024 F004/F005 遗留）
- Staging deploy 25415574990：git_pull/migrate/build/pm2-restart 全 PASS（migration applied at staging git_sha=37d4a8c）；health 503 因 BL-024 F006/F007 retroactive .env.staging 漏配 KOLMATRIX_APP_PASSWORD（BL-040 无关，已入 BL-043）
- spec scope 偏差留 Planner judgement：email-generator.ts:74 + video-script-generator.ts:80 同样含 ?? 'Not specified'，本批次未动（铁律 #10）
- v0.9.14 候选已写入 framework/proposed-learnings.md（done 阶段交用户决议）
## 🎯 BL-044 已 spec lock + Quality 实测 PASS — 等 BL-040 done + BL-043 staging gap 闭合后启 building（路径 B 修订）
- 用户 2026-05-06 报 /discovery AI chip "未找到" prod bug → Planner 调查根因 = AI chip 自然语言意图 vs ILIKE substring 字面匹配不匹配
- Planner 2026-05-06 12:10 跑 mcp embed_text + prod cosine search 4 query 实测：bge-m3 multilingual 100% 命中（中/英/日/韩文 KOL 跨语言；cosine 0.37-0.46）；total cost $0.00000188；Quality gate PASS
- 4 features F001-F004 全 generator（fork from B7a SmartMatch 范式 + 99% infra ready）；预估 1-2 day building + 0.5 day verifying
- spec：docs/specs/BL-044-discovery-ai-semantic-search-spec.md（D1-D7 决策 + §5 v0.9.11/v0.9.12/v0.9.13 dogfood + §6.1 2 项 user 手工待办 + §7 实装顺序 11 步）
- 注：原起草时 ID=BL-043，期间 Generator 推 BL-040 verifying 时加了不同 BL-043（deploy-staging.yml gap），ID 重命名为 BL-044 避冲突
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
- Backlog 19 条（high priority next-sprints：BL-043 deploy-staging.yml staging-gap medium / **BL-044 AI semantic search high prod-bug-fix**；其它 deferred：BL-042 max_tokens / BL-012 / BL-021 / BL-022 / BL-014~17 / BL-019 / BL-023 / BL-025~BL-027）
- 时间线：05-06 BL-040 verifying → Reviewer reverifying → done → BL-043 staging gap 闭合（~5min SSH user task #2 + 可选 sprint）→ BL-044 AI semantic search building（1-2 day）→ 05-07~08 用户业务测继承待办 → 05-09~10 buffer → **05-13 上线对外**

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
