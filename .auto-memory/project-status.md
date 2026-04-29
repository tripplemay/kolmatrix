---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B5-kol-data-enrichment** — status=building（2026-04-30 开工，F001 done）
- 5 features；F004 移除 lazy-load engagement → 由 BIx-mvp-polish-pass F004 batch 替代
- 估时 ~2.5-3.5 day Generator + Reviewer L1+L2

## 即将启动批次（按序，已 lock）

### MVP-internal-demo-prep (B5 done 后)
- 7 features：Dashboard 三元素 / Q5 Product zod / 5 Products seed / 团队 README / Prod L2 烟测 / Dashboard 真数据替 mock / 文案 polish（含登录页重写）
- ~3 day Generator + 0.5 day Reviewer
- spec：`docs/specs/MVP-internal-demo-prep-spec.md`

### BIx-mvp-polish-pass (MVP-internal-demo-prep done 后)
- **4 features**：/crm 3 disabled 控件清理 / misc 5 项 polish / 11 页 edge states / **YouTube sync 配额优化（P1 ~89% + 真 engagement batch）**
- ~3.5-4.5 day Generator + 0.5 day Reviewer
- spec：`docs/specs/BIx-mvp-polish-pass-spec.md`

## 角色分配
- Planner: johnsong / Generator: johnsong / Evaluator: Reviewer

## 关键决策（详见 docs/adr/）
- ADR-001/002/007/009/010 沿用
- 2026-04-30 用户决议：MVP 受众=团队内部 / 单 Demo Studio tenant 共用现有账号（零技术债）/ 不做 mobile / sync P1 ~89% 配额 + batch engagement 替代 lazy-load

## Backlog 剩余（9 条 / 全部 deferred 或 low）
BL-003 / BL-011 / BL-012 / BL-014~019（i18n质量 / visual regression / 真 PDF / share token / 全量 edge states / mobile）

## MVP 上线时间线
- ~05-04 B5 done + prod redeploy
- ~05-07 MVP-internal-demo-prep done + prod redeploy
- ~05-12 BIx-mvp-polish-pass done → 团队内部 demo 启用 ⭐ （+2 天 vs 原计划，含 sync 优化）
- B8 KOL 相似 + 跨语言：邀请发出第 2 周

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
