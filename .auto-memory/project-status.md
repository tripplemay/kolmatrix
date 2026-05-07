---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-051a Lifecycle Management — VERIFYING（11/11 features done @ 5/7 16:55，3.7x 加速 / 4 commits + 3 轮 CI fix / staging @ f2d2c1a）
- Part A weekly-report token (F001-F005)：A1 复用 shareTokenExpiresAt + 新加 revokedAt / B1 validateShareTokenState pure helper + validateShareToken async / 3 状态 page (5 locale) / revoke API + idempotent / brand header TTL picker (1/7/30/never) + revoke button
- Part B product soft delete (F006-F011)：deletedAt + partial idx / 全栈 8 文件 9 hits filter (C1 grep 实勘 vs spec 偏差) / deleteProduct soft + has_references + cascade_count + audit_log / D2 cascade 仅 product / D3 confirmCascade UI 二次弹窗 / F009 campaigns/[id] product=NULL 防御 + AI suggestions drop deleted
- 中段 §11 良性偏差 1 处：audit_log.resource_id UUID→VARCHAR(64) (F008 product=cuid 与 UUID col 冲突；生产 logAudit 也会挂；同 migration Part C)
- spec：docs/specs/BL-051a-lifecycle-management-spec.md；commits 4ff529c+aa97bec+bd4e80e+fix串
## ✅ BL-049 — DONE 5/7 14:35（first-round PASS 7/7 / 5x 加速 1h25min vs 6.75h）
- v0.9.15 sediment 落地 @ 91ee2cd（跨 pool 复现 + stub environment-agnostic 2 维）；signoff @ 8be96a0
## ✅ BL-021 DONE 5/7 13:06 / ✅ BL-023 DONE 5/7 09:23 / ✅ BL-043 DONE 5/6 / ✅ BL-044 DONE 5/6
## 🐛 孤儿 campaign 4425e07e ✅ ops 清理完毕 5/7 13:40（bc69a65）；BL-051a F011 防新孤儿 ✅
## 🆕 BL-050 dashboard KPI 真趋势化（5/7 BL-051a done 后立即接续 ~30-60min）
## 🆕 BL-047 closed-resolved / BL-017+BL-046 closed-merged-into-BL-051a
## 🚀 5/13 上线对外 X1+ 极速时间线（用户 5/7 14:40 决议升级）
- 5/7 14:50~16:55 **BL-051a building done**（实际 ~2h vs 1.5h 预估，3 轮 CI fix）→ Reviewer verifying
- 5/7 ~17:30 **BL-050 building → done**（按 5x 加速预估 ~30 min）
- 5/7 ~18:00 prod redeploy 含 BL-049+BL-051a+BL-050 全部上线前功能
- 5/8 周一  Dependabot 首次 run（5 group PR）
- 5/8~12     5+ day buffer + 用户业务测继承（Resend webhook 真客户邮件触发等）
- 5/13 周三 ⭐ 上线对外（5+ day buffer 极宽裕）
## 用户手工待办
1. CSP/NULLIF 5/4-5/8 实测 4 day prod 0 block 事件 ✓ 已通过实质验证
2. 5/8 周一 Dependabot run 后看 PR 列表（5 group），决议合并/延后
3. backlog low：deploy-staging.sh + deploy-prod.sh 加自动 sed GIT_SHA（BL-049+BL-051a 两次手工 sed）
## 关键决议（已 lock）
- 5/7 14:50~16:55：BL-051a F008 中段裁决 audit_log.resource_id widening（同 migration Part C；生产 bug fix）
- 5/7 14:40：X1+ 极速 — BL-049 提前 1.5h done → 立即切 BL-051a → 5/7 ~18:00 全部 done
- 5/7 14:10：X2 合并 — BL-051a Lifecycle (BL-017+BL-046) + BL-050 独立
- 5/7 13:55/13:40/13:10：BL-050 入 high / 孤儿清理 / BL-021 done + BL-049 立即切
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（high 1：BL-050；low 7 含新加自动 GIT_SHA；closed 3：BL-017/046/047；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
