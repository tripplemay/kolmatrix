---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B5-kol-data-enrichment** — building 4/6 done (F001/F002/F003/F004 ✅；F005 + F006 pending)
- 2026-04-30 二次 Planner 裁决 X+a：F004 #4 词云不再 deferred，分离到 F006 在 B5 内补做

## ⚠️ F005 必做项
- 跑 i18n:translate 后 REMOVE **22** 个 paths from KEEP_AS_EN_PATHS in tests/unit/i18n-locale-coverage.test.ts:
  - 14 个 F003: discovery.filters.{channelAge|uploadFrequency|regionGroup}*
  - 5 个 F004: kolProfile.hero.bannerAlt / kolProfile.overview.field{ChannelAge|VideoCount} / kolProfile.recentVideos.{title|empty}
  - 3 个 F006: kolProfile.topicCloud.{title|empty|loading}

## ⚠️ F006 关键信息
- 客户端库：**@visx/wordcloud + d3-cloud**（React 19 兼容；react-wordcloud 弃用 — peer deps incompat）
- aigcgateway Action `kol-topic-extract` (action_id `cmokr9z880009bn18sre31yf0`) 已 ready + dry-run PASS
- env var `AIGCGATEWAY_KOL_TOPIC_ACTION_ID` 待用户 SSH 落入 .env.staging + .env.production（Generator 在 PR 给指令）

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
