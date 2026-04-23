---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **BM1-console-kol-core** — status=**done**（9/9 完成，fix_rounds=2）
  - Signoff: `docs/test-reports/BM1-console-kol-core-signoff-2026-04-23.md`
  - 最终复验（staging）：`bm1-flow` 连续 2 次 PASS；`marketer-dashboard` 4/4 PASS
  - smoke：`/api/health` healthy；locale redirect（zh/en）正常

## MVP 现状
- 前置批次已完成：B0 / BI1 / BI2 / BI3 / BAux1 / BI4 / BM1
- BM2 spec 已存在：`docs/specs/BM2-campaign-outreach-roi-spec.md`
- PRD v1.0 与 §13 决策已锁定

## 关键遗留
- visual regression 新 baseline（BM1 相关）仍待在 linux runner 上 `--update-snapshots` 生成并入库

## 角色与环境
- BM1 角色分配已在 `progress.json` 清空（done 阶段）
- 生产 DB `kolmatrix` / staging DB `kolmatrix_staging`
- aigcgateway: `https://aigc.guangai.ai/v1`
