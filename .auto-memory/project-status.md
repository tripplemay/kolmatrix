---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔧 BL-067-explainability-c3 FIXING（7/7 Generator ✅ + Reviewer 发现 staging 阻塞, fix_rounds=1）
- ✅ F001 @ dd7870c | F002 @ a39087c | F003 @ cdebf38 | F004 @ a6aa58a | F005 @ 4e2afb4 | F006 @ e06c56f | F007 generator @ fbc836a
- Actions: short=cmp6ifb5w0035bnrrljflmtcn / detailed=cmp6ihdt109jebnrqdj215aft (haiku-4.5, $48.16 余额, 0 LLM calls 至本 commit)
- Tests: 52 unit + 6 e2e / L1 全绿 every commit / cleanup cron 22:30 UTC = 06:30 BJT scheduled / staging git_sha = main HEAD
- 6 audit 裁决代码层 grep 验证 ✅ (#1:A cost-cap.ts:133 / #3:A worker:43 / #4:B prewarm-actions:81-85 / #6:A run-action.ts:141 复用 fetchWithRetry+parseFencedJson)
- Codex 接手清单 docs/test-reports/BL-067-staging-spot-check.md (§1 ≥5 game cat campaign × short / §2 ≥3 detailed dialog / §3 5 locale / §4 cap 模拟 / §5 perf gate / §6 chaos / §7 BL-066 回归 / §8 24h cost / §9 signoff 触发)
- status verifying → fixing @ 16:45 BJT 本轮复验，role_assignments=null 默认映射 codex 继续接手
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210, signoff=BL-066-signoff-2026-05-15.md, prod-audit PASS=11/FAIL=0/WARN=0）
- F009 prod deploy + recompute apply (1397 rows spread=52, audit_log 2617) + audit script v1→v5 5 次 fix / F008 e2e 6 case + redirect 移除 / F007 value-score v2 + ADR-014 / F006 AcceptedKolsPanel 重构 + source chip + backfill / F002 三段 layout 重写
- 3 audit 裁决: F002 #1A#2B#3B#4B#5C+#6 @ e2d6b71 / F006 #1C#2A#3C#4A#5B @ a682cde / F007 #1A#2B#3A#4B#5A#6A#7B#8C @ 1fc4d52
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
- BL-067 verifying: role_assignments=null 默认映射 (codex=evaluator 接手); 历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Backlog 20 条 / Phase 3 后续: BL-068 B3 自然语言 refine / Phase 4: BL-069 Brief / BL-070 Insight unify + 二次清理
