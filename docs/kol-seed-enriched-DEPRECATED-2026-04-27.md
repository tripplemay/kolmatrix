# `docs/kol-seed-enriched*` — DEPRECATED 2026-04-27

> Marker file. The four legacy artefacts listed below are kept in git for
> historical reference but are no longer the source-of-truth seed for KOLs.
> All new seed work goes through the YouTube Data API path documented in
> `docs/specs/MVP-kol-seed-redo-spec.md`.

## Affected files (preserved, not deleted)

- `docs/kol-seed-enriched-final.json` — 2,524 entries, 415 gaming, AI-tagged
- `docs/kol-seed-enriched-final.csv` — CSV mirror of the same
- `docs/kol-seed-enriched.json` — raw pre-AI XLSX export
- `docs/kol-seed-enriched.csv` — raw CSV mirror
- `scripts/seed-kol-from-enriched.ts` — BM1-F002 import script (kept as
  reference; `npm run seed:kol` still executes it for parity with the
  BM1 sprint history)

## Why deprecated

The XLSX source (`Youtube网红清单-1203.xlsx`, imported 2026-04-21 + AI-tagged
in two stages) was a micro-creator pool, not a KOL pool:

| Metric | Value | What it means |
|---|---|---|
| Total rows | 2,524 | — |
| Gaming subset | 415 | After AI Stage A/B filtering |
| **Median gaming followers** | **2,540** | Industry KOL floor is 10K |
| **Max gaming followers** | **10,000** | Hard cap; nothing above |
| Above 10K threshold | 2 entries | 0.5% of the gaming subset |
| AI low-confidence tags | 67 (16%) | "Stage B couldn't find signal" |
| Region coverage | US 209 / PK 96 / GB 41 / CA 26 / DE 17 / VN 17 / UA 7 / JP 1 | **No CN. TW=1. HK=0.** |

KOLMatrix is a "global gaming KOL/KOC marketing platform" (`CLAUDE.md`).
A demo whose Discovery page can't show a single Chinese-region KOL above
10K subscribers is brand-unfit for the seed-user demo we're shipping
~2026-05-04.

The AI tagging cost (~$0.91 across two stages) is sunk. The data quality
ceiling is set by the XLSX source itself; re-running the AI pipeline
won't lift channels past their actual subscriber counts.

## What replaced it

`MVP-kol-seed-redo` (this batch, 2026-04-27):

- `scripts/seed-kol-from-youtube.ts` — fresh crawl from YouTube Data
  API v3, 8-region × 5-keyword matrix × 2 pages, filtered by
  subscriberCount ≥ 10K + videoCount ≥ 30 + non-empty description +
  gaming `topicCategories`. Outputs
  `docs/kol-seed-youtube-{date}.json`.
- `scripts/validate-kol-from-enriched.ts` — secondary audit that takes
  the 415 gaming entries here, looks each handle up live, and
  classifies them as `real_kol` / `below_threshold` /
  `non_gaming_topic` / `handle_not_found` / `no_statistics`. Outputs
  `docs/kol-seed-enriched-validation-{date}.json` for the record.
- `scripts/import-kol-from-youtube.ts` — Prisma import that writes the
  YouTube channels into the `kol` table with
  `metadata.is_demo=true` so a single `DELETE FROM kol WHERE
  metadata->>'is_demo'='true'` cleanup will retire the seed when the
  crawler team's real dataset lands (BL-012, ~2026-06-25).

## Production state at the time of deprecation

- **Prod** had not been imported with this dataset — only the 12 B0
  Stitch demo KOLs were live (`prisma/seed.ts`).
- **Staging** had been imported once via `npm run seed:kol` (2,524 rows
  under the demo tenant) — the data sits there alongside the new
  YouTube seed. The historical staging rows are not removed by this
  batch; they will be cleaned up alongside the YouTube seed when the
  crawler team replaces both with real data.

## References

- Spec: `docs/specs/MVP-kol-seed-redo-spec.md`
- BL-012 (crawler team handoff): `docs/product/kol-crawler-team-handoff-v1.md`
- PRD: `docs/product/KOLMatrix-MVP-PRD.md` §12 (sync policy updated to
  allow this one-shot YouTube seed during MVP launch)
- BM1-F002 import (kept as historical reference): `scripts/seed-kol-from-enriched.ts`
