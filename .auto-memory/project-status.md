<!-- TEMPLATE FILE: copy to .auto-memory/ via bootstrap.sh — agent 运行时读 .auto-memory/project-status.md，本文件不参与运行时加载 -->
---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ⚠️ BL-071-harness-cleanup VERIFYING-FAIL (7/10, fix_rounds=0, awaiting Generator fix) — 首轮 Reviewer 验收打回
- Codex Reviewer 5/25 首轮 F010 验收结论 FAIL：F001/F004-F009 PASS；F002/F003 退回 pending；F010 待复验
- blocker #1：F002 死文档清理 grep 命中此活状态文件（已在 fix-round 1 改写描述避免字面命中）
- blocker #2：F003 planner 拆分活规则 cross-ref 未完全迁移；role-context + 3 子文件仍含旧路径字面（已在 fix-round 1 修）
- 关联报告：`docs/test-reports/BL-071-verifying-2026-05-25.md`
- 其余已通过：bootstrap.sh temp bootstrap / JSON valid / checklists subdir / evaluator §13 / generator Suspense 合并段 / proposed-learnings header / CHANGELOG↔archive
- 关联：framework/CHANGELOG.md v0.9.23 段 + framework/archive/proposed-learnings-archive-v0.9.23.md（31 条全文 + 11 结构变更 detailed before/after）
- 0 行业务代码改动（framework + .auto-memory + harness-rules + docs/CHANGELOG only）
- git tag bl071-before-{planner,evaluator}-restructure 留 rollback 锚点
## ✅ BL-070 DONE (11/11, fix_rounds=4, prod=fc79f43) — Phase 4 完整完成 + 对外上线 ready
## ✅ BL-069 DONE（7/7, fix_rounds=1）/ BL-068 DONE（7/7, fix_rounds=3）/ BL-067 DONE（7/7）/ BL-066 DONE（9/9, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批
- 5/14 BL-066 决策点 + framework v0.9.21 沉淀
- 5/25 BL-070 done 方案 A: #9/#10 归 backlog；框架沉淀留专门 batch (用户 ack)
- 5/25 BL-071 12 决策点 D1-D12 全 lock（A1 phase 完成）— 用户 ack 全做 5-day phased
- 5/25 BL-071 F008 31 条 sediment inline-merge（D7 强制规则首次大规模应用，3 组合并段 #29+#30 / #12+#21 / #25+#26）
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. **BL-070 post-launch ops（5/25 ack 归 backlog）：** 24h 后跑 `ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh'` + 邀 ≥5 marketer prod dogfood 反馈 0 P0/P1；全过则 signoff §4 #9/#10 DEFERRED→PASS
## 角色 / Backlog (下批次候选 — BL-071 done 后)
- ★ **BL-072 prod hotfix (5/25 audit + A1 lock 完成, audit doc docs/test-reports/BL-072-prod-hotfix-audit-2026-05-25.md)：** 4 issues (3 P1 + 1 P2) — /brief 宽度 + /insight i18n + Material Symbols table_rows + 10 处 IA outbound stale links. 8 features ~20-25h. 顺序 C / 范围 A 完整版 / brand kept-en / link 目标 A 已全 lock. 真客户立刻遇到, BL-071 done 后立即起.
- Phase 5：个性化学习 / AI 学到偏好 / Brief 模板库 / comparative query / skip-replace 写 DB
- BL-062 backlog：KOL data coverage gap 治理
- 真客户 onboarding 准备：db:seed 验证 + tenant cleanup + 监控仪表板
