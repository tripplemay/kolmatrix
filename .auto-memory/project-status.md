---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-051a Lifecycle Management — BUILDING（X1+ 极速 5/7 14:40 启动；11 features F001-F011 spec 7.75h，按 5x 加速预估 ~1.5h）
- Part A weekly-report token (F001-F005)：schema migration / share-token 过期+撤销 / page 3 状态 UI / revoke API / UI metadata + 单测
- Part B product soft delete (F006-F011)：schema migration / 全栈 list filter / deleteProduct 软删 + 关联检查 + audit_log / UI 防御 / 单测+集成 / audit_log 永久
- spec：docs/specs/BL-051a-lifecycle-management-spec.md；schema 合并 (weekly_report 3 列 + product 1 列同 migration 文件)
## ✅ BL-049 — DONE 5/7 14:35（first-round PASS 7/7 / 5x 加速 1h25min vs 6.75h）
- v0.9.15 sediment 落地 @ 91ee2cd（跨 pool 复现 + stub environment-agnostic 2 维）；signoff @ 8be96a0
## ✅ BL-021 DONE 5/7 13:06 / ✅ BL-023 DONE 5/7 09:23 / ✅ BL-043 DONE 5/6 / ✅ BL-044 DONE 5/6
## 🐛 孤儿 campaign 4425e07e ✅ ops 清理完毕 5/7 13:40（bc69a65）
## 🆕 BL-050 dashboard KPI 真趋势化（5/7 BL-051a done 后立即接续 ~30-60min）
## 🆕 BL-047 closed-resolved / BL-017+BL-046 closed-merged-into-BL-051a
## 🚀 5/13 上线对外 X1+ 极速时间线（用户 5/7 14:40 决议升级）
- 5/7 14:40~ **BL-051a building**（按 5x 加速预估 ~16:30 done）
- 5/7 ~17:00 **BL-050 building → done**（按 5x 加速预估 ~30 min）
- 5/7 ~17:30 prod redeploy 含 BL-049+BL-051a+BL-050 全部上线前功能
- 5/8 周一  Dependabot 首次 run（5 group PR）
- 5/8~12     5+ day buffer + 用户业务测继承（Resend webhook 真客户邮件触发等）
- 5/13 周三 ⭐ 上线对外（5+ day buffer 极宽裕）
## 用户手工待办
1. CSP/NULLIF 5/4-5/8 实测 4 day prod 0 block 事件 ✓ 已通过实质验证
2. 5/8 周一 Dependabot run 后看 PR 列表（5 group），决议合并/延后
## 关键决议（已 lock）
- 5/7 14:40：X1+ 极速 — BL-049 提前 1.5h done → 立即切 BL-051a → 5/7 ~17:30 全部 done
- 5/7 14:10：X2 合并 — BL-051a Lifecycle (BL-017+BL-046) + BL-050 独立
- 5/7 13:55/13:40/13:10：BL-050 入 high / 孤儿清理 / BL-021 done + BL-049 立即切
- 5/7 10:50：BL-049 spec lock — 测试基建 audit High 3 + Medium 4 = 7 features
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（high 1：BL-050；low 6；closed 3：BL-017/046/047；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
