"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { parseFilters, serializeFilters, type DiscoveryFilters } from "@/lib/kol/filters";

interface SavedSearchRow {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
}

interface Props {
  basePath: string;
  currentFilters: DiscoveryFilters;
  initialItems: SavedSearchRow[];
  labels: {
    saveSearch: string;
    savePrompt: string;
    saveConfirm: string;
    mySearches: string;
    loadPlaceholder: string;
    saveFailed: string;
  };
}

export function SaveSearchControls({
  basePath,
  currentFilters,
  initialItems,
  labels,
}: Props) {
  const [items, setItems] = useState<SavedSearchRow[]>(initialItems);
  const count = items.length;

  const onSave = async () => {
    const name = window.prompt(labels.savePrompt);
    if (!name || !name.trim()) return;

    // BL-044 #11:A — SaveSearch keeps the legacy filter semantics. AI
    // semantic queries (`aiQuery`) are not persisted: a saved search is
    // a deterministic filter recipe, while semantic queries are
    // ephemeral natural-language intents that the user re-types each
    // time. Stripping aiQuery here keeps the saved JSON shape stable
    // and prevents stale `?ai=…` URLs from springing back to life.
    const filtersForSave: DiscoveryFilters = { ...currentFilters, aiQuery: undefined };
    const payload = {
      name: name.trim(),
      filters: filtersForSave,
    };

    const res = await fetch("/api/saved-searches", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      window.alert(labels.saveFailed);
      return;
    }

    const row = (await res.json()) as SavedSearchRow;
    setItems((prev) => [row, ...prev].slice(0, 20));
    window.alert(labels.saveConfirm);
  };

  const selectOptions = useMemo(
    () =>
      items.map((row) => {
        const parsed = parseFilters(
          row.filters as Record<string, string | string[] | undefined>
        );
        const q = serializeFilters(parsed).toString();
        const href = q ? `${basePath}?${q}` : basePath;
        return { id: row.id, name: row.name, href };
      }),
    [basePath, items]
  );

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        onClick={onSave}
        data-testid="save-search-button"
        className="border-purple/40 text-purple"
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          bookmark
        </span>
        {labels.saveSearch}
      </Button>

      <label className="inline-flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="whitespace-nowrap">{labels.mySearches.replace("{count}", String(count))}</span>
        <select
          className="rounded-lg border border-outline-variant bg-surface px-2 py-1 text-xs text-on-surface"
          defaultValue=""
          data-testid="saved-searches-select"
          onChange={(e) => {
            if (!e.target.value) return;
            window.location.href = e.target.value;
          }}
        >
          <option value="">{labels.loadPlaceholder}</option>
          {selectOptions.map((o) => (
            <option key={o.id} value={o.href}>
              {o.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
