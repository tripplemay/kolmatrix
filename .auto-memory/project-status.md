---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🚧 BL-083-yt-business-email-mapper PLANNING→building (0/7, fix_rounds=0) — KOL data 治理: YT business email mapper 接 + UI + outreach 优先
- A0 audit (6/04): fork 已自动解锁 219/722 YT KOL business email (Apify actor + 5/8 ship), KOLMatrix mapper 完全漏接 (kol.email 仅 6=0.8% vs 实际可拾 30%+)
- A1 lock (6/04): A 轻量 KOLMatrix-only (mapper+UI+outreach+backfill), 不做 B 主动 trigger (fork 已 auto-unlock, 剩 278 个未解锁多半 NO_EMAIL 非排队)
- 7 features: F001 mapper / F002 schema (emails JSONB + email_source) / F003 import upsert / F004 UI 3 页+filter / F005 outreach 优先级 / F006 prod backfill 219 / F007 Codex
- 依赖: BL-082 done ✅ + fork APIFY_API_TOKEN 已配 ✅ (dry-run 200 验证)
- 关联 docs/specs/BL-083-yt-business-email-mapper-spec.md
## ✅ BL-082-refresh-selector-rewire DONE (7/7, fix_rounds=1, tag bl082-done @ 133bbe0)
- prod refreshCount=251 (YT90/TT127/IG34) failedAdapters=0 404率=0% / staging refreshCount=253/0%404
- signoff: `docs/test-reports/BL-082-signoff-2026-06-05.md` (Reviewer 11:12 CST)
- fix_rounds=1: F007 verifying FAIL = date-dependent test 夹具 flaky (pickTieredRefreshIds dayOfYear%3 桶 + 单候选行 1/3 概率落空) → Generator 修 makeRefreshPrisma 返 6 行 → reverifying PASS
## ✅ BL-081-kol-country-data-fix DONE (6/6, tag bl081-done @ 7bfeacb)
- prod LLM 83/天 (acceptance <200), 成本 $0.075/天 (降幅 83% from $0.44 baseline)
## ⏸️ BL-080-landing-illustration-mockups PAUSED (1/6 @ ad14bdd) — 等用户跑 AI gen PNG
- 归档 docs/archive/paused-batches/BL-080-{progress,features}.json + RESUME.md
## ✅ BL-079 / BL-078 / BL-077 / BL-076 / BL-075 / BL-074 / BL-073 / BL-072 / BL-071 / BL-070 / BL-069-059 / BL-055-049 / 043+044 全 DONE
## 用户手工待办
1. TikHub 新 token 重发 (上次给 invalid, 旧 token 仍 working 不紧急)
2. 找爬虫团队对账 fork `0-discover` (5/27 + 5/31)
3. BL-080 素材就绪后恢复 landing illustration 批次
## Backlog
- BL-080 (paused, 等用户 PNG)
- refresh-selector 已 BL-082 完成 (无需独立批次)
- Phase 5: 个性化学习 / Brief 模板库 / comparative query
- BL-054 flaky network test isolate / BL-048 valueScore 区分度
