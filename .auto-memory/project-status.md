---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-082-refresh-selector-rewire BUILDING (0/6, fix_rounds=0) — 重接 daily-sync refresh phase (Dir A)
- A0 (BL-081 F004 audit + O1-O3) done, A1 4 子决策 lock: tiered selector 保留 / MAX 200→500/天 / sequential discover→import→refresh→import / 404 skip+log
- O3 pre-flight: real channel handle UC22GlzN_jFaGLhiO-8ZM7Gw → HTTP 200 完整 KOL object (fork endpoint 可用)
- 6 features: F001 runDaily 接 refresh / F002 refreshCount 真实 + MAX=500 / F003 单测 / F004 audit_log 404_skip / F005 staging 24h 监控 / F006 Codex
- 预期 KOL pool staleness 长期保持 <7d + 治理债清, +$5/月 quota 可接受
- 关联 docs/specs/BL-082-refresh-selector-rewire-spec.md
## ✅ BL-081-kol-country-data-fix DONE (6/6, fix_rounds=0, tag bl081-done @ 7bfeacb) — KOL country mapper bug + silent retry storm 修复
- prod LLM 实测 83/天 (acceptance <200) / 成本 $0.075/天 (降幅 83% from $0.44/天 baseline)
- Reviewer signoff `docs/test-reports/BL-081-signoff-2026-06-04.md`
- proposed-learnings.md 无新条目, framework_reviewed=true 跳过
## ⏸️ BL-080-landing-illustration-mockups PAUSED (1/6 @ ad14bdd) — 等用户跑 AI gen PNG
- 归档 docs/archive/paused-batches/BL-080-{progress,features}.json + RESUME.md
- Resume trigger: 用户通知 public/landing/illustrations/ ≥6/8 PNG 就绪
## ✅ BL-079 / BL-078 / BL-077 / BL-076 / BL-075 / BL-074 / BL-073 / BL-072 / BL-071 / BL-070 / BL-069 / BL-068 / BL-067 / BL-066 / BL-065 / BL-064 / BL-063 / BL-061-059 / BL-055-049 / 043+044 全 DONE
## 用户手工待办
1. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
2. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog
- BL-080 (paused, 等用户 PNG)
- Phase 5: 个性化学习 / Brief 模板库 / comparative query
- BL-054 flaky network test isolate / BL-048 valueScore 区分度
