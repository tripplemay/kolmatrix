---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B5-kol-data-enrichment** — building 4/5 done (F001/F002/F003/F004 ✅，F004 #4 wordcloud DEFERRED — react-wordcloud peer deps incompat React 19)
- 待完成：F005 i18n:translate + UI polish + Codex 守门 tests / Staging deploy / F004 #4 wordcloud 选 React 19 兼容库（visx 或自写 d3-cloud SVG）→ 加入 backlog/follow-up batch

## ⚠️ F005 必做项
- 跑 i18n:translate 后 REMOVE **19** 个 paths from KEEP_AS_EN_PATHS in tests/unit/i18n-locale-coverage.test.ts:
  - 14 个 F003: discovery.filters.{channelAge|uploadFrequency|regionGroup}*
  - 5 个 F004: kolProfile.hero.bannerAlt / kolProfile.overview.field{ChannelAge|VideoCount} / kolProfile.recentVideos.{title|empty}

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
