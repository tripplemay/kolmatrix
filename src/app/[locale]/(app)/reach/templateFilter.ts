/**
 * BL-099 fix-round 1 — pure filter predicate for the composer's
 * TemplatePicker.
 *
 * Product filter semantics: an active product filter keeps the
 * product's own templates PLUS product-agnostic ones
 * (productId null/undefined — every workspace user template and all
 * system seeds), with product-matched rows stable-partitioned ahead
 * of generic ones so the campaign's templates surface in the first
 * viewport (BL-031-F002 D2 intent; the BL-031 DoD explicitly expects
 * both bands visible, product rows first). The previous strict
 * `t.productId === productFilter` predicate hid generic rows
 * entirely: combined with the D2 campaign-scoped default, a freshly
 * created workspace template vanished behind "No matches" the moment
 * a campaign with a product was selected, and searching its name
 * found nothing because search is AND-ed after the product filter —
 * the F006 acceptance ① failure Codex caught on staging.
 *
 * Lives in its own module (same isolation rationale as
 * useProductFilter.ts) so the unit spec can exercise the predicate
 * without rendering the full composer client-component graph.
 */

// Aligned with COMPOSER_MAX_RESULTS (the server payload ceiling in
// assets/queries.ts) so the picker never secondary-truncates below
// what the server already capped. The old slice(0, 20) could push a
// product's own (oldest) templates out entirely once generic rows
// pass the product filter — e.g. prod's 16 migrated user templates
// (June createdAt) outranking the 3 April PUBG assets the BL-031-F002
// campaign default exists to surface. The listbox is a scrollable
// max-h container, so rendering up to 100 light rows is cheap.
export const TEMPLATE_PICKER_MAX_RESULTS = 100;

export interface TemplateFilterCandidate {
  name: string;
  subject?: string | null;
  productId?: string | null;
}

export function filterComposerTemplates<T extends TemplateFilterCandidate>(
  templates: readonly T[],
  productFilter: string | null,
  searchQuery: string
): T[] {
  let items: T[] = [...templates];
  if (productFilter) {
    // Stable partition: the campaign's own product templates first,
    // then product-agnostic rows in their original band order. Rows
    // tied to OTHER products drop out.
    const matched = items.filter((t) => t.productId === productFilter);
    const generic = items.filter((t) => !t.productId);
    items = [...matched, ...generic];
  }
  const q = searchQuery.trim().toLowerCase();
  if (q.length > 0) {
    items = items.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        (t.subject ?? "").toLowerCase().includes(q)
    );
  }
  return items.slice(0, TEMPLATE_PICKER_MAX_RESULTS);
}
