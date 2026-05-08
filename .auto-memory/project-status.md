---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟡 BL-059-youtube-deprecate-and-engagement-derive VERIFYING（5/9 03:42 切 / 7/7 features done @ 56f6623）
- features 7/7 completed / fix_rounds=0 / staging deployed @ 56f6623（HEAD ✓）
- L1: lint 0 / tsc 0 / **156 files 1101 tests PASS** + staging health PASS（DB 17ms / Redis 2ms）+ 公开页 smoke PASS
- 关键产出：F001 apify-kol mapper engagement_rate derive + F002 SQL no-op 守门（spec §3.1 metadata.raw 缺失，依赖下次 sync mapper 写入）+ F003 prod 2584 youtube-api-daily soft-deleted + 2584 audit_log + F004 删 youtube.ts/engagement-batch/published-after + F005 kol-sync-daily.ts apify-kol 单源 rewrite + F006 文档+VM env vars audit + F007 staging smoke
- 待用户：(a) Reviewer 接力 verifying 出 signoff (b) prod redeploy 后下次 cron 写 engagement_rate（spec §10.2 #2 ≥200）
## ✅ BL-012 DONE 5/9 / BL-055 DONE / BL-052 / BL-051a / BL-049 / BL-021+BL-023 / BL-043+BL-044 全 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low / BL-058-apify-data-quality low post-MVP
## 🚀 5/13 上线对外（buffer 4 天充裕）
- BL-059 done 后 prod redeploy（GitHub Actions UI dispatch HEAD 56f6623）— 关键路径
- 5/9-5/13 cron 累积 + 用户业务测继承
- 5/13 ⭐ 上线（apify-kol 单源 + ~500-1000 KOL）
- 6/8（30 天 soft delete 后）评估硬删 vs 永久保留
## 用户手工待办（按优先级）
1. **触发 Reviewer (Codex) 接力 verifying** — 出 BL-059 signoff 报告
2. **BL-059 done 后触发 prod redeploy 含 BL-059**（GitHub Actions UI dispatch HEAD 56f6623）— 关键
3. 反馈爬虫团队 5 fork bug + revoke classic PAT
4. 5/15 §4.8 seed_expansion（如 cron 累积达 ≥1k）+ fork 数据 4 维度迭代关注（BL-058）
5. 决定下一批次方向（BL-054 / BL-056 / 用户提其他）
## 关键决议（已 lock）
- 5/9 03:42 BL-059 building 7/7 done @ 56f6623 + staging smoke PASS + 切 verifying
- 5/9 01:30 BL-059 spec lock：单源切换 + soft delete + derive engagement / 30 天可恢复 + BL-058 跟踪
- 5/9 00:43 BL-012 综合 signoff PASS @ 4712066（A-/Ready，14/14 features，fix_rounds 2）
- 5/8 §4.7 30 schedules SSH 创建 / v5 spec 修订 / v0.9.16-v0.9.19 framework 沉淀
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条 / framework 实物核查 6-layer 完整
