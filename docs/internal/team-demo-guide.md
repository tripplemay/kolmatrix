# KOLMatrix Internal Demo Guide

_Last updated: 2026-05-01 · MVP-internal-demo-prep batch_

---

## 1. Login

**URL:** https://kol.guangai.ai

| Role | Email | Password |
|---|---|---|
| Admin | `admin@kolmatrix.local` | See team Notion › Engineering › KOLMatrix Demo Credentials |
| Marketer | `marketer@kolmatrix.local` | See team Notion › Engineering › KOLMatrix Demo Credentials |

Use **Marketer** for the standard demo journeys below. Use **Admin** to show user management or system settings.

---

## 2. Three Journeys to Try

### Journey A — Discover → Campaign → Email

1. **Discovery** (`/discovery`) — search for gaming KOLs by keyword, platform, or region. Try Smart Match with a product selected.
2. **Add to campaign** — click "Add to campaign" on any KOL card; create or select a campaign.
3. **Outreach** (`/outreach`) — open the campaign, compose an email batch, send via Resend.

### Journey B — Campaign → ROI → Weekly Report

1. **Campaigns** (`/campaigns`) — review active campaign list, click into a campaign.
2. **ROI** (`/roi`) — view the 30-day ROI trend and KPI cards. Expand individual rows.
3. **Weekly Report** (`/weekly-report`) — generate a localized PDF summary to share with stakeholders.

### Journey C — Knowledge Base → AI Assets → Campaign

1. **Knowledge Base** (`/knowledge-base`) — view the seeded game products (Honor of Kings, Genshin Impact, PUBG Mobile, etc.).
2. **Generate AI assets** — click "Generate AI assets" on Pokemon Go or Clash Royale (null-assets products) to trigger a live aigcgateway call.
3. **Use in Campaign** — go to Campaigns → create a new campaign → attach the product and see the AI-drafted email template pre-filled.

---

## 3. What to See on Each Page

| Page | Key elements to highlight |
|---|---|
| **Dashboard** (`/dashboard`) | KPI strip (Active Campaigns, Pipeline KOLs, Email Open Rate, Total Reach); Workflow 6-step progress indicator; Competitor CPI benchmarks card (Sample data · Industry benchmarks Q1 2025); 30-day ROI trend chart; Email Performance card (real data from EmailLog); Recent Activity feed (real AuditLog entries) |
| **Discovery** (`/discovery`) | 2,500+ KOL cards with platform, region, category filters; AI Smart Match button (top-right); engagement metrics; brand-safety labels |
| **KOL Database** (`/database`) | Full sortable/filterable KOL table; export-ready layout |
| **KOL Detail** (`/kols/:id`) | Hero metrics (subscribers, avg views, engagement rate); Enrichment fields (bio, audience breakdown, language, timezone); Topic Cloud (AI-extracted from recent video titles via aigcgateway); Relationship status tracker |
| **Campaigns** (`/campaigns`) | Campaign list with status chips; KPI summary strip; filter bar; AI Suggestions card linking to campaign detail |
| **Outreach** (`/outreach`) | Email batch composer; Resend integration; email performance stats (open / reply / sent); recent sent log |
| **CRM** (`/crm`) | KOL relationship pipeline (Kanban-style); status change history |
| **ROI** (`/roi`) | Revenue vs spend line chart; KPI cards; campaign-level rows with drill-down |
| **Weekly Report** (`/weekly-report`) | Auto-generated Markdown report; locale selector (EN/ZH/JA/KO/ES); download as PDF |

---

## 4. Known Limits (Demo Scope)

- **Shared demo data** — Admin and Marketer share the same Demo Studio tenant. Any product / campaign / KOL added during the demo is visible to everyone logged in.
- **AI matching (B8)** — Smart Match uses embedding search; recommendation engine (B8 KOL-Product scoring) is Post-MVP.
- **Resend webhook (B4-extended)** — email open / reply tracking relies on Resend webhooks. Delivery confirmation works; real-time event streaming is Post-MVP.
- **BullMQ job queue** — AI asset generation runs synchronously (fire-and-forget on the request); background retry queue (BullMQ) activates when production scale demands it. `/api/health` reflects this with `redis: {status: "not_used"}`.
- **AIGC cost** — each "Generate AI assets" click calls aigcgateway (~$0.02–0.10 per call). Avoid spamming during the demo; the monthly budget is $100 USD.
- **B5 schema migration** — KOL enrichment fields (bio, topicCloud, audienceBreakdown) are already in production. Some KOLs have null values; the UI gracefully shows empty states.

---

## 5. Feedback Channel

| Channel | What to put there |
|---|---|
| **Notion** (team workspace) | General impressions, UX observations, feature requests |
| **Slack** `#kolmatrix-feedback` | Quick reactions, bugs found during demo |
| **GitHub Issues** [tripplemay/kolmatrix](https://github.com/tripplemay/kolmatrix/issues) | Specific reproducible bugs with steps to reproduce |
