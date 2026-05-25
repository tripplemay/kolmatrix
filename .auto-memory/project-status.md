---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🧪 BL-070-reach-insight-cleanup REVERIFYING (10/11, fix_rounds=4, local reverify PASS @ fc79f43)
- ✅ F001-F005 done (无变, 见 git log)
- ✅ F006 done (合并 e2e ec39157 + fix-round 1 always-skip 4 refine case a5a4cf1)
- ✅ F007 done (5-locale landing.* 完整 + parity 8/8 PASS @ fc71862)
- ✅ F009 done (75acf1e+bf15b62) — next/dynamic chunk-split 4 路由 (Reviewer fix-round 2 PASS)
- ✅ F010 done (75acf1e+cadbda5) — next/image migration; fix-round 3 解锁 /match CLS (0.348 → 0.0075 stable 3-run)
- ✅ F011 done (bf15b62+cadbda5) — /match + /reach Suspense defer; skeleton 高度/宽度像素级镜像实际组件
- 🧪 fix-round 3 修复定位: Lighthouse `cls-culprits-insight` 直指主网格下移; 根因 = QuickStatsSkeleton h-88px vs 实际 grid h-150px 的 62px 反差 → 整个 1039px 高工作区下移 → CLS 0.348. 修复: skeleton 重写为同 grid + 4×150px 卡槽; SaveSearchControlsSkeleton 加宽防 header wrap.
- 📏 Reviewer fix-round 3 复验结果: Lighthouse 4 路由 × 3 全 PASS；median = brief 98 / match 96 / reach 93 / insight 95；`/en/match` CLS 稳定 `0.008`，其余 3 条路由 CLS = `0`
- ✅ 定向 L1 复验通过：typecheck PASS / perf unit `29/29` PASS / targeted E2E `133 passed / 43 skipped / 0 failed`
- ⏸️ F008 仍 pending: 本地代码 blocker 已清空；剩余仅 prod redeploy + #9 ≥5 marketer dogfood + #10 24h audit + #11 prod git_sha + final signoff doc
- 🆕 v0.9.23 候选累计 ~10 条: fix-round 1 #21-24 + planner #25 + generator #26-30 (新增 #29 Suspense skeleton 必须像素级镜像实际外层结构 / #30 fallback 宽度在 flex-wrap 父容器下必须等宽防横向 reflow)
- 反思: F011 Suspense PR push 前未做 Lighthouse 本地 dry-run → Reviewer fix-round 2 才捕 CLS → 沉淀: Suspense 落地必配 Lighthouse Desktop logged-in 自测
- 本批次 reverifying done = Phase 4 完整 done = 4 路由 IA 闭环 = 对外上线 ready (距 ~2 周)
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3）
## ✅ BL-067-explainability-c3 DONE（7/7, prod redeploy 待用户 ack）
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批
- 5/14 BL-066 决策点 + framework v0.9.21 沉淀
- 5/25 BL-070 fix-round 2 方案 A: F009+F010+F011 全做 (用户 ack)
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. BL-070 F008: Reviewer fix-round 3 复验全 PASS 后 prod redeploy 触发 + 24h 监控 + ≥5 marketer dogfood + signoff
## 角色 / Backlog
- BL-070 reverifying: Reviewer fix-round 3 已通过，本地 gate 清空；等待继续执行 F008 prod-facing signoff
- Phase 3 全 DONE ✅ / Phase 4: BL-069 ✅ + BL-070 reverifying 🚧 10/11 / BL-070 done = 对外上线 ready
