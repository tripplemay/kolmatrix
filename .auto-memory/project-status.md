---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BIx-mvp-polish-pass** — building 0/5（2026-05-01 启动；MVP-internal-demo-prep done + signoff PASS + framework v0.9.5 12 条 learnings 沉淀完毕）
- 估时 ~5-5.5 day Generator + 0.5 day Reviewer
## Features (5, 全 generator 批次)
- F001 /crm 3 disabled 控件清理（time toggle / Export CSV / 删 Manual log）~1 day
- F002 Misc 5 项 polish（Owner filter / Email btn / PDF 文案 / mock_sent / AiSuggestions）~2h
- F003 11 页 critical paths edge states + error.tsx 兜底 ~4h
- F004 YouTube sync 配额优化 P1 ~89% + Top 100 真 engagement batch ~1.5-2 day
- F005 前端 perf 六件套（next.config.ts/font/image + recharts/markdown dynamic + AppShellLayout island）~1.4 day
## Generator 开工建议顺序（spec §4 + 工时优化）
F002 → F003 → F001 → F005 → F004 → push CI 全绿 → SSH staging deploy（按 framework deploy-patterns §3.2 完整链）→ SSH prod redeploy（F004 含 migration）→ verifying 移交 Reviewer
## ✅ F004 用户已裁决 (c) — env var KOL_SYNC_MIN_SUBSCRIBERS
- prod 默认 1000（与 PRD §10.1 微网红 + quality.ts 对齐）；staging 显式 10000（保留降噪）
- Generator 5 features 已无 open question，可即刻按建议顺序开工
## 关键设计决议（spec §3 + §10 lock）
- F005 范围 (γ)：CR-4/5/6 + H-P1/2/3 六件套；H-P4 → BL-021；H-P5 → BL-022
- Material Symbols：next/font 自托管子集（不切 Lucide）；CSP Report-Only 一周观察期；next/image 全 7 处一次性替换
- F004 P1 ~89% utilization + Top 100 真 engagement batch 替代 B5 lazy-load + kol_sync_cursor 表新建
## 角色分配
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
## Backlog 12 条
BL-003/011/012/014/015/016/017/018/019 + BL-020 安全 high / BL-021 Suspense medium / BL-022 虚拟化 deferred
## 即将启动批次
- **BL-020 安全 mini-batch** (BIx done 后, ~0.5-1 day) — 6 项前端审计安全 Critical/High，上线对外客户前必须
## 时间线
- ~05-12 BIx-mvp-polish-pass done
- ~05-13 BL-020 安全整改 done → 上线对外客户准备就绪

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
