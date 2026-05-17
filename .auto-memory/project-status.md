---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-069-brief-page-merge BUILDING（4/7, fix_rounds=0, spec=cf2fdab, role_assignments=null 默认映射）
- ✅ F001 action=cmp9wbt7q05xjbno11fuoim9l v2 ✅ F002 brief-actions.ts 11 步 ✅ F003 /brief layout (BriefAiInputBar + CampaignForm forwardRef + diff hint + i18n 5 locale + 7 测) ✅ F004 ProductListPanel thin wrapper 复用 KB ProductsClient + deep link initialEditingProductId prop (lazy useState 替代 useEffect 避 set-state-in-effect lint) + 4 测 → F005 提交跳 /match + BL-067 prewarm (4h) → F006 redirect 3 条 + 5 i18n 老 KB 加 _deprecated_by_BL-069 + e2e 6 case (6h) → F007 staging + cost 监控 + signoff (4h)
- 8 决策点 5/17 全 lock：#1 ready-to-build / #2 完全 redirect 301 / #3 表单字段 + KOL prewarm / #4 表单 + 顶部 AI input bar / #5 全复用 v0.9.22 基础设施 / #6 product list 内嵌 + ?tab=products / #7 toast unparsable + 保留空表单 / #8 audit log raw brief
- 复用 v0.9.22 沉淀：runAigcAction SDK + checkLlmCostBudget + prompt v3 自检 § + silent fallback + 5 locale + dedupe-then-validate；F001 cost=$0.0046/call；5 用户 day + 5 prewarm = $1.75 meter (35% cap)
- F001+F002+F003 spec drift 自决 3 项 (F001 v1 prompt 超 ceiling→v2 裁剪 / F002 Product.id 是 cuid / Product.category 单字段→mapper wrap) + F003 用户 5/18 ack option B 新建 brief/CampaignForm 而非 git mv，forwardRef+useImperativeHandle 解耦 onParsed wire
- BL-067-F006 CI flaky inline fix (用户 ack option B): mockSmartMatch case 1+6，CI 8/8 全绿 ✓ 解锁 BL-069 CI 守门
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
- BL-069 building: role_assignments=null 默认映射 (cli=planner+generator johnsong / codex=evaluator); 历史 BL-066: planner=johnsong/generator=Kimi/evaluator=Reviewer
- Phase 3 全 DONE ✅ / Phase 4 building (BL-069 当前 + BL-070 后续 Insight unify + 二次清理) / 距对外上线 ~5 周; framework v0.9.22 沉淀 archive 完整 + harness/*.md 段落起草留下批次
