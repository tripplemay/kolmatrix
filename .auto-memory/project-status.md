---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1, signoff=BL-069-signoff-2026-05-18.md）
- ✅ fix-round 1 复验通过：登录态 `/knowledge-base` / `/knowledge-base/[productId]` / `/campaigns/new` 均返回 `301`
- ✅ cap 模拟通过：`BRIEF_FORCE_CAP_EXHAUSTED=true` 命中 toast + 空表单 + audit `forced=true`，清理后正常 parse 恢复
- ✅ 24h parse gate：`17/21 = 80.95% PASS`
- 📄 Signoff: docs/test-reports/BL-069-signoff-2026-05-18.md / Soft-watch S1: 24h gate 边际通过 80.95% 仅高出阈值 0.95%, 继续观察 (medium 触发即 prompt 调优或 follow-up)
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3, signoff=BL-068-signoff-2026-05-17.md, 24h parse gate 16/20=80% PASS, deduped 35% LLM noise tolerated via server fallback）
## ✅ BL-067-explainability-c3 DONE（7/7 + fix-round 1 + signoff 2026-05-16, prod redeploy 待用户 ack 时间窗 deploy-prod.sh 已含 --webpack 防御）
- 3 项 P5 裁决: §1 5 cat→3 cat 降级 (staging seed gap → BL-070 backlog) / §5 perf 留 dogfood / §8 真 24h soak 加速省略
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
- BL-069 done: role_assignments=null 默认映射 (cli=johnsong / codex=Reviewer 已完成签收)；历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Phase 3 全 DONE ✅ / Phase 4 BL-069 done ✅ (BL-070 待启 — 项目近期最后一批 Reach + Insight unify + 二次清理) / 距对外上线 ~2-3 周 (BL-070 done 即可)
