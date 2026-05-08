---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## ✅ BL-012-apify-kol-integration DONE 5/9 00:43（Stage 1.5 + F006a + Stage 2 综合 signoff PASS / A- / Ready）
- features 14/14 completed / fix_rounds=2（Stage 1.5 admin role + zod schema union）/ signoff @ b61ac4f
- L1: lint 0 / tsc 0 / **159 files 1131 tests PASS** + Stage 2 32 unit + 5 IT + Staging smoke 全 PASS
- 关键产出：apify-kol service 部署 + 30 cron schedules + Stage 1.5 admin preview 页 + sidebar 入口 + Stage 2 KolSyncAdapter (apify-kol.ts) + dispatcher 双源 (youtube-api-daily + apify-kol) + quality.ts source 严格过滤
- v4 决议绕过 §4.5.4 决策门 (1/4 passed) 启动 Stage 2，metadata.source='apify-kol' 隔离作后续清理 option，BL-058 跟踪 4 维度迭代
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low / BL-058-apify-data-quality low post-MVP
## 🚀 5/13 上线对外（buffer 4 天充裕）
- 5/9 当日 ⭐ 触发 prod redeploy 含 Stage 2 (HEAD b61ac4f) — 关键路径
- 5/9 02:00 UTC = 10:00 北京 §4.7 cron 第一次触发 → 100-300 KOL/天累积 → 1 周 1-3k KOL
- 5/15 Planner SSH §4.8 seed_expansion → 决议门预期 4/4 通过
- 5/13 ⭐ 上线对外（含全部 BL-049+051a+052+055 + BL-012 完整 v5）
## 用户手工待办（按优先级）
1. **触发 prod redeploy 含 Stage 2**（GitHub Actions UI dispatch HEAD b61ac4f）— 关键
2. 反馈爬虫团队 5 个 fork bug（lockfile / ports 硬编码 / X service 端未接通 / docs union shape / admin route X enum）
3. 5/9 上午观察 fork /admin/stats 数据累积（cron 第一次跑后）+ 5/15 ack §4.8 seed_expansion
4. revoke classic PAT + F003 cron 行 ops（kpi-snapshot:daily / kol-sync:daily SSH 落 prod+staging，BL-052 遗留）
5. 决定下一批次方向（BL-054 / BL-056 / 用户提其他）
## 关键决议（已 lock）
- 5/9 00:43 BL-012 Stage 2 综合 signoff PASS @ b61ac4f
- 5/8 21:30 §4.7 30 hashtag schedules SSH ops + 22:00 Stage 2 Generator 接力开工
- 5/8 19:30 BL-012 v4: 4B 绕过决策门启动 Stage 2 / v5: 21:00 §4.7 §4.8 修订
- 5/8 v0.9.16-v0.9.19 framework 沉淀（P5.2 / 记忆陈旧 / role enum / external API zod schema）
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条 / framework 实物核查 6-layer 完整
