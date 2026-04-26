# MVP-visual-fidelity-hotfix · F001 · Legacy pattern census

> Generated 2026-04-26 during F001 residual work. Source command:
> `grep -rn "INPUT_CLASS\|CHIP_BASE\|inline-flex.*bg-cyan/10" src/app/`.

## Why this exists

F002–F006 will rewrite the affected pages. Each page rewrite must replace
these legacy locals with the public component library before the page
ships. Tracking the inventory here keeps the migration honest — Reviewer
can grep again at sign-off and confirm the count drops to zero on
rewritten files.

## Inventory

### `INPUT_CLASS` constant — 4 callsites, 13 usages

| Page | File | Lines |
|---|---|---|
| /database (F003) | `src/app/[locale]/(app)/database/DatabaseFilterBar.tsx` | 24 (def), 55, 64, 80, 96 |
| /discovery (F002) | `src/app/[locale]/(app)/discovery/FilterSidebar.tsx` | 31 (def), 66, 80, 88, 148, 163, 173, 183, 191, 245, 256 |
| /campaigns (F004) | `src/app/[locale]/(app)/campaigns/CampaignsFilterBar.tsx` | 25 (def), 60, 70 |
| /campaigns/:id (F005) | `src/app/[locale]/(app)/campaigns/[id]/CampaignHeader.tsx` | 49 (def) |

**Replacement:** `<Input>` / `<Select>` / `<Textarea>` from `@/components/ui`.

### `CHIP_BASE` constant — 1 callsite, 2 usages

| Page | File | Lines |
|---|---|---|
| /discovery (F002) | `src/app/[locale]/(app)/discovery/FilterSidebar.tsx` | 27 (def), 358 |

**Replacement:** `<ChipButton pressed onChange>` from `@/components/common`.

### Inline `inline-flex … bg-cyan/10` chip pill — 1 instance

| Page | File | Line |
|---|---|---|
| /database (F003) | `src/app/[locale]/(app)/database/page.tsx` | 266 |

Hand-rolled ring pill that should be replaced with the proper
`<StatusBadge>` or `<TagChip>` depending on semantics. Resolve during F003
rewrite.

## Per-feature checklist (Generator self-audit before commit)

- [ ] **F002 /discovery** — `INPUT_CLASS` (11 sites) and `CHIP_BASE` (2 sites) gone from `discovery/`
- [ ] **F003 /database** — `INPUT_CLASS` (5 sites) and the line-266 inline chip gone from `database/`
- [ ] **F004 /campaigns** — `INPUT_CLASS` (3 sites) gone from `campaigns/CampaignsFilterBar.tsx`
- [ ] **F005 /campaigns/:id** — `INPUT_CLASS` (1 site) gone from `campaigns/[id]/CampaignHeader.tsx`
- [ ] **F006 /kols/[id]** — no legacy locals listed; only className-density reduction expected
- [ ] **F007 baseline recap** — final grep returns no matches

## How to verify

```bash
grep -rn "INPUT_CLASS\|CHIP_BASE" src/app/
# At F005 completion (or earlier), expected: no matches.

grep -rn "inline-flex.*bg-cyan/10" src/app/
# Expected: no matches in rewritten pages.
```

## Total to drain

35 grep hits at start of hotfix → target 0 at F005 completion → 0 maintained at F006/F007 sign-off.
