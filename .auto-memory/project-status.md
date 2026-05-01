---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---

# Project Status — KOLMatrix

**Last Updated:** 2026-05-01 (Reviewer round-2 fail)
**Sprint:** MVP-internal-demo-prep | **Status:** fixing | **fix_rounds:** 2

## Round 2 Outcome
- Prod SHA is aligned: `/api/health git_sha = 7af00b8` matches HEAD
- L1 + coverage + CI + Playwright journey smoke all passed
- Core blocker remains: Outreach AI customize returned `AI service could not respond. Please retry.`
- Weekly Report preview/share passed, but Download PDF was not verified in headless prod smoke

## Deploy Status
✅ Staging `7af00b8`: healthy
✅ Prod `7af00b8`: healthy / git_sha = HEAD
✅ Prod seed: 5 products, 10 KolCampaign rows, campaign-linked KOL emails present

## Verified Surfaces
- Dashboard, Discovery, Database, KOL detail, Knowledge Base, Campaigns, CRM, ROI
- Locale checks: EN / ZH / JA / ES
- Playwright prod smoke: `journey-a` and `journey-b`

## Open Blockers
- Outreach AI customize
- Weekly Report Download PDF verification

## Next Step
- Generator to fix Outreach AI service path and re-enter `reverifying`
