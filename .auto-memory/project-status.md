---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B7a-discovery-smart-match** — status=reverifying（2026-04-28 21:10 BJ）
- 进度：2/2 completed，fix_rounds=1
- role_assignments：planner=Kimi / generator=johnsong / evaluator=Reviewer

## fix-round 1 闭环（commit 948e3ef）
- 根因：smart-match.ts 用 unscoped prisma (app role) 做 embedProductIfStale UPDATE + 读 vector → RLS 把 product 行隐藏（无 tenant GUC）→ "unreadable"
- 修复：embed 读写改走 prismaAdmin（withTenant findUnique 已经验证了 tenant 归属）；prismaOverride 仍保留
- 回归测试：smart-match-api.test.ts 新增 "works without prismaOverride (production runtime path)" — 走真实 RLS 路径

## L1 + L2 验证
- L1：typecheck/lint + unit 87/577 + integration 6/6 全绿
- L2：staging /api/health git_sha=948e3ef，build + pm2 reload 完成

## 跨批次延迟项（不阻塞 done）
- B6-F006 #4 接力条款 day-5 验证 ~2026-05-03

## 候选沉淀
- 框架候选：集成测试必须包含 unscoped (app role) RLS 路径回归测试，避免 admin override 旁路 → database-patterns.md §3 候选

## 下游
- B7a done → B7b building（~05-01）→ MVP-demo-launch sprint → 邀请 ~05-13
