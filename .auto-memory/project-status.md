---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-067-explainability-c3 BUILDING（1/7 ✅ F001 @ dd7870c, fix_rounds=0, spec=9a78c2d Planner 修订版）
- ✅ F001 (6h actual) aigcgateway 2 action + run-action.ts SDK (9 unit tests) + prompt design doc + SSH 落 env vars (prod+staging additive append) + staging deploy run 25903337133 git_sha=dd7870c
- F001 actions: short=cmp6ifb5w0035bnrrljflmtcn / detailed=cmp6ihdt109jebnrqdj215aft (haiku-4.5, dry_run est. 1450/1650 input ≤ 2000 ceiling)
- F002 (8.5h) asset 缓存层 + checkLlmCostBudget 包装 + AssetType migration + cleanup cron 06:30 BJT → F003 (4h) panel C2→C3 + `?` icon → F004 (8h) DetailedDialog → F005 (12h) InMemoryJobQueue fire-and-forget worker (audit #4:B) → F006 (8h) i18n + e2e 6 case → F007 (4h) staging + 视觉 baseline + cost 监控 + signoff
- 6 议题 F001 audit 全 ack 默认 #1-#6:A 或 #4:B，详 9433bc3
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210, signoff=BL-066-signoff-2026-05-15.md）
- F001-F009 ✅ Generator 段 → Reviewer 接手 24h pm2 monitor + 终签 (BL-065 加速模式可省略 24h)
- F009 @ 09:21 prod deploy run 25895017122 / 09:25 prod recompute apply (1397 rows / spread 52 / audit_log id=2617) / 09:58 prod-audit script PASS=11 FAIL=0 WARN=0 (v1→v5 5 次 fix: §6 audit_log 表名 + §5 grep deprecated marker filter + §1 ancestor-on-main + origin/main detached HEAD + SIGPIPE capture-then-grep). 同会话 b115367/f2a8210 修 CI 红: visual-regression viewport-only fix + woff2 regen + EXPECTED_BASELINES sync (en-match.png width=1332)
- F008 @ f29344b 新 tests/e2e/campaign-match-flow.spec.ts 6 case + 移除 BL-064 sediment /campaigns/[id] → /match?campaignId 302 redirect
- F007 @ 71c6ef0 value-score v2 公式 + ADR-014 + recompute TS 脚本 / staging recompute apply @ audit_log id 670 (3891 rows 13.7s spread 49-100) / Planner #7=B 重裁决 (用户 ack 选项 i): 全 dataset spread 51 ≫ 5 + top-15 最小 follower 1.72M ≫ 100K / prod recompute 留 F009 per #8=C
- F006 @ ba0c5fc git mv CampaignKolPanel→AcceptedKolsPanel + 6 列 read-only + source chip 独立列 (AI/CSV/Legacy) + view-profile open_in_new + backfill migration UPDATE 10 rows manual→manual_legacy + 删 runAvailableKolsForCampaign + i18n 5 locale 新 keys + deprecated marker / F006 audit 裁决 `#1:C #2:A #3:C #4:A #5:B` (Planner johnsong @ a682cde, 仅 #4 偏离 Generator 建议 — Table.tsx 实测 fully flexible 无 col cap, 6 列 README 字面安全) / v0.9.22 候选: Generator audit 起草前实测原子组件 surface 字面
- F002 audit 裁决 `#1:A #2:B #3:B #4:B #5:C` + #6 (Planner johnsong @ e2d6b71)
## ✅ BL-065 DONE 7/7 prod=c5b5c31 + BL-065-R1=4562895 + signoff 5/14
## ✅ BL-064 prod=9b1b15b / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批 (本 batch F007)
- 5/14 BL-066 4 决策点：#A 复用 smart-match endpoint / #B 完全删 AddKolDialog / #C BL-048 同 batch / #D Stitch 新建
- 5/14 BL-066 F002 audit 5 决议：限现字段派生 / skeleton 不调 smart-match / deprecated marker 不删 / 白名单 contactedCount / F006 不动底部
- 5/14 framework v0.9.21 沉淀（i18n template / IA redirect scope / 删除批次 CI 多轮自修 / Reviewer L1+角色门禁）
## 用户手工待办
1. 5/17 第一次 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
## 角色 / Backlog
- BL-067 building: role_assignments=null 默认映射 (cli=planner+generator johnsong / codex=evaluator); 历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Backlog 20 条 / Phase 3 后续: BL-068 B3 自然语言 refine / Phase 4: BL-069 Brief / BL-070 Insight unify + 二次清理
