---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **B5-kol-data-enrichment** — status=building（2026-04-30 开工）
- 5 features：schema +4 字段 / YouTube enrich / Discovery filter +3 维折叠 / KOL 详情页改造（banner + 6 视频 + 完整版词云 react-wordcloud） / i18n + 守门 tests
- 估时 ~2.5-3.5 day Generator + Reviewer L1+L2

## 即将启动批次（已 lock 决策，按序）

### MVP-internal-demo-prep (B5 done 后)
- 7 features：F001 Dashboard 三元素 / F002 Q5 Product zod / F003 5 Products seed / F004 团队 README / F005 Prod L2 烟测 / **F006 Dashboard EmailPerf+RecentActivity 真接 EmailLog/audit_log** / **F007 文案 polish**（campaigns AiSuggestionsCard + /api/health redis + Import 删）
- 估时 ~3 day Generator + 0.5 day Reviewer
- spec：`docs/specs/MVP-internal-demo-prep-spec.md`

### BIx-mvp-polish-pass (MVP-internal-demo-prep done 后)
- 3 features：F001 /crm 3 disabled 控件清理（time toggle real / Export CSV impl / Manual log delete）/ F002 misc 5 项 polish / F003 11 页 critical paths edge states
- 估时 ~2-2.5 day Generator + 0.5 day Reviewer
- spec：`docs/specs/BIx-mvp-polish-pass-spec.md`

## 角色分配（沿用近 13 批次）
- Planner: johnsong / Generator: johnsong / Evaluator: Reviewer

## 关键决策（详见 docs/adr/）
- ADR-001 Option α / ADR-002 技术栈 / ADR-007 多租户 RLS / ADR-009 aigcgateway / ADR-010 kolquest.com
- 2026-04-30 用户决议：MVP 受众=团队内部 / 单 Demo Studio tenant 共用现有账号（零技术债）/ 不做 mobile responsive

## Backlog 剩余（9 条 / 全部 deferred 或 low）
BL-003 / BL-011 / BL-012 / BL-014 ja/ko/es 翻译人审 / BL-015 visual regression 跨平台 / BL-016 真 PDF / BL-017 share token 过期 / BL-018 全量 edge states / BL-019 mobile

## MVP 上线时间线
- ~05-04 B5 done + 用户 prod redeploy
- ~05-07 MVP-internal-demo-prep done
- ~05-10 BIx-mvp-polish-pass done → 团队内部 demo 启用 ⭐
- B8 KOL 相似 + 跨语言：邀请发出第 2 周（PMF 叙事）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
