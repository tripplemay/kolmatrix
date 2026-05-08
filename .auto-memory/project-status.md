---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---
## 🟠 BL-012-apify-kol-integration FIXING fix-round 2（5/8 19:00 用户 prod 报 F002 zod schema mismatch / 14 features 7 done）
- Stage 1.5 + F006a 全 done (signoff @ f2f5dbb + reverify @ d130bac)，但 prod 真数据触发 F002 zod 41 fields error (externalUrls + aggregatorLinks shape mismatch)
- 决议 1A (union 类型) / 2A (fix-round 2 不切批次) / 3A (v0.9.19 候选加 proposed-learnings.md)
- 修复范围: ApifyKolItemSchema externalUrls 改 z.array(z.union([z.string(), z.object({url, title})])) / aggregatorLinks 改 z.union([z.record, z.array, z.null]); +2 单测; ~20min G + 10min R
- Stage 2 (F007-F013) 仍等用户决策门 4/4 通过
## ✅ BL-055 DONE / BL-052 DONE / BL-051a DONE / BL-049 DONE / BL-021+BL-023 DONE / BL-043+BL-044 DONE
## 🆕 BL-054-flaky-test-isolate medium / BL-056-notifications low post-MVP
## 待办
1. BL-012 §4.6 数据累积后再评估 Stage 2
2. F003 cron 行 ops（若仍需）由后续批次处理
3. 用户如需，可触发 Stage 2 规划 / re-check
