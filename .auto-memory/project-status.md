---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-044 /discovery AI Semantic Search — DONE 2026-05-06 19:10（first-round PASS 4/4，fix_rounds=0；2h40min 闪电交付）
- signoff：docs/test-reports/BL-044-discovery-ai-semantic-search-signoff-2026-05-06.md（Codex 完整 L2：chip + 自由文本 + sidebar disabled + sort inert + ?ai/?search 互斥）
- staging 实测 3 行 ai.usage（FPS creators / 男主播 / 王者荣耀 chip 全 50 KOL 命中；recordAiUsage extras 字段全）
## ✅ Prod 待办批量验证 13 项 PASS @ 19:30（用户授权 read-only DB+endpoint+logs）
- BL-040 NOT NULL / Pokemon Go 4 套 published + audit_log / BL-035 svix 401 / PII 0 hits / cost-cap 1 行 prod ai.usage / NULLIF policy / CSP 6 header / rate-limit / 13 表 RLS / 4 路由 200
## 🚧 5/13 上线对外规划（5 决议 lock @ 19:50；4 mini-batch + X1 合并）
- 5/9 周六：BIx F004 触发（Top 100 真 engagement batch 后台跑批）→ BL-023 前置 unblock
- 5/10 周日：**BL-023 KOL 评分升级**（valueScore 真信号 + Smart Match 区分度 + F007 顺手清 BL-045 = X1）6-7h Generator
- 5/10末~5/11：**BL-043 deploy-staging.yml 闭合**（KOLMATRIX_APP_PASSWORD 落地 + environment.md 文档化）0.5 day
- 5/11 周一：CSP+NULLIF 1 周观察期满评估 + **BL-021 Suspense critical 5 路由**（dashboard/discovery/campaigns/roi/weekly-report，~2h，感知首屏 -300~800ms）
- 5/12 周二：**BL-017 token 过期+撤销**（接客户前必须，~1 day）+ 上线前最后检查
- 5/13 周三 ⭐ 上线对外
## 用户手工待办（按优先级）
1. **prod redeploy + 12 处浏览器 walk**（BL-040 / BL-044 6 项 / BL-024 5 处）— commit a301698；ops 工具 scripts/admin-reset-password.ts 应急可用
2. **CSP/NULLIF 1 周观察 5/4→5/11 满期** + **BL-035 真客户邮件触发再验证** + **5/9 BIx F004 触发**（BL-023 unblock）
## 关键决议（已 lock）
- 2026-05-06 19:50：5 项决议 X1 合并 + 2:BL-023后立即 + 4:A + 5:A — 4 mini-batch 时间线
- 2026-05-06 16:30：BL-044 pre-impl 12 决议「A 全 Accept」+ spec 7 处修订
- 2026-05-06 16:00：dead code A backlog / v0.9.14 #1+#2 Accept
## 角色 / Backlog / 时间线
- 默认映射（role_assignments=null）：CLI=planner+generator，Codex=evaluator
- Backlog 17 条（high 4：BL-017/021/023/043；low 6：BL-011/014/015/018/027/045；deferred 7：BL-003/012/016/019/022/026/042）

<!-- 写入规则（harness §记忆分层）：覆盖写 / ≤30 行 / 所有角色可写 / 只放 WHAT / 不重复 progress.json -->
