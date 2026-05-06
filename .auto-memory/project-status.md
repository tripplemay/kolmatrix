---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-044 — DONE 19:10 first-round PASS 4/4（2h40min 交付）+ Prod walk 12/12 PASS @ Codex
- signoff: docs/test-reports/BL-044-discovery-ai-semantic-search-signoff-2026-05-06.md
- prod walk: docs/test-reports/prod-browser-walk-2026-05-06.md（chip 22 KOL / 自由文本 14 KOL / sidebar disabled / sort inert / ?ai+search 互斥 / BL-040 校验 / BL-024 Add+Import+Export inject safe）
- 3 数据 gap（非 bug）：weekly-report lastWeek/Month 内容同 / outreach/suppression 空 / roi KPI $0
## ✅ Prod 13 项验证 PASS @ 19:30（用户授权 read-only DB+endpoint+logs；不含 UX）
## 🐛 孤儿 campaign 4425e07e 诊断完成（5/6 19:55）— BL-046 入 backlog high
- "王者荣耀世界 5 月推广计划 A" status=completed product_id=NULL；根因：用户 4/29 创建 product → campaign 关联 10 KOL → 4/29~5/2 删 product (hard delete) → FK SET NULL 沉默拉链 → 孤儿
- 6 设计 gap：product 无 deleted_at / FK SET NULL 沉默 / deleteProduct 不查关联 / 不写 audit_log / UI 无防御 / Prisma optional vs app required
## 🚧 5/13 上线对外规划（6 决议 lock；5 mini-batch + X1 合并）
- 5/9 周六：BIx F004 触发（Top 100 engagement batch 后台跑批）→ BL-023 unblock
- 5/10 周日：**BL-023 KOL 评分升级 + F007 BL-045**（X1）6-7h
- 5/10末~5/11：**BL-043 deploy-staging.yml 闭合**（0.5 day）
- 5/11 周一：CSP+NULLIF 1 周观察期满评估 + **BL-021 Suspense critical 5 路由**（~2h）
- 5/12 周二：**BL-017 token 过期+撤销**（~1 day）+ **BL-046 product soft delete**（~1 day，独立或合并待定）
- 5/13 周三 ⭐ 上线对外
## 用户手工待办
1. ~~prod redeploy + 12 处浏览器 walk~~ ✅ DONE @ Codex 5/6（12 PASS）
2. **CSP/NULLIF 5/11 满期** + **BL-035 真客户邮件触发再验** + **5/9 BIx F004 触发**（BL-023 unblock）
## 关键决议（已 lock）
- 5/6 19:55：BL-046 孤儿 campaign 治本 1=D 短期不修 + 2=A 5/13 前做（与 BL-017 同期）
- 5/6 19:50：5 决议 X1 合并 + 2:BL-023后立即 + 4:A + 5:A
- 5/6 16:30：BL-044 pre-impl 12 决议「A 全 Accept」+ spec 7 处修订
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 18 条（high 5：BL-017/021/023/043/046；low 6；deferred 7）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
