---
name: project-status
description: 项目当前状态快照（覆盖写，≤30 行）— 当前批次、计划、决策、遗留问题
type: project
---

# Project Status — KOLMatrix

**Last Updated:** 2026-05-01 (johnsong Generator session)
**Sprint:** MVP-internal-demo-prep | **Status:** verifying | **Completed:** 7/7 features

## Completed Generator Features
F002 ✅ targetAudience zod | F007 ✅ copy polish | F004 ✅ demo README | F003 ✅ 5 products seeded | F006 ✅ dashboard real data | F001 ✅ WorkflowSteps + CPI + ROI cards

## Pending — Reviewer codex
F005 ⏳ Prod L2 smoke 34-item checklist → docs/test-cases/MVP-internal-demo-prep-prod-smoke-checklist.md

## Pre-verifying User Actions
1. SSH prod: git pull + npm ci + prisma migrate deploy + npm run db:seed + rebuild + pm2 restart
2. Verify `curl /api/health | jq .git_sha` = HEAD SHA
3. Trigger "Update visual baselines" GitHub workflow (dashboard.png deleted after F001)

## Key Decisions (this batch)
- WorkflowSteps: 6-step completion from dashboardData counts (no extra DB round-trips)
- CompetitorCpiCard: hardcoded Q1 2025 benchmarks, "Sample data" badge
- EmailPerformance: buckets by sentAt (deterministic with LCG seed); mocks.ts deleted
- Recent Activity: AuditLog 5 rows → i18n via action→key registry; empty state for demo

## Backlog
9 entries: BL-003/011/012/014/015/016/017/018/019 + BL-020/021/022 (all Post-MVP)
