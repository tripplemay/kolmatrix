---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-059 youtube-deprecate-and-engagement-derive DONE（5/9 / 7/7 features @ 56f6623 / fix_rounds=0）
- L1: lint 0 / tsc 0 / 156 files 1101 tests PASS + integration 2/8 PASS；staging /api/health healthy + smoke PASS
- 关键产出：apify-kol mapper engagement_rate derive + 单源迁移与软删除闭环 + youtube.ts/engagement-batch 删除
- signoff: docs/test-reports/BL-059-youtube-deprecate-and-engagement-derive-signoff-2026-05-09.md
## ✅ BL-012 / BL-055 / BL-052 / BL-051a / BL-049 / BL-021+BL-023 / BL-043+BL-044 全 DONE
## 🆕 BL-054-flaky medium / BL-056-notifications low
## ⚠️ BL-058 P0 sub-feature 5/9 — fork totalLikes 三平台缺；**方向 B lock：全等 fork 修复，5/13 上线接受 100% NULL UI '—' + placeholder=12 兜底排序**；话术 docs/inbox/feedback-fork-totallikes-2026-05-09.md
## 🚀 5/13 上线对外（buffer 4 天）
- BL-059 done → prod redeploy（GitHub Actions UI dispatch HEAD 56f6623）— 关键路径
- 5/9-5/13 cron 累积 + 5/13 上线（apify-kol 单源 + ~500-1000 KOL）
- 6/8（30 天 soft delete 后）评估硬删 vs 永久保留
## 用户手工待办（按优先级）
1. **prod redeploy 含 BL-059**（GitHub Actions UI dispatch HEAD 56f6623）— 关键
2. 反馈爬虫团队 — 现成话术 docs/inbox/feedback-fork-totallikes-2026-05-09.md（Issue + Slack 双发）+ 其他 5 fork bug + revoke classic PAT
3. 5/15 §4.8 seed_expansion（如 cron 累积 ≥1k）+ fork 数据 4 维度迭代关注（BL-058）
4. 决定下一批次方向（BL-054 / BL-056 / 用户提其他）
## 关键决议（已 lock）
- 5/9 BL-059 综合 PASS @ 56f6623 + signoff Ready；5/9 BL-058 P0 sub-feature triggered + 方向 B lock（全等 fork，KOLMatrix 不动；fallback 公式首选 BL-023 真公式 Σ(likes+comments)/Σ(views) 取最近 50 视频）
- 5/9 BL-012 综合 signoff PASS @ 4712066（A-/Ready，14/14，fix_rounds 2）
- 5/8 §4.7 30 schedules SSH 创建 / v5 spec 修订 / v0.9.16-v0.9.19 framework 沉淀
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条（BL-058 含 P0 sub-feature）/ framework 6-layer 完整
