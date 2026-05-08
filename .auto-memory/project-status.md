---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟡 BL-059-youtube-deprecate-and-engagement-derive BUILDING（5/9 01:30 启动 / 7 features ~2-3h G + 0.5h R）
- 用户 5/9 brainstorming 决议 Q1=C/Q2=A/Q3=立即 derive+soft delete/Approach=A 单批次：KOL 数据源双源 → 单源 apify-kol，同时 mapper derive engagement_rate 替代 141 真信号
- 范围：F001 mapper derive + F002 全量 recompute apify-kol + F003 soft delete 2584 youtube-api-daily + audit_log + F004 删 youtube.ts/engagement-batch* + F005 dispatcher 移除 youtube + F006 文档/env 清理 + F007 L1+smoke
- spec @ docs/specs/BL-059-youtube-deprecate-and-engagement-derive-spec.md (422 行)；soft delete 30 天可恢复 + git revert 可逆；BL-058 长期跟踪
- 时间线：5/9 当晚 building→verifying→done→prod redeploy；5/13 上线含 apify-kol 单源 + cron 累积 ~500-1000 KOL
## ✅ BL-012 DONE 5/9 / BL-055 DONE / BL-052 / BL-051a / BL-049 / BL-021+BL-023 / BL-043+BL-044 全 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low / BL-058-apify-data-quality low post-MVP
## 🚀 5/13 上线对外（buffer 4 天充裕）
- 5/9 当晚 BL-059 done + prod redeploy 含 youtube-api-daily soft delete + apify-kol engagement_rate derive
- 5/9-5/13 cron 累积 + 用户业务测继承
- 5/13 ⭐ 上线（apify-kol 单源 + ~500-1000 KOL）
- 6/8（30 天 soft delete 后）评估硬删 vs 永久保留
## 用户手工待办（按优先级）
1. 启动 Generator 接力 BL-059 building（F001-F007 / ~2-3h end-to-end）
2. F002/F003 SQL ops + F006 VM env vars 清理需 Planner SSH 协助（你 ack 时机）
3. BL-012 prod redeploy 已含 Stage 2 ✅ 5/8 17:15；BL-059 done 后再 redeploy 含 BL-059
4. 反馈爬虫团队 5 fork bug + revoke classic PAT
5. 5/15 §4.8 seed_expansion（如 cron 累积达 ≥1k）+ fork 数据 4 维度迭代关注（BL-058）
## 关键决议（已 lock）
- 5/9 01:30 BL-059 spec lock：单源切换 + soft delete + derive engagement / 30 天可恢复 + BL-058 跟踪
- 5/9 00:43 BL-012 综合 signoff PASS @ 4712066（A-/Ready，14/14 features，fix_rounds 2）
- 5/8 §4.7 30 schedules SSH 创建 / v5 spec 修订 / v0.9.16-v0.9.19 framework 沉淀
## 角色 / Backlog
- 默认：CLI=planner+generator，Codex=evaluator / Backlog 19 条 / framework 实物核查 6-layer 完整
