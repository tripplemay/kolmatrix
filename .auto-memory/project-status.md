---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B5-kol-data-enrichment** — building 3/5 done (F001/F002/F003 ✅ CI 全绿 pushed to main)
- 待完成：F004 KOL 详情页（banner+6videos+wordcloud；engagementRate lazy-load 移除→BIx F004 batch 接管） / F005 i18n:translate + UI polish + Codex 守门 tests / Staging deploy

## ⚠️ F004 待 Planner 裁决
- spec §F004 #5 写「Audience tab 4→3」但 KolTabsNav 现有 tabs=overview/collabs/contacts/ai (NO audience tab)。建议下一位 Generator 先发 pre-impl audit（详 progress.json.generator_handoff）

## ⚠️ F005 必做项
- 跑 i18n:translate 后 REMOVE 14 个 discovery.filters.{channelAge|uploadFrequency|regionGroup}* paths from KEEP_AS_EN_PATHS in tests/unit/i18n-locale-coverage.test.ts

## 即将启动批次（按序）
- **MVP-internal-demo-prep** (B5 done 后, 7 features ~3 day) — `docs/specs/MVP-internal-demo-prep-spec.md`
- **BIx-mvp-polish-pass** (MVP done 后, 4 features ~3.5-4.5 day, 含 YouTube sync 配额优化 + Top-100 真 engagement batch) — `docs/specs/BIx-mvp-polish-pass-spec.md`

## 角色分配
- Planner: johnsong / Generator: johnsong / Evaluator: Reviewer

## 关键决策（详见 docs/adr/）
- ADR-001/002/007/009/010 沿用
- 2026-04-30 用户决议：MVP 受众=团队内部 / 单 Demo Studio tenant 共用现有账号（零技术债）/ 不做 mobile / sync P1 ~89% 配额 + batch engagement 替代 lazy-load

## Backlog 剩余（9 条 deferred/low）
BL-003 / BL-011 / BL-012 / BL-014~019（i18n质量 / visual regression / 真 PDF / share token / 全量 edge states / mobile）

## MVP 上线时间线
- ~05-04 B5 done + prod redeploy / ~05-07 MVP-internal-demo-prep done / ~05-12 BIx-mvp-polish-pass done → 团队内部 demo ⭐ / B8 邀请发出第 2 周

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
