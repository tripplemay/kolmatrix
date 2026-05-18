---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ⏳ BL-069-brief-page-merge REVERIFYING（7/7, fix_rounds=1, spec=cf2fdab, Generator fix-round 1 完成）
- ✅ 首轮通过项：staging sha=ec26ba6 对齐；dogfood 14 applied + 3 unparsable；brief→submit→/match 链路通过；parse rate 83.33% PASS
- ✅ B1 修复 (fix-round 1): middleware-helpers.ts IaRedirectRule 加 optional status field (default 302) + BL-069 3 条 = 301 + middleware.ts 用 rule.status + resolveIaRefactorRedirect 返 {path, status} + 13 case 单测 PASS + e2e ia-refactor-redirects.spec.ts REDIRECT_CASES 加 status field + assert response.status()
- ✅ B2 修复 (fix-round 1): BRIEF_FORCE_CAP_EXHAUSTED env flag staging-only 短路 cap fallback (严格 === 'true' 防 typo, audit forced=true) + docs/dev/bl069-cap-exhausted-simulation-runbook.md (备份+tee+pm2 reload+UX 验+清理) + 2 单测 (启用/'yes'非严格 regression guard)
- 📄 Reviewer 复验入口: curl -I /en/knowledge-base 应见 301 (B1) / 详 bl069-cap-exhausted-simulation-runbook (B2) / 24h parse rate 应仍 ≥80% / 写 signoff doc
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
- BL-069 reverifying: role_assignments=null 默认映射 (cli=johnsong fix-round 1 done / codex=Reviewer 复验)；历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Phase 3 全 DONE ✅ / Phase 4 BL-069 reverifying ⏳ (BL-070 后续 Insight unify + 二次清理) / 距对外上线 ~5 周
