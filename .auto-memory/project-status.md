---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 当前批次
- **MVP-kol-seed-redo** — status=verifying（2026-04-27 Generator 完成 6/6）
- 进度：6/6 features completed，fix_rounds=0
- 等待：Reviewer 首轮验收

## Generator 产出关键证据
- F001/F002 path-1：YouTube live 爬 760 channels（quota-bound at 8K of 10K daily）→ docs/kol-seed-youtube-2026-04-27.json
- F002 path-2 gaming：enriched 415 entries 全扫 → 50 real_kol（12%）→ docs/kol-seed-enriched-validation-2026-04-27.json
- F002 path-2 nongaming：sample 600/2109 → **54 real_kol（9% AI false-negative）** → docs/kol-seed-enriched-validation-nongaming-2026-04-27.json
- F003：staging 导入 760，DB total Kol 2535→3295，metadata.is_demo=true 760，10 categories
- F003 schema：新 metadata jsonb column + 部分索引（用户 14:46 选 A），rollback SQL 完整
- F006：glass-panel halo 删除 + visual baselines 重捕（13 张 7 张更新）
- 全测试：475 unit + 234 integration = 709 specs 全绿

## ⚠️ Spec 缺口 + Audit 发现（待 Reviewer 评估）
- F002 总数 760 < ≥1000（YouTube quota 50 results/page 上限）
- F002 中文区 country=CN+HK+TW=83 < ≥200（结构性：YouTube 无大陆账号）
- AI 打标 9% false-negative：50 (gaming) + 54 (nongaming sample) = 104 已确认 real_kol 未导入；外推 nongaming 全量 ~190 漏识别
- 选项：fix-round 重跑 3-page + nongaming 全扫 / 接受 + follow-up batch 回收 / 全转 backlog

## 已验证
- staging /api/health healthy（git_sha=be764a7）
- DB migration applied + Prisma 重生成 + PM2 reload
- Cleanup query `DELETE FROM kol WHERE metadata->>'is_demo'='true'` 实证 519 删除 12 保留

## 角色分配
- planner=Kimi / generator=johnsong / evaluator=Reviewer

## 下一步
- Reviewer L1（typecheck/lint/unit/integration）+ L2（staging /en/discovery /zh/database 浏览器 spot check）
- 用户决定 spec 缺口处理后切 done / fixing / backlog
