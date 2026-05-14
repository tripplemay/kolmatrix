---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🔨 BL-066-campaign-detail-ai-main-panel BUILDING（5/9, fix_rounds=0, staging=432b219）
- F001-F005 ✅ → F006-F009 待做 / role_assignments=planner johnsong + generator Kimi + evaluator Reviewer
- F006 pre-impl audit @ b2ae0bb 等 Planner 裁决 (5 决议点: source 白名单 manual vs manual_legacy / runAvailableKols 删 / addButton i18n 清理深度 / 表格列结构 / fidelity assertion. Generator 建议 #1:C #2:A #3:C #4:C #5:B)
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
- BL-066 期间: planner=johnsong / generator=Kimi (本机 .agent-id=johnsong 临时代理) / evaluator=Reviewer (Codex)
- Backlog 20 条 / BL-066 后续 P0: BL-067 C3 双向 explainability / BL-068 B3 自然语言 refine / BL-070 二次清理
