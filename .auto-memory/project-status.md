---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🧪 BL-070-reach-insight-cleanup FIXING (7/11, fix_rounds=2, perf 攻关 in-flight)
- ✅ F001-F005 done (无变, 见 git log)
- ✅ F006 done (合并 e2e ec39157 + fix-round 1 always-skip 4 refine case)
- ✅ F007 done (5-locale landing.* 完整 namespace + i18n parity 8/8 PASS @ fc71862)
- ✅ Reviewer 2026-05-20 L1 reverifying PASS (docs/test-reports/BL-070-reverifying-2026-05-20.md)
- 🧪 F008 partial: 4 自动化 §1-§4 PASS, 5 手动 §5-§9 + signoff PENDING; §10 #8 Lighthouse perf 75-78 < 80 (brief78/match75/reach75/insight75) 唯一硬阻塞
- 🆕 fix-round 2 启动 (Planner Kimi 2026-05-25, 用户 ack 方案 A): 新增 F009/F010/F011 perf 攻关 3 features, addendum spec @ docs/specs/BL-070-perf-optimization-addendum-spec.md
  - F009 high 12h: next/dynamic 拆 4 路由 client bundle (TBT 攻关, 单点最大杠杆)
  - F010 high 6h: 9 处 raw <img> → next/image (LCP + CLS 攻关)
  - F011 medium 8h: /match + /reach SSR Suspense stream defer 非主表 DB call (LCP 攻关)
- F009-F011 完成后 Generator 切 fixing→reverifying → Reviewer L2 跑 Lighthouse 复测 (4 路由 × 3 跑) + 续 F008 §9 dogfood + §10 24h audit
- 当前 staging healthy @ 05e5c1f, CI 全绿 run 26121789868
- v0.9.23 候选累计 7+1=8 条 (BL-070 sediment +1 from Kimi: perf 量化门槛应入 spec acceptance 而非 batch 末 retrofit); 合 Planner done 阶段集中沉淀
- 本批次 reverifying done = Phase 4 完整 done = 4 路由 IA 闭环 = 对外上线 ready (距 ~2 周)
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3）
## ✅ BL-067-explainability-c3 DONE（7/7, prod redeploy 待用户 ack）
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批
- 5/14 BL-066 决策点 + framework v0.9.21 沉淀
- 5/25 BL-070 fix-round 2 入场: F008 §10 #8 Lighthouse perf 75-78 < 80 触发 perf 攻关 3 features (方案 A 全做)
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. BL-070 F008: F009-F011 done 后用户 ack prod deploy + 24h 监控 + ≥5 marketer dogfood
## 角色 / Backlog
- BL-070 fixing: F009/F010/F011 待 Generator 接手 (按 F009→F010→F011 顺序, F009 单点最大杠杆优先)
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 fixing 🚧 7/11 / BL-070 done = 对外上线 ready
