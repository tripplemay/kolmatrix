---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔁 BL-068-conversational-refine REVERIFYING（fix-round 3 完成 2026-05-17 20:10, spec=13d9794）
- ✅ fix-round 1: B1-B4 全修
- ✅ fix-round 2: prompt v2 (动态 N) 部分 — drift 29→31 收敛到 29→30 但仍不通过
- ✅ fix-round 3 真因 + 双层修复:
  - **真因** (通过 MCP get_log_detail trc_ew4fi0u4hihjdw07bu73xer3 抓出): LLM 返 30 IDs 是**重复 1 个已有 id** 凑足 30 (`8f93d2c0` 在 index 8 + 29), 不是幻觉新 ID. v2 prompt 明禁重复但 Claude Haiku 仍违反.
  - **Layer 1**: refine-actions.ts 加 dedupe-then-validate. LLM 输出有 dup 时先去重保 first-occurrence 序, 去重后 set == input set 即接受为 refine_applied (audit 加 deduped_count 字段监控). 仅当去重后仍偏离才落 permutation_invalid.
  - **Layer 2**: prompt v3 (version_id cmp9pak6g000dbno3canjkxxh) 加 §⚠️ '输出前自检 3 项' 块 + 末尾再加 1 段最后提醒. Self-check 显式引用 fix-round 3 的真实 trace 加压.
  - 单测 +1 dedupe case (LLM dup → server dedupe → refine_applied + audit deduped_count=1)
  - L1: lint 0 / tsc 0 / vitest 127 PASS (126 prior + 1 new)
- 部署: F002 source 改 → staging deploy 完整流程必跑. CI 应触发.
- **Codex 复验 (fix_rounds=3)**: 重发 B6 原 query 验 success toast / 跑 cost-audit 验 parse rate ≥ 80% gate / 关注新字段 deduped_count 监控 LLM 行为 / 完整 10+ dogfood → signoff or fix-round 4
- **CI 7/8 jobs PASS, E2E 仍红**（campaign-explainability-flow.spec.ts:101 / :280，属 BL-067 followup，不是本批新 blocker）
- **CI 7/8 jobs PASS, E2E 仍红**（campaign-explainability-flow.spec.ts:101 / :280，属 BL-067 followup，不是本批新 blocker）
- 8 决策点 5/16 全 lock：#1 ready-to-build / #2 /campaigns/[id] + /match 两处 / #3 重排现 top 30 / #4 toast unparsable + 保留现池 / #5 stateful localStorage 24h TTL / #6 audit log raw query / #7 全复用 BL-067 基础设施 / #8 顶部 inline input bar
- 复用 BL-067 沉淀：runAigcAction SDK (src/lib/aigc/run-action.ts) + checkLlmCostBudget (src/lib/ai/cost-cap.ts:133) + 5 locale JSON 模式 + silent fallback 哲学；cost 估算 5 用户 day = $1.25 meter (25% cap 利用率)
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
- BL-068 building: role_assignments=null 默认映射 (cli=planner+generator johnsong / codex=evaluator); 历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Backlog 20 条 / Phase 4 后续: BL-069 Brief 合并 / BL-070 Insight unify + 二次清理 / Phase 5 候选 (个性化学习 / skip-replace 写 DB / comparative query)
