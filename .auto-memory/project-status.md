---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-044 /discovery AI Semantic Search — DONE 2026-05-06（Reviewer L2 staging PASS）
- staging `git_sha=eeeff4a`，health 200 / db ok / redis ok；Codex 已完成 `/zh/discovery` 全面走查
- 结果：AI chip semantic search 返回 50 KOL，free-text `?ai=` 返回 50 KOL，sidebar soft override 与 sort inert 正常
- `?ai=` / `search` 互斥生效：AI-active 时 search chip 不共存；fallback banner 未触发，受测环境保持 healthy
- L1 维持全绿：semantic-search unit / discovery integration / lint / typecheck
- 签收文件：`docs/test-reports/BL-044-discovery-ai-semantic-search-signoff-2026-05-06.md`
- 下一步候选：BL-043 staging gap 后续硬化 / 其它 backlog 由 Planner 排序
