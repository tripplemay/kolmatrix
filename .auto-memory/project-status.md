---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-070-reach-insight-cleanup DONE (11/11, fix_rounds=4, prod=fc79f43) — Phase 4 完整完成 + 对外上线 ready
- F001-F007 done (路由迁移 + 二次清理 + e2e/visual baseline 重写) — 见 git log
- F008 done (acceptance 加 DEFERRED 注: #9 dogfood + #10 24h audit 归 post-launch ops backlog)
- F009 done (next/dynamic chunk-split 4 路由, TBT 攻关) @ bf15b62
- F010 done (9 raw img→next/image, LCP+CLS 攻关) @ 75acf1e+cadbda5
- F011 done (/match+/reach SSR Suspense stream, LCP 攻关) @ bf15b62+cadbda5
- Lighthouse fix-round 3 复验 4 路由 × 3 中位数: brief 98 / match 96 / reach 93 / insight 95；TBT/LCP/FCP/CLS 全门槛 PASS
- Reviewer L1+L2 全 PASS (2026-05-20 + 2026-05-25)；prod first-run audit 复核通过；signoff doc 终签 @ 本 commit
- 用户 2026-05-25 ack 方案 A: Planner Kimi 推 reverifying→done；#9/#10 归 post-launch ops backlog
- v0.9.23 候选累计 28 条 (BL-069 user-acked 3 + v0.9.22 archive 13 + BL-070 新 12)；留专门 framework sediment batch 落 framework/harness/*.md + CHANGELOG + archive
## ✅ BL-069-brief-page-merge DONE（7/7, fix_rounds=1）
## ✅ BL-068-conversational-refine DONE（7/7, fix_rounds=3）
## ✅ BL-067-explainability-c3 DONE（7/7, prod redeploy 待用户 ack）
## ✅ BL-066-campaign-detail-ai-main-panel DONE（9/9, fix_rounds=0, prod=f2a8210）
## ✅ BL-065 / BL-064 / BL-063 / BL-061-060-059 / BL-012 / BL-055-052-051a-049 / BL-021+023 / BL-043+044 全 DONE
## 关键决议（已 lock）
- 5/10 ADR-013 AI Native 转向 Phase 1-4 / BL-048 合入 Phase 2 第二批
- 5/14 BL-066 决策点 + framework v0.9.21 沉淀
- 5/25 BL-070 fix-round 2 方案 A: F009+F010+F011 全做 (用户 ack)
- 5/25 BL-070 done 方案 A: #9/#10 归 backlog；框架沉淀留专门 batch (用户 ack)
## 用户手工待办
1. 5/17 weekly growth-curve check（重跑 BL-061 F003 SQL）
2. fork 上游待修：Dockerfile @apify-kol/apify COPY + docker-compose ports default
3. **BL-070 post-launch ops（5/25 ack 归 backlog）：** 24h 后跑 `ssh tripplezhou@34.180.93.185 'bash /opt/kolmatrix/scripts/bl070-prod-audit.sh'` + 邀 ≥5 marketer prod dogfood 反馈 0 P0/P1；全过则 signoff §4 #9/#10 DEFERRED→PASS
## 角色 / Backlog (下批次候选)
- ★ framework sediment batch：28 条候选落 framework/harness/*.md + CHANGELOG + archive (优先级高)
- Phase 5：个性化学习 / AI 学到偏好 / Brief 模板库 / comparative query / skip-replace 写 DB
- BL-062 backlog：KOL data coverage gap 治理
- 真客户 onboarding 准备：db:seed 验证 + tenant cleanup + 监控仪表板
