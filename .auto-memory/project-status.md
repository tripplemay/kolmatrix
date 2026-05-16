---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-067-explainability-c3 DONE（7/7 Generator ✅ + fix-round 1 ✅ + Reviewer core+controlled PASS + signoff ✅, fix_rounds=1）
- ✅ F001-F007 + fix-round 1 commits f284d35/6dbe231/aa79ce0 (Next.js 16.2.4 Turbopack BUILD_ID bug → force --webpack staging+prod), staging healthy @ aa79ce0
- Codex 复验完成: cfc6808 reverify-round1 (T1-T5 core PASS) + e850193 controlled-verification (§4 cap / §6 chaos / §8 脚本 PASS, cost=0)
- 3 项 P5 裁决 5/16 用户 ack 落 spot-check.md §10: §1 5 cat→3 cat 降级 (staging seed gap, BL-070 backlog) / §5 perf 量化留 dogfood (BL-066 同模式) / §8 真 24h soak 加速省略 (脚本+cap+cost=0 sufficient, BL-065/BL-066 同模式)
- Reviewer signoff 完成: docs/test-reports/BL-067-signoff-2026-05-16.md (按 §10 §11 修订 acceptance + fix-round 1 + 3 caveats, 24h soak 按用户授权豁免), 切 reverifying → done
- prod redeploy 触发条件: 用户 ack 时间窗 (deploy-prod.sh 已自动应用 --webpack flag + Turbopack artifact cleanup, fix 已防御)
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
- BL-067 done: role_assignments=null 默认映射已结束; 历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Backlog 20 条 / Phase 3 后续: BL-068 B3 自然语言 refine / Phase 4: BL-069 Brief / BL-070 Insight unify + 二次清理
