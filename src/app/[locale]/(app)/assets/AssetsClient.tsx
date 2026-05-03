"use client";

/**
 * BL-025-F004 · `/assets` three-column client shell.
 *
 * Server hands us the initial listing (already filter-applied) +
 * the product list for the Combobox; from there everything is
 * client-side: filter mutations bounce through the URL hook, the
 * grid hits its own router.refresh on filter change, and the
 * detail panel is a controlled sibling of the grid.
 *
 * Visual baselines stay deferred until staging is redeployed (the
 * Playwright update-snapshots workflow needs a working /assets URL).
 */
import { useEffect, useMemo, useReducer, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";
import { Menu } from "@base-ui/react/menu";

import {
  AssetCard,
  type AssetCardQuickAction,
  AssetTabs,
  ChipButton,
  GhostButton,
  GradientButton,
  SecondaryButton,
  SectionHeader,
  TagChip,
} from "@/components/common";
import { Combobox } from "@/components/ui/Combobox";
import {
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import type {
  AssetCard as AssetCardData,
  AssetDetail,
  AssetListResult,
  AssetSource,
  AssetStatus,
  AssetType,
} from "@/lib/assets/types";
import { cn } from "@/lib/utils";

import {
  archiveAssetAction,
  deleteAssetAction,
  discardGeneratedAssetAction,
  duplicateAssetAction,
  generateAssetAction,
  loadMoreAssetsAction,
  updateAssetAction,
} from "./actions";
import { EditTab } from "./_panel/EditTab";
import { UsedInTab } from "./_panel/UsedInTab";
import { VersionsTab } from "./_panel/VersionsTab";
import {
  ASSET_LIST_SORTS,
  ASSET_LIST_VIEWS,
  toAssetFilter,
  useAssetFilters,
  type AssetListView,
} from "./use-filter-state";

type AssetTabId = "preview" | "edit" | "versions" | "used_in";

const TAB_CONFIG: ReadonlyArray<{ id: AssetTabId; label: string; disabled?: boolean }> = [
  { id: "preview", label: "Preview" },
  { id: "edit", label: "Edit" },
  { id: "versions", label: "Versions" },
  { id: "used_in", label: "Used in" },
];

const SORT_LABEL: Record<(typeof ASSET_LIST_SORTS)[number], string> = {
  recent: "Recent",
  name: "Name",
  type: "Type",
};

const TYPE_OPTIONS: ReadonlyArray<{ value: AssetType; label: string; icon: string }> = [
  { value: "email", label: "Email", icon: "mail" },
  { value: "video_script", label: "Video", icon: "movie" },
];

const STATUS_OPTIONS: ReadonlyArray<{ value: AssetStatus; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

const SOURCE_OPTIONS: ReadonlyArray<{ value: AssetSource; label: string }> = [
  { value: "ai_generated", label: "AI Generated" },
  { value: "user_created", label: "User Created" },
  { value: "imported", label: "Imported" },
  { value: "system_seed", label: "System" },
];

interface Props {
  initialListing: AssetListResult;
  products: ReadonlyArray<{ id: string; name: string }>;
  initialState: ReturnType<typeof useAssetFilters>["state"];
}

export function AssetsClient({ initialListing, products }: Props) {
  const router = useRouter();
  const { state, update, clearAll } = useAssetFilters();
  const [, startTransition] = useTransition();
  // BL-026-F002 — drawer-mode means selection auto-opens the right
  // slide-over. We start with `null` so the page lands grid-first;
  // older 3-col code seeded with `items[0]?.id` because the aside was
  // permanently visible.
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AssetTabId>("preview");
  const [wizardOpen, setWizardOpen] = useState(false);
  const [pendingActionAssetId, setPendingActionAssetId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    asset: AssetCardData;
  } | null>(null);
  // BL-026-F002 — top filter dropdown replaces the old left sidebar.
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);

  // F004 patch — infinite scroll. The server component hands us page
  // 1; we extend it with page 2..N as the sentinel intersects. Reset
  // every time `initialListing` changes (new filter / sort / page
  // refresh) so a stale tail doesn't ride into a fresh result set.
  // Reset uses the prop-comparison-during-render pattern from
  // https://react.dev/learn/you-might-not-need-an-effect rather than
  // a useEffect (lint forbids synchronous setState in effects).
  const [extraItems, setExtraItems] = useState<AssetCardData[]>([]);
  const [cursor, setCursor] = useState<string | null>(initialListing.nextCursor);
  const [hasMore, setHasMore] = useState<boolean>(initialListing.hasMore);
  const [loadingMore, setLoadingMore] = useState(false);
  const [storedListing, setStoredListing] = useState(initialListing);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  if (storedListing !== initialListing) {
    setStoredListing(initialListing);
    setExtraItems([]);
    setCursor(initialListing.nextCursor);
    setHasMore(initialListing.hasMore);
  }

  // Lightweight inline snackbar — auto-dismiss after 3s. Real toast
  // library can replace this once a global UX one is picked.
  useEffect(() => {
    if (!statusMessage) return;
    const handle = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(handle);
  }, [statusMessage]);

  // After any mutation that changed the visible listing (save / save-
  // as-variant / restore), reload the server data. Plain
  // router.refresh re-runs the parent Server Component without
  // scrolling.
  function handleAssetMutated(newAssetId?: string) {
    if (newAssetId) {
      setSelectedAssetId(newAssetId);
      setActiveTab("preview");
    }
    router.refresh();
  }

  function handleSelect(assetId: string | null) {
    setSelectedAssetId(assetId);
    setActiveTab("preview");
  }

  async function handleQuickAction(asset: AssetCardData, action: AssetCardQuickAction) {
    if (pendingActionAssetId) return;
    if (action === "edit") {
      setSelectedAssetId(asset.id);
      setActiveTab("edit");
      return;
    }
    if (action === "duplicate") {
      setPendingActionAssetId(asset.id);
      const result = await duplicateAssetAction({ assetId: asset.id });
      setPendingActionAssetId(null);
      if (!result.ok) {
        setStatusMessage(`Duplicate failed — ${result.error}`);
        return;
      }
      setStatusMessage("Duplicated");
      handleAssetMutated(result.asset.id);
      return;
    }
    if (action === "archive") {
      setPendingActionAssetId(asset.id);
      const result = await archiveAssetAction({ assetId: asset.id });
      setPendingActionAssetId(null);
      if (!result.ok) {
        setStatusMessage(`Archive failed — ${result.error}`);
        return;
      }
      setStatusMessage("Archived");
      handleAssetMutated(asset.id);
      return;
    }
    if (action === "delete") {
      setConfirmDelete({ asset });
    }
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const id = confirmDelete.asset.id;
    setConfirmDelete(null);
    setPendingActionAssetId(id);
    const result = await deleteAssetAction({ assetId: id });
    setPendingActionAssetId(null);
    if (!result.ok) {
      setStatusMessage(`Delete failed — ${result.error}`);
      return;
    }
    setStatusMessage("Deleted");
    if (selectedAssetId === id) {
      setSelectedAssetId(null);
      setActiveTab("preview");
    }
    router.refresh();
  }

  const allItems = useMemo<AssetCardData[]>(
    () => [...initialListing.items, ...extraItems],
    [initialListing.items, extraItems]
  );

  const selected = useMemo<AssetCardData | null>(() => {
    if (!selectedAssetId) return null;
    return allItems.find((a) => a.id === selectedAssetId) ?? null;
  }, [allItems, selectedAssetId]);

  // IntersectionObserver — hand off the sentinel only when there's
  // more to fetch and we're not already mid-flight, so we don't
  // accidentally chain page requests on a slow network.
  useEffect(() => {
    if (!hasMore || !cursor || loadingMore) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        void (async () => {
          setLoadingMore(true);
          const result = await loadMoreAssetsAction({
            filter: toAssetFilter(state),
            cursor,
            sort: state.sort,
            limit: 24,
          });
          setLoadingMore(false);
          if (result.ok) {
            setExtraItems((prev) => [...prev, ...result.page.items]);
            setCursor(result.page.nextCursor);
            setHasMore(result.page.hasMore);
          } else {
            setStatusMessage(`Failed to load more — ${result.error}`);
            setHasMore(false);
          }
        })();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, cursor, loadingMore, state]);

  const productOptions = useMemo(
    () => products.map((p) => ({ value: p.id, label: p.name })),
    [products]
  );

  const filtersBreadcrumb = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    if (state.productId) {
      const product = products.find((p) => p.id === state.productId);
      chips.push({
        key: `product-${state.productId}`,
        label: product?.name ?? "Product",
        onRemove: () => update({ productId: null }),
      });
    }
    for (const t of state.types ?? []) {
      const opt = TYPE_OPTIONS.find((o) => o.value === t);
      chips.push({
        key: `type-${t}`,
        label: opt?.label ?? t,
        onRemove: () => update({ types: (state.types ?? []).filter((x) => x !== t) }),
      });
    }
    if (state.status) {
      const opt = STATUS_OPTIONS.find((o) => o.value === state.status);
      chips.push({
        key: `status-${state.status}`,
        label: opt?.label ?? state.status,
        onRemove: () => update({ status: null }),
      });
    }
    for (const s of state.sources ?? []) {
      const opt = SOURCE_OPTIONS.find((o) => o.value === s);
      chips.push({
        key: `source-${s}`,
        label: opt?.label ?? s,
        onRemove: () => update({ sources: (state.sources ?? []).filter((x) => x !== s) }),
      });
    }
    if (state.search) {
      chips.push({
        key: `search`,
        label: `"${state.search}"`,
        onRemove: () => update({ search: null }),
      });
    }
    return chips;
  }, [products, state, update]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-1 flex-col overflow-hidden p-6">
      <section className="border-outline-variant bg-surface-container-low/50 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
        <AssetsActionBar
          breadcrumb={filtersBreadcrumb}
          state={state}
          update={(p) => startTransition(() => update(p))}
          onNewAsset={() => setWizardOpen(true)}
          onOpenFilter={() => setFilterDialogOpen(true)}
        />

        {allItems.length === 0 ? (
          <AssetsEmptyState
            onCreate={() => setWizardOpen(true)}
            onGenerate={() => setWizardOpen(true)}
          />
        ) : (
          <AssetsGrid
            items={allItems}
            view={state.view}
            selectedAssetId={selectedAssetId}
            onSelect={handleSelect}
            onQuickAction={handleQuickAction}
            pendingActionAssetId={pendingActionAssetId}
            loadingMore={loadingMore}
            hasMore={hasMore}
            sentinelRef={sentinelRef}
          />
        )}
      </section>

      <AssetsFilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        state={state}
        update={(p) => startTransition(() => update(p))}
        clearAll={() => startTransition(clearAll)}
        productOptions={productOptions}
        productCount={initialListing.total}
      />

      <AssetsDetailDrawer
        asset={selected ?? null}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onClose={() => handleSelect(null)}
        onAssetMutated={handleAssetMutated}
        onMoreAction={(action) => {
          if (selected) handleQuickAction(selected, action);
        }}
        pendingActionAssetId={pendingActionAssetId}
      />

      <NewAssetDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        products={products}
        defaultProductId={state.productId ?? null}
        onSaved={(assetId) => handleAssetMutated(assetId)}
      />

      {confirmDelete ? (
        <Dialog open={true} onOpenChange={(next) => !next && setConfirmDelete(null)}>
          <DialogPortal>
            <DialogBackdrop />
            <DialogPanel size="sm">
              <DialogHeader>
                <DialogTitle>Delete asset?</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 px-5 py-4">
                <p className="text-on-surface text-sm">
                  Permanently delete <span className="font-medium">{confirmDelete.asset.name}</span>?
                  This action cannot be undone.
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <SecondaryButton onClick={() => setConfirmDelete(null)}>Cancel</SecondaryButton>
                  <GradientButton onClick={handleConfirmDelete}>Delete</GradientButton>
                </div>
              </div>
            </DialogPanel>
          </DialogPortal>
        </Dialog>
      ) : null}

      {statusMessage ? (
        <div
          role="status"
          aria-live="polite"
          className="border-cyan/40 bg-surface-container/95 text-on-surface pointer-events-none fixed bottom-6 right-6 z-50 rounded-lg border px-4 py-2 text-sm shadow-lg backdrop-blur"
        >
          {statusMessage}
        </div>
      ) : null}
    </div>
  );
}

interface FilterDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  state: ReturnType<typeof useAssetFilters>["state"];
  update: ReturnType<typeof useAssetFilters>["update"];
  clearAll: () => void;
  productOptions: ReadonlyArray<{ value: string; label: string }>;
  productCount: number;
}

// BL-026-F002 — top filter dropdown replaces the old left sidebar.
// Search input debounces 300ms (BL-025 used onBlur). Archived status
// hides behind a "Show archived" toggle to keep the steady-state list
// short for the marketer's most common filters.
function AssetsFilterDialog({
  open,
  onOpenChange,
  state,
  update,
  clearAll,
  productOptions,
  productCount,
}: FilterDialogProps) {
  const [searchDraft, setSearchDraft] = useState(state.search ?? "");
  const [searchSyncedTo, setSearchSyncedTo] = useState(state.search ?? "");
  const [showArchived, setShowArchived] = useState(state.status === "archived");
  const [archivedSyncedTo, setArchivedSyncedTo] = useState<string | null | undefined>(
    state.status
  );

  // Sync local draft when URL state changes externally (Clear all,
  // breadcrumb chip remove). Prop-comparison-during-render pattern
  // avoids the react-hooks/set-state-in-effect lint.
  if (searchSyncedTo !== (state.search ?? "")) {
    setSearchSyncedTo(state.search ?? "");
    setSearchDraft(state.search ?? "");
  }
  if (archivedSyncedTo !== state.status) {
    setArchivedSyncedTo(state.status);
    if (state.status === "archived") setShowArchived(true);
  }

  // 300ms debounced URL push so the listing doesn't refresh per keystroke.
  useEffect(() => {
    if (searchDraft === (state.search ?? "")) return;
    const handle = window.setTimeout(() => {
      update({ search: searchDraft.trim() || null });
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchDraft, state.search, update]);

  const visibleStatusOptions = showArchived
    ? [{ value: null as AssetStatus | null, label: "All" }, ...STATUS_OPTIONS]
    : [
        { value: null as AssetStatus | null, label: "All" },
        ...STATUS_OPTIONS.filter((o) => o.value !== "archived"),
      ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel size="md" data-testid="assets-filter-dialog">
          <DialogHeader>
            <DialogTitle>Filters</DialogTitle>
          </DialogHeader>
          <div className="custom-scrollbar flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-2">
              <span className="text-on-surface-variant text-xs font-medium">Search</span>
              <Input
                placeholder="Search by name…"
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.currentTarget.value)}
                data-testid="assets-filter-search"
              />
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-on-surface-variant text-xs font-medium">Product</span>
              <Combobox
                items={productOptions}
                value={state.productId ?? null}
                onChange={(next) => update({ productId: next })}
                placeholder="All products"
                ariaLabel="Filter by product"
              />
              {state.productId ? (
                <span className="text-on-surface-variant text-[10px]">
                  {productCount} {productCount === 1 ? "asset" : "assets"} in this product
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-on-surface-variant text-xs font-medium">Type</span>
              <div className="flex flex-wrap gap-2">
                {TYPE_OPTIONS.map((opt) => {
                  const pressed = (state.types ?? []).includes(opt.value);
                  return (
                    <ChipButton
                      key={opt.value}
                      pressed={pressed}
                      onClick={() => {
                        const cur = state.types ?? [];
                        const next = pressed
                          ? cur.filter((t) => t !== opt.value)
                          : [...cur, opt.value];
                        update({ types: next });
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden>
                        {opt.icon}
                      </span>
                      {opt.label}
                    </ChipButton>
                  );
                })}
                <ChipButton disabled aria-disabled className="opacity-50">
                  More coming
                </ChipButton>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-on-surface-variant text-xs font-medium">Status</span>
              <div className="flex flex-col gap-2">
                {visibleStatusOptions.map((opt) => {
                  const checked = (opt.value ?? null) === (state.status ?? null);
                  return (
                    <button
                      key={String(opt.value)}
                      type="button"
                      onClick={() => update({ status: opt.value })}
                      aria-pressed={checked}
                      className={cn(
                        "group flex items-center gap-3 text-sm transition-colors",
                        checked ? "text-on-surface" : "text-on-surface-variant hover:text-on-surface"
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-4 w-4 items-center justify-center rounded-full border",
                          checked
                            ? "border-cyan bg-cyan/20"
                            : "border-outline-variant group-hover:border-cyan/60"
                        )}
                      >
                        {checked ? <span className="bg-cyan h-2 w-2 rounded-full" /> : null}
                      </span>
                      {opt.label}
                    </button>
                  );
                })}
                <GhostButton
                  size="sm"
                  onClick={() => setShowArchived((s) => !s)}
                  className="self-start"
                >
                  {showArchived ? "Hide archived" : "Show archived"}
                </GhostButton>
              </div>
            </div>

            <div className="flex flex-col gap-3 pb-2">
              <span className="text-on-surface-variant text-xs font-medium">Source</span>
              <div className="flex flex-wrap gap-2">
                {SOURCE_OPTIONS.map((opt) => {
                  const pressed = (state.sources ?? []).includes(opt.value);
                  return (
                    <ChipButton
                      key={opt.value}
                      pressed={pressed}
                      onClick={() => {
                        const cur = state.sources ?? [];
                        const next = pressed
                          ? cur.filter((s) => s !== opt.value)
                          : [...cur, opt.value];
                        update({ sources: next });
                      }}
                    >
                      {opt.label}
                    </ChipButton>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <GhostButton onClick={clearAll}>Clear all</GhostButton>
            <GradientButton onClick={() => onOpenChange(false)}>Done</GradientButton>
          </DialogFooter>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

interface ActionBarProps {
  breadcrumb: ReadonlyArray<{ key: string; label: string; onRemove: () => void }>;
  state: ReturnType<typeof useAssetFilters>["state"];
  update: ReturnType<typeof useAssetFilters>["update"];
  onNewAsset: () => void;
  onOpenFilter: () => void;
}

function AssetsActionBar({ breadcrumb, state, update, onNewAsset, onOpenFilter }: ActionBarProps) {
  return (
    <div className="border-outline-variant flex h-16 items-center justify-between gap-4 border-b px-6">
      <div className="flex shrink-0 items-center gap-3">
        <GhostButton
          icon={
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              filter_alt
            </span>
          }
          iconPosition="left"
          onClick={onOpenFilter}
          data-testid="assets-filter-trigger"
        >
          Filter
          <span className="material-symbols-outlined ml-1 text-[14px]" aria-hidden>
            arrow_drop_down
          </span>
        </GhostButton>
      </div>

      <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto">
        {breadcrumb.length === 0 ? (
          <span className="text-on-surface-variant text-xs">No filters applied</span>
        ) : (
          breadcrumb.map((chip) => (
            <ChipButton key={chip.key} removable onClick={chip.onRemove} pressed>
              {chip.label}
            </ChipButton>
          ))
        )}
      </div>

      <div className="flex items-center gap-3">
        <Select
          value={state.sort}
          onChange={(e) =>
            update({ sort: e.currentTarget.value as (typeof ASSET_LIST_SORTS)[number] })
          }
          className="h-9 w-[120px]"
          aria-label="Sort"
        >
          {ASSET_LIST_SORTS.map((s) => (
            <option key={s} value={s}>
              {SORT_LABEL[s]}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-1">
          {ASSET_LIST_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-label={`${v} view`}
              aria-pressed={state.view === v}
              onClick={() => update({ view: v as AssetListView })}
              className={cn(
                "flex h-9 w-9 items-center justify-center rounded-md border transition-colors",
                state.view === v
                  ? "border-cyan bg-cyan/10 text-cyan"
                  : "border-outline-variant text-on-surface-variant hover:text-on-surface"
              )}
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden>
                {v === "grid" ? "grid_view" : "view_list"}
              </span>
            </button>
          ))}
        </div>

        <GradientButton
          icon={
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              add
            </span>
          }
          onClick={onNewAsset}
        >
          New Asset
        </GradientButton>
      </div>
    </div>
  );
}

interface GridProps {
  items: ReadonlyArray<AssetCardData>;
  view: AssetListView;
  selectedAssetId: string | null;
  onSelect: (id: string | null) => void;
  onQuickAction: (asset: AssetCardData, action: AssetCardQuickAction) => void;
  pendingActionAssetId: string | null;
  loadingMore: boolean;
  hasMore: boolean;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
}

function AssetsGrid({
  items,
  view,
  selectedAssetId,
  onSelect,
  onQuickAction,
  pendingActionAssetId,
  loadingMore,
  hasMore,
  sentinelRef,
}: GridProps) {
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div
        className={cn(
          "gap-5",
          view === "grid"
            ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
            : "flex flex-col"
        )}
      >
        {items.map((asset) => (
          <AssetCard
            key={asset.id}
            asset={asset}
            isSelected={asset.id === selectedAssetId}
            onSelect={() => onSelect(asset.id === selectedAssetId ? null : asset.id)}
            onQuickAction={(action) => onQuickAction(asset, action)}
            pending={pendingActionAssetId === asset.id}
          />
        ))}
        {loadingMore
          ? Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={`skeleton-${idx}`}
                aria-hidden
                className="border-outline-variant bg-surface-container/30 h-[180px] animate-pulse rounded-2xl border"
              />
            ))
          : null}
      </div>
      <div
        ref={sentinelRef}
        data-testid="assets-sentinel"
        aria-hidden={!hasMore}
        className="text-on-surface-variant mt-6 flex h-8 items-center justify-center text-[11px]"
      >
        {hasMore ? null : items.length > 0 ? "End of results" : null}
      </div>
    </div>
  );
}

function AssetsEmptyState({
  onCreate,
  onGenerate,
}: {
  onCreate: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div
        className={cn(
          "flex h-24 w-24 items-center justify-center rounded-3xl backdrop-blur-md",
          "bg-cyan/20 from-cyan/30 to-purple/20 bg-gradient-to-br shadow-[0_0_60px_rgba(0,229,255,0.18)]"
        )}
      >
        <span className="material-symbols-outlined text-on-surface text-5xl" aria-hidden>
          folder_open
        </span>
      </div>
      <SectionHeader title="No assets yet" as="h2" />
      <p className="text-on-surface-variant max-w-md text-sm">
        Your creative vault is empty. Start by generating AI marketing assets from a product or
        create a blank container.
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <GradientButton
          icon={
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              auto_awesome
            </span>
          }
          onClick={onGenerate}
        >
          Generate from product
        </GradientButton>
        <SecondaryButton
          icon={
            <span className="material-symbols-outlined text-[18px]" aria-hidden>
              add
            </span>
          }
          onClick={onCreate}
        >
          Create blank
        </SecondaryButton>
      </div>
    </div>
  );
}

interface DetailDrawerProps {
  asset: AssetCardData | AssetDetail | null;
  activeTab: AssetTabId;
  onTabChange: (next: AssetTabId) => void;
  onClose: () => void;
  onAssetMutated: (newAssetId?: string) => void;
  onMoreAction: (action: AssetCardQuickAction) => void;
  pendingActionAssetId: string | null;
}

// BL-026-F002 — right slide-over (520px) replaces the permanently-
// docked aside. Backdrop is lighter (bg-black/30) than the modal
// dialogs above so the grid behind stays partially visible.
function AssetsDetailDrawer({
  asset,
  activeTab,
  onTabChange,
  onClose,
  onAssetMutated,
  onMoreAction,
  pendingActionAssetId,
}: DetailDrawerProps) {
  return (
    <Dialog
      open={asset !== null}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPortal>
        <DialogBackdrop className="bg-black/30 backdrop-blur-sm" />
        <DialogPanel
          variant="slideOver"
          className="bg-surface-container-low"
          data-testid="assets-detail-drawer"
        >
          {asset ? (
            // Inner panel keyed on asset.id — remount resets tab-local
            // state (Edit draft, Versions cache) when switching assets.
            <DetailPanelInner
              key={asset.id}
              asset={asset}
              activeTab={activeTab}
              onTabChange={onTabChange}
              onClose={onClose}
              onAssetMutated={onAssetMutated}
              onMoreAction={onMoreAction}
              pending={pendingActionAssetId === asset.id}
            />
          ) : null}
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

interface DetailPanelInnerProps {
  asset: AssetCardData | AssetDetail;
  activeTab: AssetTabId;
  onTabChange: (next: AssetTabId) => void;
  onClose: () => void;
  onAssetMutated: (newAssetId?: string) => void;
  onMoreAction: (action: AssetCardQuickAction) => void;
  pending: boolean;
}

function DetailPanelInner({
  asset,
  activeTab,
  onTabChange,
  onClose,
  onAssetMutated,
  onMoreAction,
  pending,
}: DetailPanelInnerProps) {
  const router = useRouter();
  const locale = useLocale();
  const [regenerateOpen, setRegenerateOpen] = useState(false);

  // Best-effort hydration: if the asset object came from the listing
  // (AssetCardData has only contentPreview), we expose a structured
  // content placeholder. EditTab tolerates both shapes.
  const initialContent: Record<string, unknown> | null =
    "content" in asset && asset.content && typeof asset.content === "object" && !Array.isArray(asset.content)
      ? (asset.content as Record<string, unknown>)
      : null;

  async function handleRestore() {
    const result = await updateAssetAction({
      assetId: asset.id,
      patch: { status: "draft" },
    });
    if (result.ok) onAssetMutated();
  }

  return (
    <>
      <header className="border-outline-variant flex items-center gap-3 border-b px-5 py-4">
        <button
          type="button"
          aria-label="Close detail panel"
          onClick={onClose}
          className="text-on-surface-variant hover:text-on-surface"
        >
          <span className="material-symbols-outlined text-[20px]" aria-hidden>
            close
          </span>
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-on-surface truncate text-sm font-semibold">{asset.name}</h2>
          <p className="text-on-surface-variant truncate text-xs">
            {asset.productName ?? "No product"}
          </p>
        </div>
        <TagChip label={asset.source === "ai_generated" ? "AI" : "User"} tone="cyan" size="xs" />
        <DetailPanelMoreMenu
          asset={asset}
          pending={pending}
          onEdit={() => onTabChange("edit")}
          onSaveAsVariant={() => onTabChange("edit")}
          onDuplicate={() => onMoreAction("duplicate")}
          onArchive={() => onMoreAction("archive")}
          onRestore={handleRestore}
          onDelete={() => onMoreAction("delete")}
        />
      </header>

      <AssetTabs<AssetTabId>
        tabs={TAB_CONFIG}
        activeTab={activeTab}
        onChange={onTabChange}
        className="px-5"
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeTab === "preview" ? <DetailPreview asset={asset} /> : null}
        {activeTab === "edit" ? (
          <EditTab
            asset={asset}
            initialContent={initialContent}
            onSaved={onAssetMutated}
          />
        ) : null}
        {activeTab === "versions" ? (
          <VersionsTab asset={asset} onRestore={onAssetMutated} />
        ) : null}
        {activeTab === "used_in" ? <UsedInTab asset={asset} /> : null}
      </div>

      <footer className="border-outline-variant bg-surface-container-low/95 sticky bottom-0 flex gap-2 border-t p-4 backdrop-blur">
        <SecondaryButton
          icon={
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              restart_alt
            </span>
          }
          onClick={() => setRegenerateOpen(true)}
          disabled={pending}
        >
          Regenerate
        </SecondaryButton>
        {asset.type === "email" ? (
          <GradientButton
            icon={
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                send
              </span>
            }
            onClick={() =>
              router.push(`/${locale}/outreach?prefilledAssetId=${asset.id}`)
            }
          >
            Send to Outreach
          </GradientButton>
        ) : null}
      </footer>

      <RegenerateVariantPopup
        open={regenerateOpen}
        onOpenChange={setRegenerateOpen}
        asset={asset}
        onRegenerated={(newAssetId) => {
          setRegenerateOpen(false);
          onAssetMutated(newAssetId);
        }}
      />
    </>
  );
}

interface DetailPanelMoreMenuProps {
  asset: AssetCardData | AssetDetail;
  pending: boolean;
  onEdit: () => void;
  onSaveAsVariant: () => void;
  onDuplicate: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onDelete: () => void;
}

function DetailPanelMoreMenu({
  asset,
  pending,
  onEdit,
  onSaveAsVariant,
  onDuplicate,
  onArchive,
  onRestore,
  onDelete,
}: DetailPanelMoreMenuProps) {
  const isArchived = asset.status === "archived";
  const isEmail = asset.type === "email";
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "text-on-surface-variant hover:text-on-surface flex h-8 w-8 items-center justify-center rounded-full",
          "hover:bg-surface-container/60 focus-visible:ring-cyan/40 focus-visible:ring-2 focus-visible:outline-none",
          pending && "cursor-wait opacity-60"
        )}
        aria-label="More actions"
        disabled={pending}
      >
        <span className="material-symbols-outlined text-[20px]" aria-hidden>
          more_vert
        </span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end">
          <Menu.Popup
            className={cn(
              "border-outline-variant bg-surface text-on-surface z-50 min-w-[180px] rounded-lg border p-1 shadow-lg"
            )}
          >
            <DetailMenuItem icon="edit" label="Edit" onClick={onEdit} />
            {isEmail ? (
              <DetailMenuItem
                icon="content_copy"
                label="Save as new variant"
                onClick={onSaveAsVariant}
              />
            ) : null}
            <DetailMenuItem icon="file_copy" label="Duplicate" onClick={onDuplicate} />
            {isArchived ? (
              <DetailMenuItem icon="unarchive" label="Restore" onClick={onRestore} />
            ) : (
              <DetailMenuItem icon="archive" label="Archive" onClick={onArchive} />
            )}
            <DetailMenuItem icon="delete" label="Delete" onClick={onDelete} danger />
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function DetailMenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <Menu.Item
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm",
        "data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan",
        danger && "data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-300"
      )}
    >
      <span className="material-symbols-outlined text-[16px]" aria-hidden>
        {icon}
      </span>
      {label}
    </Menu.Item>
  );
}

interface RegenerateVariantPopupProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  asset: AssetCardData | AssetDetail;
  onRegenerated: (newAssetId: string) => void;
}

function RegenerateVariantPopup({
  open,
  onOpenChange,
  asset,
  onRegenerated,
}: RegenerateVariantPopupProps) {
  const [steering, setSteering] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openedAtLeastOnce, setOpenedAtLeastOnce] = useState(open);

  // Reset every time the popup transitions from closed to open. Use
  // the prop-comparison-during-render pattern (lint forbids
  // synchronous setState inside an effect).
  if (open && !openedAtLeastOnce) {
    setOpenedAtLeastOnce(true);
    setSteering("");
    setBusy(false);
    setError(null);
  } else if (!open && openedAtLeastOnce) {
    setOpenedAtLeastOnce(false);
  }

  async function handleRegenerate() {
    if (busy) return;
    if (!asset.productId) {
      setError("Asset has no product attached — cannot regenerate.");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await generateAssetAction({
      productId: asset.productId,
      type: asset.type,
      parentAssetId: asset.id,
      steeringPrompt: steering.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onRegenerated(result.assetId);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel size="sm">
          <DialogHeader>
            <DialogTitle>Regenerate variant</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="text-on-surface-variant text-xs">
              A new variant will be added to this asset&apos;s tree — the original stays put.
            </p>
            <textarea
              value={steering}
              onChange={(e) => setSteering(e.currentTarget.value)}
              rows={3}
              placeholder="Optional steering prompt — what should be different?"
              aria-label="Regenerate steering prompt"
              className="border-outline-variant bg-surface/40 text-on-surface placeholder:text-on-surface-variant focus:border-cyan focus:ring-cyan w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <SecondaryButton onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </SecondaryButton>
              <GradientButton onClick={handleRegenerate} disabled={busy}>
                {busy ? "Regenerating…" : "Regenerate"}
              </GradientButton>
            </div>
          </div>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

function DetailPreview({ asset }: { asset: AssetCardData | AssetDetail }) {
  if (asset.contentPreview) {
    return (
      <pre className="bg-surface-container/40 text-on-surface rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
        {asset.contentPreview}
      </pre>
    );
  }
  return (
    <p className="text-on-surface-variant text-sm">
      Preview will surface once F005 wires the full content render.
    </p>
  );
}

interface NewAssetDialogProps {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  products: ReadonlyArray<{ id: string; name: string }>;
  defaultProductId: string | null;
  /** Called after Step 3 "Save & Edit" succeeds; lets the parent
   * navigate to the new asset's detail panel. */
  onSaved: (assetId: string) => void;
}

// Spec §F004 19th element: Step-2 textarea seeds with up to six
// preset suggestions the user can click to drop into the prompt.
const STEERING_PRESETS: ReadonlyArray<string> = [
  "Emphasize affordability",
  "For Gen Z audience",
  "Formal tone",
  "Casual tone",
  "Highlight urgency",
  "Use social proof",
];

type WizardStep = 1 | 2 | 3;

interface WizardState {
  step: WizardStep;
  productId: string | null;
  type: AssetType;
  steering: string;
  generated: AssetDetail | null;
  busy: boolean;
  error: string | null;
}

type WizardAction =
  | { kind: "RESET"; defaultProductId: string | null }
  | { kind: "SET_PRODUCT"; productId: string | null }
  | { kind: "SET_TYPE"; type: AssetType }
  | { kind: "SET_STEERING"; steering: string }
  | { kind: "GO_NEXT" }
  | { kind: "GO_BACK" }
  | { kind: "BEGIN_GENERATE" }
  | { kind: "GENERATE_OK"; asset: AssetDetail }
  | { kind: "GENERATE_FAIL"; error: string }
  | { kind: "DISCARD_RESULT" };

function initialWizardState(defaultProductId: string | null): WizardState {
  return {
    step: 1,
    productId: defaultProductId,
    type: "email",
    steering: "",
    generated: null,
    busy: false,
    error: null,
  };
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.kind) {
    case "RESET":
      return initialWizardState(action.defaultProductId);
    case "SET_PRODUCT":
      return { ...state, productId: action.productId, error: null };
    case "SET_TYPE":
      return { ...state, type: action.type };
    case "SET_STEERING":
      return { ...state, steering: action.steering };
    case "GO_NEXT":
      if (state.step === 1 && state.productId) return { ...state, step: 2, error: null };
      if (state.step === 2) return { ...state, step: 3, error: null };
      return state;
    case "GO_BACK":
      if (state.step === 2) return { ...state, step: 1, error: null };
      if (state.step === 3) return { ...state, step: 2, generated: null, error: null };
      return state;
    case "BEGIN_GENERATE":
      return { ...state, busy: true, error: null };
    case "GENERATE_OK":
      return { ...state, busy: false, generated: action.asset, error: null };
    case "GENERATE_FAIL":
      return { ...state, busy: false, error: action.error };
    case "DISCARD_RESULT":
      return { ...state, generated: null, error: null };
    default:
      return state;
  }
}

interface PreviewSnapshot {
  primary: string;
  secondary: string;
}

function previewFromAsset(asset: AssetDetail): PreviewSnapshot {
  const c = (asset.content ?? {}) as Record<string, unknown>;
  if (asset.type === "email") {
    return {
      primary: typeof c.subject === "string" ? c.subject : "(no subject)",
      secondary: typeof c.body === "string" ? c.body : "",
    };
  }
  return {
    primary: typeof c.title === "string" ? c.title : "(no title)",
    secondary: typeof c.script === "string" ? c.script : "",
  };
}

function NewAssetDialog({
  open,
  onOpenChange,
  products,
  defaultProductId,
  onSaved,
}: NewAssetDialogProps) {
  const [state, dispatch] = useReducer(wizardReducer, defaultProductId, initialWizardState);

  // Reset whenever the dialog opens so a closed-then-reopened wizard
  // doesn't surface stale generated content from the previous session.
  useEffect(() => {
    if (open) dispatch({ kind: "RESET", defaultProductId });
  }, [open, defaultProductId]);

  async function runGenerate() {
    if (!state.productId || state.busy) return;
    dispatch({ kind: "BEGIN_GENERATE" });
    const result = await generateAssetAction({
      productId: state.productId,
      type: state.type,
      steeringPrompt: state.steering.trim() || undefined,
    });
    if (!result.ok) {
      dispatch({ kind: "GENERATE_FAIL", error: result.error });
      return;
    }
    dispatch({ kind: "GENERATE_OK", asset: result.asset });
  }

  async function handleDiscard() {
    if (!state.generated) {
      onOpenChange(false);
      return;
    }
    const stale = state.generated;
    dispatch({ kind: "DISCARD_RESULT" });
    await discardGeneratedAssetAction({ assetId: stale.id }).catch(() => null);
    onOpenChange(false);
  }

  async function handleRegenerate() {
    if (!state.generated) {
      void runGenerate();
      return;
    }
    const stale = state.generated;
    dispatch({ kind: "BEGIN_GENERATE" });
    // Discard the previous result first so we never accumulate
    // multiple drafts in the DB while the user iterates. Failure to
    // discard is non-fatal — the sweep can be done later via the
    // archive flow.
    await discardGeneratedAssetAction({ assetId: stale.id }).catch(() => null);
    const result = await generateAssetAction({
      productId: state.productId!,
      type: state.type,
      steeringPrompt: state.steering.trim() || undefined,
    });
    if (!result.ok) {
      dispatch({ kind: "GENERATE_FAIL", error: result.error });
      return;
    }
    dispatch({ kind: "GENERATE_OK", asset: result.asset });
  }

  function handleSaveAndEdit() {
    if (!state.generated) return;
    const id = state.generated.id;
    onOpenChange(false);
    onSaved(id);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel size="md">
          <DialogHeader>
            <DialogTitle>Generate asset</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-5 px-5 py-4" data-testid="new-asset-wizard">
            <WizardStepIndicator step={state.step} />

            {state.step === 1 ? (
              <WizardStep1
                products={products}
                productId={state.productId}
                type={state.type}
                onSetProduct={(productId) => dispatch({ kind: "SET_PRODUCT", productId })}
                onSetType={(type) => dispatch({ kind: "SET_TYPE", type })}
              />
            ) : null}

            {state.step === 2 ? (
              <WizardStep2
                steering={state.steering}
                onSetSteering={(steering) => dispatch({ kind: "SET_STEERING", steering })}
              />
            ) : null}

            {state.step === 3 ? (
              <WizardStep3 busy={state.busy} generated={state.generated} error={state.error} />
            ) : null}

            {state.error && state.step !== 3 ? (
              <p className="text-xs text-red-400">{state.error}</p>
            ) : null}

            <WizardFooter
              step={state.step}
              busy={state.busy}
              canContinue={state.step === 1 ? !!state.productId : true}
              hasGenerated={!!state.generated}
              onCancel={() => onOpenChange(false)}
              onBack={() => dispatch({ kind: "GO_BACK" })}
              onContinue={() => {
                if (state.step === 2) {
                  dispatch({ kind: "GO_NEXT" });
                  void runGenerate();
                } else {
                  dispatch({ kind: "GO_NEXT" });
                }
              }}
              onDiscard={handleDiscard}
              onRegenerate={handleRegenerate}
              onSaveAndEdit={handleSaveAndEdit}
            />
          </div>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

function WizardStepIndicator({ step }: { step: WizardStep }) {
  return (
    <div className="flex items-center gap-3" aria-label={`Step ${step} of 3`}>
      <span className="text-on-surface-variant text-xs font-medium">Step {step} of 3</span>
      <div className="flex items-center gap-1.5" role="presentation">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn(
              "h-1.5 w-6 rounded-full transition-colors",
              n <= step ? "bg-cyan" : "bg-outline-variant/40"
            )}
          />
        ))}
      </div>
    </div>
  );
}

interface WizardStep1Props {
  products: ReadonlyArray<{ id: string; name: string }>;
  productId: string | null;
  type: AssetType;
  onSetProduct: (productId: string | null) => void;
  onSetType: (type: AssetType) => void;
}

function WizardStep1({ products, productId, type, onSetProduct, onSetType }: WizardStep1Props) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-on-surface-variant text-xs font-medium">Product</span>
        <Combobox
          items={products.map((p) => ({ value: p.id, label: p.name }))}
          value={productId}
          onChange={onSetProduct}
          placeholder="Choose a product"
          ariaLabel="Wizard product picker"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-on-surface-variant text-xs font-medium">Type</span>
        <div className="flex gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <ChipButton
              key={opt.value}
              pressed={type === opt.value}
              onClick={() => onSetType(opt.value)}
            >
              <span className="material-symbols-outlined text-[14px]" aria-hidden>
                {opt.icon}
              </span>
              {opt.label}
            </ChipButton>
          ))}
        </div>
      </div>
    </>
  );
}

interface WizardStep2Props {
  steering: string;
  onSetSteering: (next: string) => void;
}

function WizardStep2({ steering, onSetSteering }: WizardStep2Props) {
  function applyPreset(text: string) {
    const trimmed = steering.trim();
    if (!trimmed) {
      onSetSteering(text);
      return;
    }
    if (trimmed.toLowerCase().includes(text.toLowerCase())) return;
    onSetSteering(`${trimmed}${trimmed.endsWith(".") ? " " : ". "}${text}`);
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-on-surface-variant text-xs font-medium">
          Steering prompt (optional)
        </span>
        <textarea
          value={steering}
          onChange={(e) => onSetSteering(e.currentTarget.value)}
          rows={4}
          placeholder="Tell the model how this asset should land — tone, audience, hooks…"
          aria-label="Steering prompt"
          className="border-outline-variant bg-surface/40 text-on-surface placeholder:text-on-surface-variant focus:border-cyan focus:ring-cyan w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-on-surface-variant text-[11px] font-medium">Quick presets</span>
        <div className="flex flex-wrap gap-2">
          {STEERING_PRESETS.map((preset) => (
            <ChipButton key={preset} onClick={() => applyPreset(preset)}>
              {preset}
            </ChipButton>
          ))}
        </div>
      </div>
    </>
  );
}

interface WizardStep3Props {
  busy: boolean;
  generated: AssetDetail | null;
  error: string | null;
}

function WizardStep3({ busy, generated, error }: WizardStep3Props) {
  if (busy) {
    return (
      <div className="flex min-h-[180px] flex-col items-center justify-center gap-3 py-6">
        <span
          className="material-symbols-outlined text-cyan animate-spin text-[28px]"
          aria-hidden
        >
          progress_activity
        </span>
        <span className="text-on-surface-variant text-xs">
          Generating with claude-haiku-4.5…
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 py-6">
        <span className="material-symbols-outlined text-red-300 text-[24px]" aria-hidden>
          error
        </span>
        <p className="text-xs text-red-300">{error}</p>
        <p className="text-on-surface-variant text-[11px]">Click Regenerate to try again.</p>
      </div>
    );
  }

  if (!generated) return null;
  const preview = previewFromAsset(generated);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TagChip
          label={generated.type === "email" ? "Email" : "Video"}
          tone={generated.type === "email" ? "cyan" : "purple"}
          size="xs"
        />
        <span className="text-on-surface-variant text-[11px]">Draft preview</span>
      </div>
      <div className="border-outline-variant/60 bg-surface/40 flex flex-col gap-2 rounded-lg border p-3">
        <p className="text-on-surface text-sm font-medium">{preview.primary}</p>
        <p className="text-on-surface-variant line-clamp-6 whitespace-pre-wrap text-xs">
          {preview.secondary}
        </p>
      </div>
    </div>
  );
}

interface WizardFooterProps {
  step: WizardStep;
  busy: boolean;
  canContinue: boolean;
  hasGenerated: boolean;
  onCancel: () => void;
  onBack: () => void;
  onContinue: () => void;
  onDiscard: () => void;
  onRegenerate: () => void;
  onSaveAndEdit: () => void;
}

function WizardFooter({
  step,
  busy,
  canContinue,
  hasGenerated,
  onCancel,
  onBack,
  onContinue,
  onDiscard,
  onRegenerate,
  onSaveAndEdit,
}: WizardFooterProps) {
  if (step === 1) {
    return (
      <div className="flex justify-end gap-2 pt-1">
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        <GradientButton onClick={onContinue} disabled={!canContinue}>
          Continue →
        </GradientButton>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="flex justify-between gap-2 pt-1">
        <SecondaryButton onClick={onBack}>← Back</SecondaryButton>
        <GradientButton onClick={onContinue}>Generate →</GradientButton>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
      <SecondaryButton onClick={onDiscard} disabled={busy}>
        Discard
      </SecondaryButton>
      <div className="flex gap-2">
        <SecondaryButton onClick={onRegenerate} disabled={busy}>
          Regenerate
        </SecondaryButton>
        <GradientButton onClick={onSaveAndEdit} disabled={busy || !hasGenerated}>
          Save & Edit
        </GradientButton>
      </div>
    </div>
  );
}
