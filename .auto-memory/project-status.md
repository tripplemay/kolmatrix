---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B5-kol-data-enrichment** — fixing（2026-05-01 Reviewer L2 FAIL）
- 当前阻塞仍是 topic cloud 不稳定：5/5 白名单里有 1 个样本仍只显示 empty state

## Reviewer 已完成
- 新增 B5 守门测试：
  - `tests/unit/b5-kol-detail-no-audience-tab.test.ts`
  - `tests/unit/b5-no-double-write-metadata.test.ts`
  - `tests/integration/b5-discovery-filter-combinations.test.ts`
  - `tests/integration/b5-topic-cloud.test.ts`
- 新增用例：`docs/test-cases/B5-kol-data-enrichment-cases.md`
- L1 复验 PASS：`typecheck` + 上述 4 个新测试 + `kol-discovery` / `import-kol-from-youtube` 相邻回归 + lint
- L2 路由 / Discovery / i18n 复验 PASS：dashboard/discovery/database 正常；高级筛选与 4 语 key 正常
- L2 白名单详情页部分 PASS：banner + recent videos + no audience tab；topic cloud 仍有 1/5 样本回落到 empty state

## 当前缺陷
- 5/5 白名单 YouTube KOL 详情页中，4/5 已出现 `kol-topic-cloud-canvas`
- 仍有 1/5 白名单 YouTube KOL 详情页保留 `kol-topic-cloud-empty`
- topic cloud 还未稳定达成“所有白名单样本都有 canvas”的验收目标

## 即将启动批次（按序）
- **MVP-internal-demo-prep** (B5 done 后, 7 features ~3 day) — `docs/specs/MVP-internal-demo-prep-spec.md`
- **BIx-mvp-polish-pass** (MVP done 后, 4 features ~3.5-4.5 day, 含 YouTube sync 配额优化 + Top-100 真 engagement batch) — `docs/specs/BIx-mvp-polish-pass-spec.md`

## 角色分配
- Planner: johnsong / Generator: johnsong / Evaluator: Reviewer

## 关键决策（详见 docs/adr/）
- ADR-001/002/007/009/010 沿用
- 2026-04-30 用户决议：MVP 受众=团队内部 / 单 Demo Studio tenant 共用现有账号（零技术债）/ 不做 mobile / sync P1 ~89% 配额 + batch engagement 替代 lazy-load

## Backlog 剩余（9 条 deferred/low）
BL-003 / BL-011 / BL-012 / BL-014~019（i18n 质量 / visual regression / 真 PDF / share token / 全量 edge states / mobile）

## MVP 上线时间线
- ~05-03 B5 done（F005+F006 完成 + prod redeploy 含 AIGCGATEWAY_KOL_TOPIC_ACTION_ID）
- ~05-05 MVP-internal-demo-prep done → 团队内部 demo ⭐
- ~05-10 BIx-mvp-polish-pass done

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
