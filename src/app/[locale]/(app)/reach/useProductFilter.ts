"use client";

/**
 * BL-031-F002 (D2) — productFilter state hook for OutreachComposer's
 * TemplatePicker.
 *
 * Initial value comes from the active campaign's productId so the
 * composer opens already focused on relevant templates. When the
 * caller switches campaigns (rerender with a new
 * `selectedCampaignProductId`), the filter syncs automatically — but
 * only if the user hasn't manually overridden it within this mount
 * lifecycle. A `userTouchedFilterRef` flag distinguishes auto-sync
 * from a deliberate "show me everything" reset, so we don't stomp
 * the marketer's intent the moment a sibling re-renders the
 * composer.
 *
 * Lives in its own module rather than inside OutreachComposer.tsx
 * so the unit spec (OutreachComposer-productFilter.test.tsx) can
 * import the hook without dragging in the actions / next-auth /
 * server-only graph that the full client component pulls.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export function useProductFilter(selectedCampaignProductId: string | null) {
  const [productFilter, setProductFilter] = useState<string | null>(
    selectedCampaignProductId ?? null
  );
  const userTouchedFilterRef = useRef(false);

  useEffect(() => {
    if (userTouchedFilterRef.current) return;
    setProductFilter(selectedCampaignProductId ?? null);
  }, [selectedCampaignProductId]);

  const onProductFilterChange = useCallback((next: string | null) => {
    userTouchedFilterRef.current = true;
    setProductFilter(next);
  }, []);

  return [productFilter, onProductFilterChange] as const;
}
