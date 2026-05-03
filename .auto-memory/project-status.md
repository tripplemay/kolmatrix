---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-027 Asset Followup + Icon Hotfix + Framework v0.9.7 — DONE 2026-05-03
- 7/7 features Reviewer 首轮 PASS（fix_rounds=0）；signoff: docs/test-reports/BL-027-asset-followup-icon-hotfix-signoff-2026-05-03.md
- 主分支 HEAD: b8a368d；staging git_sha=65a2b60 == main building HEAD ✅；CI 8/8 PASS @ 65a2b60（run 25280391294）
- F002 woff2 9716→9976 bytes (+filter_alt + arrow_drop_down) / F003 case #7 反向 + 负向手动验证 / F004 hook 6 case PASS / F005 PR 2-of-N / F006 17 cases 闭 BL-026 S2/S3/S4 / F007 environment.md S10/S11
- 4 visual baseline 重生入 git；本机 npm test **783/783 = 100%**（罕见无 WSL flake）
- 5 Soft-watch 不阻塞：S1 spec 写 rules.md/实装 setup.md §9.5（持续坑）/ S2 DevTools 浏览器走查待用户 redeploy 后兜底 / S3 WSL Docker pgvector TLS timeout (CI testcontainers 已通) / S4 2 baseline 字节数没变 (mask 预期非 bug) / S5 Prod 仍 a9c4ef8 等用户 SSH redeploy
## ✅ BL-026 Asset UX Redesign — DONE 2026-05-03
- 6/6 features PASS；ADR-012 Outreach-First；S2/S3/S4 在 BL-027 闭；S10/S11 已修
## ✅ BL-025 素材中心 — DONE 2026-05-03
- 9/9 features PASS；ADR-011 统一 Asset 表 + EmailTemplate dual-write — 不动
## ✅ Framework v0.9.6 — DONE（v0.9.7 在 BL-027 done 后 Planner 处理）
## 用户手工待办（按优先级）
1. **BL-027 done 后 redeploy prod（高，icon bug 上线前阻塞）** — current a9c4ef8（含 icon bug），切 b8a368d 触发 deploy 修 icon + framework v0.9.7 4 层守门上线；redeploy 后 5min 手动浏览 https://staging.kol.guangai.ai/en/assets ActionBar 验 filter_alt / arrow_drop_down 渲染（非字面文字）
2. ~2026-05-09 BIx F004 staging YouTube sync 走查
3. @next/bundle-analyzer + Lighthouse 实测脚手架 → 推迟到独立小批次
## 关键决议（已 lock）
- BL-025 ADR-011 / BL-026 ADR-012 — 不动
- BL-027 four-layer 守门：CI case + pre-commit hook + PR template + manifest 叠加（icon bug 不能再发）
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI = planner+generator，Codex = evaluator
- Backlog 17 条：BL-020 high / BL-021 medium / BL-023 medium / BL-024 medium / BL-029-i18n（原 BL-027 重号已避） / BL-028 low / 余 11 deferred
- 时间线：05-03 BL-025+v0.9.6+BL-026+BL-027 ✅ → 05-04 BL-020 → 05-08~09 BL-024 → 05-13 上线对外（不变）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
