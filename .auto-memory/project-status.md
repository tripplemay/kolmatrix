---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-049 测试基建系统性升级 — VERIFYING（building 完 5/7 14:15 / 7/7 features done / 5.5x 加速 1h05min vs 6h / 3 commits b9fa62c+8ace6e0+91ee2cd / staging deployed @ 91ee2cd / 待 Codex L1+L2）
- spec：docs/specs/BL-049-test-infra-systematic-upgrade-spec.md；audit：docs/audit-reports/test-infra-audit-2026-05-07.md
## ✅ BL-021 — DONE 5/7 13:06（fix-round 1 PASS @ 9fa2a49 / 1.4x 加速）
## ✅ BL-023 DONE 5/7 09:23 (8/8 6x) / ✅ BL-043 DONE 5/6 (3/3 2x) / ✅ BL-044 DONE 5/6 (4/4 + Prod 12/12 5x)
## 🐛 孤儿 campaign 4425e07e ✅ ops 清理完毕 5/7 13:40（bc69a65）
## 📝 BL-051a Lifecycle Management — Planning lock（X2 合并 BL-017+BL-046 = 11 features F001-F011；X1 时间线 5/8 启动）
- spec：docs/specs/BL-051a-lifecycle-management-spec.md（Part A token F001-F005 + Part B product soft delete F006-F011）
## 🆕 BL-050 dashboard KPI 真趋势化（X1 时间线 5/9 BL-051a done 后独立 ~30-60min）
## 🆕 BL-047 closed-resolved / BL-017+BL-046 closed-merged-into-BL-051a
## 🚀 5/13 上线对外时间线 X1 激进压缩（用户 5/7 14:30 决议）
- 5/7 ~16:00：BL-049 done（Generator ~14:00 实装 + Codex L1+L2 ~16:00；可能更早）
- 5/7 晚：buffer
- 5/8 周一：**BL-051a Lifecycle 启动**（~3-4h → done）+ Dependabot 首次 run
- 5/9 周二：**BL-050 KPI 真趋势**（~30-60 min → done）+ prod redeploy + 用户走查
- 5/10~12：buffer 3 天 + 用户业务测继承
- 5/13 周三 ⭐ 上线对外（3 day buffer）
## 用户手工待办
1. ~~CSP/NULLIF 5/11 满期评估~~ → X1 压缩后实测 5/4-5/8 = 4 day 实际观察足够；prod 4 day 已 healthy 0 CSP block；接受较短观察期
2. 5/8 周一首次 Dependabot run 后看 PR 列表（5 group），决议合并/延后
## 关键决议（已 lock）
- 5/7 14:30：X1 激进压缩 — 5/8 BL-051a / 5/9 BL-050 / 5/13 ⭐ 上线（3 day buffer，CSP/NULLIF 4 day 观察）
- 5/7 14:10：X2 合并 — BL-051a Lifecycle (BL-017+BL-046) + BL-050 独立
- 5/7 13:55/13:40/13:10：BL-050 入 high / 孤儿清理 / BL-021 done + BL-049 立即切
- 5/7 10:50：BL-049 spec lock — 测试基建 audit High 3 + Medium 4 = 7 features
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator
- Backlog 18 条（high 2：BL-050/051a；low 6；closed 3：BL-017/046/047；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
