---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BIx-mvp-polish-pass — DONE** ✅ 2026-05-02 14:00 Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BIx-mvp-polish-pass-signoff-2026-05-02.md；staging+prod live @ a851866
## Reviewer 验收摘要（PASS, fix_rounds=0）
- L1 全 PASS（lint 0e / tsc 0e / 678 pass + 1 WSL fs 超时非 BIx / build 79 静态页）
- L2 全 PASS（6 安全头 / self-host Material Symbols / SSH staging git_sha+env+migration / dry-run sync 0 errors / commit-tag F001-F005 合规）
- 8 条 Soft-watch 不阻塞：详 signoff §6
## Done 阶段 TODO（Planner 接力）
1. /schedule 7-day follow-up agent 自动 grep staging sync log（reopen F004 触发条件见 signoff §12）
2. 装 @next/bundle-analyzer 入 devDeps + Lighthouse 实测脚手架（O3-O4 数字证据补齐）
3. 收尾 framework/proposed-learnings.md（cross-agent staged 污染 + NODE_OPTIONS heap + Reviewer 沉淀 2 条）
4. 启动 BL-020 mini-batch（~05-08, CR-1/2/3 + H-S1/2/3 + CSP enforce 切换）
## 关键决议（已 lock）
- F004 KOL_SYNC_MIN_SUBSCRIBERS env var：prod 默认 1000 / staging 显式 10000
- F005 范围 (γ)：CR-4/5/6 + H-P1/2/3；H-P4 → BL-021；H-P5 → BL-022
- Material Symbols self-host 子集（不切 Lucide）；CSP Report-Only 一周观察期；next/image 全 7 处一次性替换
- BIx 7-day post-done staging soft-watch acceptance（用 /schedule 兜底 live sync evidence）
## 角色 / Backlog / 时间线
- 角色：默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 13：BL-003/011/012/014/015/016/017/018/019 + BL-020 安全 high / BL-021 Suspense / BL-022 虚拟化 / BL-023 KOL 评分（BIx done 已解锁）
- 下批次：**BL-020 安全 mini-batch** ~05-08（上线对外客户前必须）
- 时间线：2026-05-02 BIx DONE ✅ / ~05-08 BL-020 done → 对外客户上线就绪

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
