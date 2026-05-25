---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-071-harness-cleanup BUILDING (0/10, fix_rounds=0) — v0.9.23 framework sediment + 12 决策 lock 全面重组
- A0 audit ✓ (docs/test-reports/BL-071-harness-audit-2026-05-25.md @ 8aa4ccd, 426 LOC 深读 + 12 决策点)
- A1 lock ✓ (5/25 3 批 12 决策 D1-D12 全 ack: D1/D2 保原名 banner + 同步 / D3 cowork 全清 / D4 planner.md 拆 3 文件 / D5 evaluator.md topic 重组 / D6 scope tag / D7 inline-merge / D8 sediment workflow header / D9 3 层入口 banner / D10 case 子目录 / D11 全做 5-day / D12 fix_rounds 计数 入 workflow)
- F001-F010 pending (F001-F002 cleanup / F003-F004 重组 / F005-F007 scope+subdir+规则正式化 / F008 31 条 sediment 写入 14h 核心 / F009 收尾 / F010 Reviewer Codex)
- 31 条 sediment: v0.9.22 archive 13 + BL-069 user-acked 3 + BL-070 user-acked 12 + audit §5 缺失 3
- 0 行业务代码改动 (framework + .auto-memory + harness-rules + docs/CHANGELOG only)
## ✅ BL-070 DONE (11/11, fix_rounds=4, prod=fc79f43) — Phase 4 完整完成 + 对外上线 ready
## ✅ BL-069 DONE（7/7, fix_rounds=1）/ BL-068 DONE（7/7, fix_rounds=3）/ BL-067 DONE（7/7）/ BL-066 DONE（9/9, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批
- 5/14 BL-066 决策点 + framework v0.9.21 沉淀
- 5/25 BL-070 done 方案 A: #9/#10 归 backlog；框架沉淀留专门 batch (用户 ack)
- 5/25 BL-071 12 决策点 D1-D12 全 lock（A1 phase 完成）— 用户 ack 全做 5-day phased
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. **BL-070 post-launch ops（5/25 ack 归 backlog）：** 24h 后跑 `ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh'` + 邀 ≥5 marketer prod dogfood 反馈 0 P0/P1；全过则 signoff §4 #9/#10 DEFERRED→PASS
## 角色 / Backlog (下批次候选 — BL-071 done 后)
- Phase 5：个性化学习 / AI 学到偏好 / Brief 模板库 / comparative query / skip-replace 写 DB
- BL-062 backlog：KOL data coverage gap 治理
- 真客户 onboarding 准备：db:seed 验证 + tenant cleanup + 监控仪表板
