---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---

# Project Status — KOLMatrix

**Last Updated:** 2026-05-01 (johnsong fix-round 2)
**Sprint:** MVP-internal-demo-prep | **Status:** reverifying | **fix_rounds:** 2

## Reviewer 复验后两条 High 已修
- **A-03 SHA mismatch** 自然消解（prod 重新部署 → e2ac714 = HEAD）
- **C-10 round 2** 真修：seed.ts (a) KOL upsert 在 create + update 都设 email='${handle}@demo.kolmatrix.local'；(b) 新 KOL_CAMPAIGN_SEEDS 映射写 10 KolCampaign rows（HoK 3 + Genshin 4 + PUBG 3）；(c) status 分散 contacted/pending/quoted；findFirst+create 幂等

## Deploy Status (2026-05-01 fix-round 2)
✅ Staging e2ac714: healthy / **kolCampaignRowsCreated=10** / campaignsLinkedToProducts=3
✅ Prod e2ac714: healthy / git_sha = HEAD (resolves A-03)
✅ Prod seed log: products=5 / kolCampaignRowsCreated=10（C-10 端到端前置已就绪）

## Visual Baselines (commit e2ac714)
- en-campaign-detail.png 重生（112KB → 157KB，含新 KOL 列）
- dashboard.png 无 diff

## Ready for Reviewer Round-2 Reverify
- F005 checklist: docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md
- 复验重点: A-03 SHA / C-10 端到端 / 5 NOT RUN 项（E-01 + F-02 + G-04 至少补）
- 报告路径建议: docs/test-reports/MVP-internal-demo-prep-reverifying-2026-05-01-round-2.md

## Backlog
9 entries: BL-003/011/012/014/015/016/017/018/019 + BL-020/021/022 (all Post-MVP)
