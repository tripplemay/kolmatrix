---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BM2-campaign-outreach-roi** — status=reverifying（2026-04-26 18:30 Generator fix-round 1 完成），11/11，fix_rounds=1
  - 4 主修复：F006-002 seed 链调 / NAV-003 nav href→/outreach+/roi / HARNESS-004 codex-wait 3xx / F011-001 12 张 baseline PNG 入 git
  - 7 次生：lockfile 恢复 / spec.skip 尊重 update-snapshots / campaign-detail RSC 函数 prop / seed deterministic / CI E2E 拆 visual-first / discovery viewport-only / workflow mkdir defensive
  - 4 回归测试 file 沉淀；最终 CI 24954417129 全绿
- **BM1** ✅ done 9/9 fix_rounds=2 / 所有前置批次 ✅

## MVP 现状（4/4 达成，待 Reviewer 复验）
- 控制台 BM1-F007 / 筛选 BM1-F004-F006 / 联系 BM2-F005-F006 / ROI BM2-F008-F009 / AI 周报 BM2-F010
- Prod `4b05cb60` / Staging `c96fb98`

## 角色分配
- Planner Kimi / Generator johnsong / Evaluator Reviewer

## 关键决策
- AI 走 aigcgateway Action / Resend mock fallback / PDF print / 独立 WeeklyReport 表
- BM1/BM2 L2 强制 staging
- **MVP-visual-fidelity hotfix 批次** BM2 done 后启动
- **Visual baseline PNG in git 硬门槛**（已落地）
- **Seed deterministic 必须**（fix-round 1 沉淀：LCG + Date.UTC 固定 epoch）
- **CI E2E 拆两步**（fix-round 1 沉淀）：visual fresh-seed → 全套 grep-invert visual

## Backlog
- BL-001/002/003/004 + 新：discovery fullPage 长期根因待查（hydration async 层）

## 环境
- DB kolmatrix / kolmatrix_staging / Resend marketer@kolquest.com / aigcgateway admintest key
