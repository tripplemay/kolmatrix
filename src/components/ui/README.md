# `<ui>` atoms + business components

Shared component library for KOLMatrix MVP. Atoms live in `src/components/ui/` —
no business semantics, no domain knowledge. Business-aware components (status
domains, KOL/Campaign types, status enums) live in `src/components/common/`.

Pages import from the barrel:

```tsx
import { Button, Input, Select, Dialog, Table, TRow, TCell, Checkbox } from "@/components/ui";
import { ChipButton, StatusBadge, RingProgress, Sparkline, GlassPanel, SectionHeader, StatCard } from "@/components/common";
```

---

## Atoms (`@/components/ui`)

### `<Button>`

5 variants × 3 sizes built on `class-variance-authority`. Reuses
`gradient-cta` Tailwind class so the headline CTA matches the rest of the app
pixel-for-pixel.

| Prop | Type | Default | Notes |
|---|---|---|---|
| `variant` | `"primary-gradient" \| "secondary" \| "ghost" \| "danger" \| "chip"` | `"primary-gradient"` | `chip` toggles via `data-pressed` |
| `size` | `"sm" \| "md" \| "lg"` | `"md"` | `h-8` / `h-10` / `h-12` |
| All native `<button>` props | — | — | `onClick`, `disabled`, etc. |

```tsx
<Button variant="primary-gradient">Generate insights</Button>
<Button variant="secondary" size="sm" onClick={onCancel}>Cancel</Button>
<Button variant="danger" disabled title="Owner-only action">Delete</Button>
```

### `<Input>` + `<Textarea>` + `<Label>` + `<FieldError>` + `<FieldHint>`

Wraps the native control with our `h-10 cyan-focus border` treatment. Pages
keep using `name` / `defaultValue` / `onChange` directly so URL-driven GET
forms (BM1 `/discovery`) stay trivial.

| Prop | Type | Notes |
|---|---|---|
| `invalid` | `boolean` | Sets `aria-invalid` + red border |
| All native `<input>` / `<textarea>` props | — | — |

```tsx
<Label htmlFor="search">KOL search</Label>
<Input id="search" name="q" placeholder="Search by handle…" />
<FieldHint>Press Enter to submit</FieldHint>
```

### `<Select>`

Native `<select>` styled to match `<Input>`. Use this for plain dropdowns
where a custom popup isn't worth the bytes — combobox / typeahead callers
should compose `@base-ui/react/select` directly.

```tsx
<Select name="status" defaultValue="active">
  <option value="active">Active</option>
  <option value="draft">Draft</option>
</Select>
```

### `<Dialog>`

`@base-ui/react/dialog` parts wrapped with our glass-panel + cyan focus
tokens. Trigger / open state stays caller-controlled.

| Prop | Type | Notes |
|---|---|---|
| `open` | `boolean` | Controlled |
| `onOpenChange` | `(open: boolean) => void` | Required |

Sub-parts: `DialogTrigger`, `DialogClose`, `DialogPortal`, `DialogBackdrop`,
`DialogPanel`, `DialogTitle`, `DialogHeader`, `DialogFooter`.

```tsx
<Dialog open={open} onOpenChange={setOpen}>
  <DialogPortal>
    <DialogBackdrop />
    <DialogPanel>
      <DialogHeader><DialogTitle>Add KOL to campaign</DialogTitle></DialogHeader>
      {/* … */}
      <DialogFooter>
        <DialogClose>Cancel</DialogClose>
        <Button onClick={onAdd}>Add</Button>
      </DialogFooter>
    </DialogPanel>
  </DialogPortal>
</Dialog>
```

### `<Table>` + `<THead>` + `<TBody>` + `<TRow>` + `<TCell>`

Replaces hand-rolled `<th>` / `<td>` and inline `Td()` helpers. `<Table
stickyHeader>` adds `sticky top-0` to `<THead>`.

| Component | Props of note |
|---|---|
| `<Table stickyHeader>` | `boolean` |
| `<TRow interactive>` | hover background + cursor |
| `<TCell as="th">` | render as `<th>`; otherwise `<td>` |
| `<TCell align>` | `"left" \| "center" \| "right"` |

### `<Checkbox>`

`@base-ui/react/checkbox` wrapped. Supports `indeterminate` for the
header-row "select all but some" state used by Bulk Action Bars.

| Prop | Type | Notes |
|---|---|---|
| `checked` | `boolean` | Controlled |
| `indeterminate` | `boolean` | Header-row partial select |
| `onCheckedChange` | `(checked: boolean) => void` | — |

---

## Business components (`@/components/common`)

| Component | When to use |
|---|---|
| `<GlassPanel>` | Wrap any section that needs the canonical glass / blur background |
| `<SectionHeader title eyebrow action>` | Title + optional eyebrow + right-side action button |
| `<StatCard label value delta?>` | KPI row in dashboards / list pages |
| `<ChipButton pressed onChange>` | Multi-select filter chips (Status / Tier / Game) |
| `<StatusBadge domain status>` | Status pill — `domain ∈ "campaign" \| "kolRelationship" \| "kolCampaign" \| "email"` |
| `<RingProgress value max>` | Circular progress (campaign health %) |
| `<Sparkline data height>` | Inline trend line; no axis labels |
| `<TagChip>` | Read-only tag pill |
| `<KolCard>` | Full KOL summary card (used on `/discovery` results grid) |
| `<CampaignRow>` | KOL row inside a Campaign panel |
| `<AvatarWithPlatformBadge>` | Round avatar with platform glyph overlay |
| `<AiScoreBadge>` | AI relevance score badge (B2 styling) |
| `<ActivityFeedItem>` | Single audit-log row |

```tsx
<StatusBadge domain="kolCampaign" status="quoted" />
<ChipButton pressed={isActive} onChange={toggleActive}>Active</ChipButton>
<RingProgress value={spendTotal} max={budgetAmount} />
```

---

## Adding a new component

1. **Atom?** Drop in `ui/`, no JSX or domain enums. Update `ui/index.ts` barrel.
2. **Business-aware?** Drop in `common/`, may import status enums. Update `common/index.ts`.
3. Test under `__tests__/` next to the file.
4. Add a row to the table above.
5. Per `framework/harness/ui-fidelity-guardrail.md` §4.3, keep page files
   ≤ 20 hardcoded `className="…"` strings — extract to a component when
   you exceed that threshold.

---

## Reference assets

High-resolution Stitch HTML previews live in
`design-draft/stitch-references/renders/*.png` (1920×1200, generated by
`npm run render:stitch-previews`). Use the **HTML** as the primary fidelity
reference (open in a browser); the PNGs are an offline archive.
