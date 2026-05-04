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
import { useLocale, useTranslations } from "next-intl";
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
  StatusDot,
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
  VariantTreeNode,
} from "@/lib/assets/types";
import { cn } from "@/lib/utils";

import {
  archiveAssetAction,
  deleteAssetAction,
  discardGeneratedAssetAction,
  duplicateAssetAction,
  generateAssetAction,
  loadMoreAssetsAction,
  loadVariantTreeAction,
  saveAssetAsVariantAction,
  updateAssetAction,
} from "./actions";
import { EditTab } from "./_panel/EditTab";
import { UsedInTab } from "./_panel/UsedInTab";
import {
  ASSET_LIST_SORTS,
  ASSET_LIST_VIEWS,
  toAssetFilter,
  useAssetFilters,
  type AssetListView,
} from "./use-filter-state";

// BL-026-F003 — Versions tab folded into the Preview tab as a top-of-
// pane VariantSwitcher dropdown (only visible when totalVariants > 1).
type AssetTabId = "preview" | "edit" | "used_in";

// BL-033-F004 — keep value-only constants, render i18n labels at runtime.
const TAB_IDS: ReadonlyArray<AssetTabId> = ["preview", "edit", "used_in"];

const TYPE_OPTIONS: ReadonlyArray<{ value: AssetType; icon: string }> = [
  { value: "email", icon: "mail" },
  { value: "video_script", icon: "movie" },
];

const STATUS_VALUES: ReadonlyArray<AssetStatus> = ["draft", "published", "archived"];

const SOURCE_VALUES: ReadonlyArray<AssetSource> = [
  "ai_generated",
  "user_created",
  "imported",
  "system_seed",
];

// BL-033-F004 — preset key list; labels resolved via t() at render time.
const STEERING_PRESET_KEYS = [
  "affordability",
  "genZ",
  "formal",
  "casual",
  "urgency",
  "socialProof",
] as const;

type StatusErrorCode =
  | "unauthorized"
  | "validation"
  | "asset_not_found"
  | "product_not_found"
  | "parent_not_found"
  | "ai_config"
  | "ai_timeout"
  | "ai_response"
  | "ai_parse"
  | "internal"
  | "content_invalid"
  | "depth_exceeded";

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set([
  "unauthorized",
  "validation",
  "asset_not_found",
  "product_not_found",
  "parent_not_found",
  "ai_config",
  "ai_timeout",
  "ai_response",
  "ai_parse",
  "internal",
  "content_invalid",
  "depth_exceeded",
]);

// BL-033-F004 — actions.ts returns `{ok:false, error, code}`. Map the
// code to a localized message when present; otherwise fall back to the
// raw `error` field (server-side English, but better than blank).
function localizeErrorCode(
  t: ReturnType<typeof useTranslations>,
  code: string | undefined,
  fallback: string
): string {
  if (code && KNOWN_ERROR_CODES.has(code)) {
    return t(`errors.${code as StatusErrorCode}`);
  }
  return fallback;
}

interface Props {
  initialListing: AssetListResult;
  products: ReadonlyArray<{ id: string; name: string }>;
  initialState: ReturnType<typeof useAssetFilters>["state"];
  /** BL-026-F004 — `welcome` shows the system_seed grid with a banner
   * for tenants that have zero user-owned assets. `normal` is the
   * standard mixed listing. */
  mode?: "normal" | "welcome";
}

export function AssetsClient({ initialListing, products, mode = "normal" }: Props) {
  const router = useRouter();
  const t = useTranslations("assets");
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
        setStatusMessage(t("toasts.duplicateFailed", { error: localizeErrorCode(t, result.code, result.error) }));
        return;
      }
      setStatusMessage(t("toasts.duplicated"));
      handleAssetMutated(result.asset.id);
      return;
    }
    if (action === "archive") {
      setPendingActionAssetId(asset.id);
      const result = await archiveAssetAction({ assetId: asset.id });
      setPendingActionAssetId(null);
      if (!result.ok) {
        setStatusMessage(t("toasts.archiveFailed", { error: localizeErrorCode(t, result.code, result.error) }));
        return;
      }
      setStatusMessage(t("toasts.archived"));
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
      setStatusMessage(t("toasts.deleteFailed", { error: localizeErrorCode(t, result.code, result.error) }));
      return;
    }
    setStatusMessage(t("toasts.deleted"));
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
            setStatusMessage(
              t("toasts.loadMoreFailed", {
                error: localizeErrorCode(t, result.code, result.error),
              })
            );
            setHasMore(false);
          }
        })();
      },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, cursor, loadingMore, state, t]);

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
    for (const tp of state.types ?? []) {
      chips.push({
        key: `type-${tp}`,
        label: t(`types.${tp}`),
        onRemove: () => update({ types: (state.types ?? []).filter((x) => x !== tp) }),
      });
    }
    if (state.status) {
      chips.push({
        key: `status-${state.status}`,
        label: t(`statuses.${state.status}`),
        onRemove: () => update({ status: null }),
      });
    }
    for (const s of state.sources ?? []) {
      chips.push({
        key: `source-${s}`,
        label: t(`sources.${s}`),
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
  }, [products, state, update, t]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-1 flex-col overflow-hidden p-6">
      {mode === "welcome" ? (
        <WelcomeBanner onGenerate={() => setWizardOpen(true)} />
      ) : null}

      <section className="border-outline-variant bg-surface-container-low/50 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
        <AssetsActionBar
          breadcrumb={filtersBreadcrumb}
          state={state}
          update={(p) => startTransition(() => update(p))}
          onNewAsset={() => setWizardOpen(true)}
          onOpenFilter={() => setFilterDialogOpen(true)}
        />

        {allItems.length === 0 ? (
          <AssetsEmptyState onGenerate={() => setWizardOpen(true)} />
        ) : (
          <AssetsGrid
            items={allItems}
            view={state.view}
            selectedAssetId={selectedAssetId}
            onSelect={handleSelect}
            onQuickAction={handleQuickAction}
            onProductClick={(productId) => {
              // BL-026-F006.A — product link in AssetCard footer
              // routes back here to narrow the listing.
              startTransition(() => update({ productId }));
            }}
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
        onSelectVariant={(assetId) => {
          // BL-026-F003 — keep the drawer open, swap the asset, stay on
          // the Preview tab. router.refresh isn't needed here (no DB
          // mutation).
          setSelectedAssetId(assetId);
          setActiveTab("preview");
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
                <DialogTitle>{t("deleteDialog.title")}</DialogTitle>
              </DialogHeader>
              <div className="flex flex-col gap-3 px-5 py-4">
                <p className="text-on-surface text-sm">
                  {t("deleteDialog.bodyPrefix")}
                  <span className="font-medium">{confirmDelete.asset.name}</span>
                  {t("deleteDialog.bodySuffix")}
                </p>
                <div className="flex justify-end gap-2 pt-1">
                  <SecondaryButton onClick={() => setConfirmDelete(null)}>
                    {t("deleteDialog.cancel")}
                  </SecondaryButton>
                  <GradientButton onClick={handleConfirmDelete}>{t("deleteDialog.delete")}</GradientButton>
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
  const t = useTranslations("assets");
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

  const visibleStatusValues: ReadonlyArray<AssetStatus | null> = showArchived
    ? [null, ...STATUS_VALUES]
    : [null, ...STATUS_VALUES.filter((s) => s !== "archived")];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel size="md" data-testid="assets-filter-dialog">
          <DialogHeader>
            <DialogTitle>{t("filters.title")}</DialogTitle>
          </DialogHeader>
          <div className="custom-scrollbar flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-5 py-4">
            <div className="flex flex-col gap-2">
              <span className="text-on-surface-variant text-xs font-medium">{t("filters.search")}</span>
              <Input
                placeholder={t("filters.searchPlaceholder")}
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.currentTarget.value)}
                data-testid="assets-filter-search"
              />
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-on-surface-variant text-xs font-medium">{t("filters.product")}</span>
              <Combobox
                items={productOptions}
                value={state.productId ?? null}
                onChange={(next) => update({ productId: next })}
                placeholder={t("filters.allProducts")}
                ariaLabel={t("filters.filterByProduct")}
              />
              {state.productId ? (
                <span className="text-on-surface-variant text-[10px]">
                  {t("filters.productAssetCount", { count: productCount })}
                </span>
              ) : null}
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-on-surface-variant text-xs font-medium">{t("filters.type")}</span>
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
                          ? cur.filter((tp) => tp !== opt.value)
                          : [...cur, opt.value];
                        update({ types: next });
                      }}
                    >
                      <span className="material-symbols-outlined text-[14px]" aria-hidden>
                        {opt.icon}
                      </span>
                      {t(`types.${opt.value}`)}
                    </ChipButton>
                  );
                })}
                <ChipButton disabled aria-disabled className="opacity-50">
                  {t("filters.moreComingSoon")}
                </ChipButton>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              <span className="text-on-surface-variant text-xs font-medium">{t("filters.status")}</span>
              <div className="flex flex-col gap-2">
                {visibleStatusValues.map((value) => {
                  const checked = (value ?? null) === (state.status ?? null);
                  const label = value === null ? t("filters.all") : t(`statuses.${value}`);
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => update({ status: value })}
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
                      {label}
                    </button>
                  );
                })}
                <GhostButton
                  size="sm"
                  onClick={() => setShowArchived((s) => !s)}
                  className="self-start"
                >
                  {showArchived ? t("filters.hideArchived") : t("filters.showArchived")}
                </GhostButton>
              </div>
            </div>

            <div className="flex flex-col gap-3 pb-2">
              <span className="text-on-surface-variant text-xs font-medium">{t("filters.source")}</span>
              <div className="flex flex-wrap gap-2">
                {SOURCE_VALUES.map((value) => {
                  const pressed = (state.sources ?? []).includes(value);
                  return (
                    <ChipButton
                      key={value}
                      pressed={pressed}
                      onClick={() => {
                        const cur = state.sources ?? [];
                        const next = pressed
                          ? cur.filter((s) => s !== value)
                          : [...cur, value];
                        update({ sources: next });
                      }}
                    >
                      {t(`sources.${value}`)}
                    </ChipButton>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <GhostButton onClick={clearAll}>{t("filters.clearAll")}</GhostButton>
            <GradientButton onClick={() => onOpenChange(false)}>{t("filters.done")}</GradientButton>
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
  const t = useTranslations("assets");
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
          {t("page.actionBar.filter")}
          <span className="material-symbols-outlined ml-1 text-[14px]" aria-hidden>
            arrow_drop_down
          </span>
        </GhostButton>
      </div>

      <div className="no-scrollbar flex flex-1 items-center gap-2 overflow-x-auto">
        {breadcrumb.length === 0 ? (
          <span className="text-on-surface-variant text-xs">{t("page.actionBar.noFiltersApplied")}</span>
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
          aria-label={t("page.actionBar.sortAriaLabel")}
        >
          {ASSET_LIST_SORTS.map((s) => (
            <option key={s} value={s}>
              {t(`sort.${s}`)}
            </option>
          ))}
        </Select>

        <div className="flex items-center gap-1">
          {ASSET_LIST_VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-label={v === "grid" ? t("view.gridAria") : t("view.listAria")}
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
          {t("page.actionBar.newAsset")}
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
  /** BL-026-F006.A — product-link callback fired from AssetCard
   * footer; parent narrows the listing by productId. */
  onProductClick: (productId: string) => void;
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
  onProductClick,
  pendingActionAssetId,
  loadingMore,
  hasMore,
  sentinelRef,
}: GridProps) {
  const t = useTranslations("assets");
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
            onProductClick={onProductClick}
            pending={pendingActionAssetId === asset.id}
            // BL-026-F004 — system_seed assets are tenant-immutable.
            // Hover overlay restricted to Duplicate; the drawer
            // footer swaps Send-to-Outreach for Save-to-my-library.
            readOnly={asset.source === "system_seed"}
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
        {hasMore ? null : items.length > 0 ? t("page.endOfResults") : null}
      </div>
    </div>
  );
}

// BL-026-F004 — top-of-page banner that frames the system_seed grid
// as a "welcome / sample templates" wizard rather than an empty state.
// Sits above the section box so the action bar stays the same shape.
function WelcomeBanner({ onGenerate }: { onGenerate: () => void }) {
  const t = useTranslations("assets");
  return (
    <div
      data-testid="assets-welcome-banner"
      className={cn(
        "border-cyan/30 bg-cyan/5 mb-4 flex flex-col gap-3 rounded-2xl border p-4",
        "sm:flex-row sm:items-center sm:justify-between"
      )}
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-on-surface text-base font-semibold">
          {t("welcome.bannerTitle")}
        </h2>
        <p className="text-on-surface-variant text-xs">
          {t("welcome.bannerSubtitle")}
        </p>
      </div>
      <GradientButton
        icon={
          <span className="material-symbols-outlined text-[16px]" aria-hidden>
            auto_awesome
          </span>
        }
        onClick={onGenerate}
      >
        {t("welcome.bannerCta")}
      </GradientButton>
    </div>
  );
}

// BL-026-F004 — "Create blank" CTA removed (assetless creation never
// shipped); only the AI generate path remains. The welcome-mode
// system_seed grid is the new positive-path empty fallback (see
// AssetsClient render branch + page.tsx mode detection).
function AssetsEmptyState({ onGenerate }: { onGenerate: () => void }) {
  const t = useTranslations("assets");
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
      <SectionHeader title={t("welcome.emptyTitle")} as="h2" />
      <p className="text-on-surface-variant max-w-md text-sm">
        {t("welcome.emptySubtitle")}
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
          {t("welcome.emptyCta")}
        </GradientButton>
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
  /** BL-026-F003 — VariantSwitcher inside the Preview tab calls this
   * to switch the drawer's view to a sibling variant without a fork. */
  onSelectVariant: (assetId: string) => void;
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
  onSelectVariant,
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
            // state (Edit draft) when switching assets / variants.
            <DetailPanelInner
              key={asset.id}
              asset={asset}
              activeTab={activeTab}
              onTabChange={onTabChange}
              onClose={onClose}
              onAssetMutated={onAssetMutated}
              onMoreAction={onMoreAction}
              onSelectVariant={onSelectVariant}
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
  onSelectVariant: (assetId: string) => void;
  pending: boolean;
}

function DetailPanelInner({
  asset,
  activeTab,
  onTabChange,
  onClose,
  onAssetMutated,
  onMoreAction,
  onSelectVariant,
  pending,
}: DetailPanelInnerProps) {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("assets");
  const [regenerateOpen, setRegenerateOpen] = useState(false);
  const tabConfig = TAB_IDS.map((id) => ({ id, label: t(`tabs.${id}`) }));

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
          aria-label={t("drawer.closeAria")}
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
            {asset.productName ?? t("card.noProduct")}
          </p>
        </div>
        <TagChip
          label={asset.source === "ai_generated" ? t("card.tagAi") : t("card.tagUser")}
          tone="cyan"
          size="xs"
        />
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
        tabs={tabConfig}
        activeTab={activeTab}
        onChange={onTabChange}
        className="px-5"
      />

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {activeTab === "preview" ? (
          <DetailPreview
            asset={asset}
            onSelectVariant={onSelectVariant}
            onAssetMutated={onAssetMutated}
          />
        ) : null}
        {activeTab === "edit" ? (
          <EditTab
            asset={asset}
            initialContent={initialContent}
            onSaved={onAssetMutated}
          />
        ) : null}
        {activeTab === "used_in" ? <UsedInTab asset={asset} /> : null}
      </div>

      <footer className="border-outline-variant bg-surface-container-low/95 sticky bottom-0 flex gap-2 border-t p-4 backdrop-blur">
        {asset.source === "system_seed" ? (
          // BL-026-F004 — system_seed templates are tenant-immutable.
          // Primary CTA is "Save to my library" (Duplicate into the
          // caller's tenant), so the marketer can edit + send.
          // Regenerate is hidden because there's no parent the
          // generator could fork from inside this tenant's RLS scope.
          <GradientButton
            icon={
              <span className="material-symbols-outlined text-[16px]" aria-hidden>
                file_copy
              </span>
            }
            onClick={() => onMoreAction("duplicate")}
            disabled={pending}
          >
            {t("drawer.footer.saveToLibrary")}
          </GradientButton>
        ) : (
          <>
            <SecondaryButton
              icon={
                <span className="material-symbols-outlined text-[16px]" aria-hidden>
                  restart_alt
                </span>
              }
              onClick={() => setRegenerateOpen(true)}
              disabled={pending}
            >
              {t("drawer.footer.regenerate")}
            </SecondaryButton>
            {asset.type === "email" ? (
              // BL-026-F005 — visual degrade from GradientButton to
              // GhostButton: /outreach is now the primary creation
              // surface (with its own search + product filter), so
              // the reverse "Send to Outreach" path is preserved but
              // de-emphasised. ADR-012 §Decision §1 — Outreach-First.
              <GhostButton
                icon={
                  <span className="material-symbols-outlined text-[16px]" aria-hidden>
                    send
                  </span>
                }
                iconPosition="left"
                onClick={() =>
                  router.push(`/${locale}/outreach?prefilledAssetId=${asset.id}`)
                }
              >
                {t("drawer.footer.sendToOutreach")}
              </GhostButton>
            ) : null}
          </>
        )}
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
  const t = useTranslations("assets");
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
        aria-label={t("drawer.moreActionsAria")}
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
            <DetailMenuItem icon="edit" label={t("drawer.menu.edit")} onClick={onEdit} />
            {isEmail ? (
              <DetailMenuItem
                icon="content_copy"
                label={t("drawer.menu.saveAsVariant")}
                onClick={onSaveAsVariant}
              />
            ) : null}
            <DetailMenuItem icon="file_copy" label={t("drawer.menu.duplicate")} onClick={onDuplicate} />
            {isArchived ? (
              <DetailMenuItem icon="unarchive" label={t("drawer.menu.restore")} onClick={onRestore} />
            ) : (
              <DetailMenuItem icon="archive" label={t("drawer.menu.archive")} onClick={onArchive} />
            )}
            <DetailMenuItem icon="delete" label={t("drawer.menu.delete")} onClick={onDelete} danger />
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
  const t = useTranslations("assets");
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
      setError(t("regenerate.noProductError"));
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
      setError(localizeErrorCode(t, result.code, result.error));
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
            <DialogTitle>{t("regenerate.title")}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 px-5 py-4">
            <p className="text-on-surface-variant text-xs">
              {t("regenerate.body")}
            </p>
            <textarea
              value={steering}
              onChange={(e) => setSteering(e.currentTarget.value)}
              rows={3}
              placeholder={t("regenerate.steeringPlaceholder")}
              aria-label={t("regenerate.steeringAria")}
              className="border-outline-variant bg-surface/40 text-on-surface placeholder:text-on-surface-variant focus:border-cyan focus:ring-cyan w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
            />
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-1">
              <SecondaryButton onClick={() => onOpenChange(false)} disabled={busy}>
                {t("regenerate.cancel")}
              </SecondaryButton>
              <GradientButton onClick={handleRegenerate} disabled={busy}>
                {busy ? t("regenerate.regenerating") : t("regenerate.regenerate")}
              </GradientButton>
            </div>
          </div>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}

interface DetailPreviewProps {
  asset: AssetCardData | AssetDetail;
  onSelectVariant: (assetId: string) => void;
  onAssetMutated: (newAssetId?: string) => void;
}

function DetailPreview({ asset, onSelectVariant, onAssetMutated }: DetailPreviewProps) {
  const t = useTranslations("assets");
  return (
    <div className="flex flex-col gap-3">
      {asset.totalVariants > 1 ? (
        <VariantSwitcher
          asset={asset}
          onSelectVariant={onSelectVariant}
          onAssetMutated={onAssetMutated}
        />
      ) : null}
      {asset.contentPreview ? (
        <pre className="bg-surface-container/40 text-on-surface rounded-md p-3 font-mono text-xs whitespace-pre-wrap">
          {asset.contentPreview}
        </pre>
      ) : (
        <p className="text-on-surface-variant text-sm">
          {t("preview.placeholder")}
        </p>
      )}
    </div>
  );
}

interface VariantSwitcherProps {
  asset: AssetCardData | AssetDetail;
  onSelectVariant: (assetId: string) => void;
  onAssetMutated: (newAssetId?: string) => void;
}

// BL-026-F003 — replaces the old VersionsTab. Renders only when the
// active asset belongs to a multi-variant tree. Menu items each carry
// a Restore action that forks a new variant from the chosen node;
// clicking elsewhere on the row switches the drawer's view to that
// variant (no fork).
function VariantSwitcher({ asset, onSelectVariant, onAssetMutated }: VariantSwitcherProps) {
  const t = useTranslations("assets");
  const [nodes, setNodes] = useState<VariantTreeNode[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await loadVariantTreeAction(asset.id);
      if (!alive) return;
      if (!r.ok) setError(r.error);
      else setNodes(r.nodes);
    })();
    return () => {
      alive = false;
    };
  }, [asset.id]);

  function handleRestore(node: VariantTreeNode) {
    startTransition(async () => {
      setError(null);
      // F003.D Option A — server falls back to parent.content when we
      // omit `content`, which is what we want for a Restore (clone the
      // chosen node's content into a fresh variant).
      const r = await saveAssetAsVariantAction({ parentAssetId: node.id });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      onAssetMutated(r.asset.id);
    });
  }

  if (nodes === null || nodes.length <= 1) {
    return null;
  }

  const currentIndex = nodes.findIndex((n) => n.id === asset.id);
  const safeCurrent = currentIndex >= 0 ? currentIndex + 1 : asset.versionIndex;
  const total = nodes.length;

  return (
    <div className="flex flex-col gap-2">
      <Menu.Root>
        <Menu.Trigger
          data-testid="variant-switcher-trigger"
          className={cn(
            "border-outline-variant bg-surface-container/40 text-on-surface flex items-center gap-2 self-start rounded-lg border px-3 py-2 text-xs font-medium",
            "hover:border-cyan/40 hover:text-cyan",
            "focus-visible:ring-cyan/40 focus-visible:ring-2 focus-visible:outline-none"
          )}
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            account_tree
          </span>
          {t("preview.variantSwitcherTriggerLabel", { current: safeCurrent, total })}
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            arrow_drop_down
          </span>
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="start">
            <Menu.Popup
              className={cn(
                "border-outline-variant bg-surface text-on-surface z-50 min-w-[300px] max-w-[420px] rounded-lg border p-1 shadow-lg"
              )}
              data-testid="variant-switcher-popup"
            >
              {nodes.map((node, idx) => {
                const isCurrent = node.id === asset.id;
                return (
                  <Menu.Item
                    key={node.id}
                    onClick={() => {
                      if (!isCurrent) onSelectVariant(node.id);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-xs",
                      "data-[highlighted]:bg-cyan/10 data-[highlighted]:text-cyan",
                      isCurrent && "bg-cyan/5"
                    )}
                  >
                    <span className="font-semibold">v{idx + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{node.name}</span>
                    <TagChip
                      label={node.source === "ai_generated" ? t("card.tagAi") : t("card.tagUser")}
                      tone={node.source === "ai_generated" ? "cyan" : "neutral"}
                      size="xs"
                    />
                    <StatusDot status={node.status} />
                    {isCurrent ? (
                      <span className="text-on-surface-variant text-[10px]">{t("preview.variantSwitcherCurrent")}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRestore(node);
                        }}
                        disabled={isPending}
                        className={cn(
                          "border-outline-variant text-on-surface-variant rounded border px-2 py-0.5 text-[10px] font-medium",
                          "hover:border-cyan/40 hover:text-cyan",
                          isPending && "cursor-wait opacity-60"
                        )}
                      >
                        {t("preview.variantSwitcherRestore")}
                      </button>
                    )}
                  </Menu.Item>
                );
              })}
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
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

function previewFromAsset(
  asset: AssetDetail,
  t: ReturnType<typeof useTranslations>
): PreviewSnapshot {
  const c = (asset.content ?? {}) as Record<string, unknown>;
  if (asset.type === "email") {
    return {
      primary: typeof c.subject === "string" ? c.subject : t("wizard.step3.noSubject"),
      secondary: typeof c.body === "string" ? c.body : "",
    };
  }
  return {
    primary: typeof c.title === "string" ? c.title : t("wizard.step3.noTitle"),
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
  const t = useTranslations("assets");
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
      dispatch({ kind: "GENERATE_FAIL", error: localizeErrorCode(t, result.code, result.error) });
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
      dispatch({ kind: "GENERATE_FAIL", error: localizeErrorCode(t, result.code, result.error) });
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
            <DialogTitle>{t("wizard.title")}</DialogTitle>
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
              <WizardStep3
                busy={state.busy}
                generated={state.generated}
                error={state.error}
                onBack={() => dispatch({ kind: "GO_BACK" })}
                onTryAgain={() => void handleRegenerate()}
              />
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
  const t = useTranslations("assets");
  const label = t("wizard.stepIndicator", { step });
  return (
    <div className="flex items-center gap-3" aria-label={label}>
      <span className="text-on-surface-variant text-xs font-medium">{label}</span>
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
  const t = useTranslations("assets");
  return (
    <>
      <div className="flex flex-col gap-2">
        <span className="text-on-surface-variant text-xs font-medium">{t("wizard.step1.product")}</span>
        <Combobox
          items={products.map((p) => ({ value: p.id, label: p.name }))}
          value={productId}
          onChange={onSetProduct}
          placeholder={t("wizard.step1.productPlaceholder")}
          ariaLabel={t("wizard.step1.productAria")}
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-on-surface-variant text-xs font-medium">{t("wizard.step1.type")}</span>
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
              {t(`types.${opt.value}`)}
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
  const t = useTranslations("assets");
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
          {t("wizard.step2.steeringLabel")}
        </span>
        <textarea
          value={steering}
          onChange={(e) => onSetSteering(e.currentTarget.value)}
          rows={4}
          placeholder={t("wizard.step2.steeringPlaceholder")}
          aria-label={t("wizard.step2.steeringAria")}
          className="border-outline-variant bg-surface/40 text-on-surface placeholder:text-on-surface-variant focus:border-cyan focus:ring-cyan w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-1"
        />
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-on-surface-variant text-[11px] font-medium">
          {t("wizard.step2.presetsHeading")}
        </span>
        <div className="flex flex-wrap gap-2">
          {STEERING_PRESET_KEYS.map((key) => {
            const label = t(`wizard.step2.presets.${key}`);
            return (
              <ChipButton key={key} onClick={() => applyPreset(label)}>
                {label}
              </ChipButton>
            );
          })}
        </div>
      </div>
    </>
  );
}

interface WizardStep3Props {
  busy: boolean;
  generated: AssetDetail | null;
  error: string | null;
  /** BL-026-F006.F — error-state recovery callbacks. */
  onBack: () => void;
  onTryAgain: () => void;
}

function WizardStep3({ busy, generated, error, onBack, onTryAgain }: WizardStep3Props) {
  const t = useTranslations("assets");
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
          {t("wizard.step3.generating")}
        </span>
      </div>
    );
  }

  if (error) {
    // BL-026-F006.F — friendlier error copy + dual recovery
    // buttons (Back to Step 2 to edit prompt / Try again to
    // re-fire the generator). The wizard footer's Discard +
    // Regenerate remain available too for consistency.
    return (
      <div className="flex min-h-[160px] flex-col items-center justify-center gap-3 py-6">
        <span className="material-symbols-outlined text-red-300 text-[24px]" aria-hidden>
          error
        </span>
        <p className="text-on-surface text-center text-xs">
          {t("wizard.step3.errorPrefix")} <span className="text-red-300">{error}</span>
          {t("wizard.step3.errorSuffix")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <SecondaryButton onClick={onBack}>{t("wizard.step3.backToStep2")}</SecondaryButton>
          <GradientButton onClick={onTryAgain}>{t("wizard.step3.tryAgain")}</GradientButton>
        </div>
      </div>
    );
  }

  if (!generated) return null;
  const preview = previewFromAsset(generated, t);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <TagChip
          label={t(`types.${generated.type}`)}
          tone={generated.type === "email" ? "cyan" : "purple"}
          size="xs"
        />
        <span className="text-on-surface-variant text-[11px]">{t("wizard.step3.draftPreview")}</span>
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
  const t = useTranslations("assets");
  if (step === 1) {
    return (
      <div className="flex justify-end gap-2 pt-1">
        <SecondaryButton onClick={onCancel}>{t("wizard.buttons.cancel")}</SecondaryButton>
        <GradientButton onClick={onContinue} disabled={!canContinue}>
          {t("wizard.buttons.continue")}
        </GradientButton>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="flex justify-between gap-2 pt-1">
        <SecondaryButton onClick={onBack}>{t("wizard.buttons.back")}</SecondaryButton>
        <GradientButton onClick={onContinue}>{t("wizard.buttons.generate")}</GradientButton>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
      <div className="flex flex-col gap-1">
        {/* BL-026-F006.E — explicit cost hint above Discard so the
            marketer doesn't churn drafts unaware that each Generate
            burns aigcgateway tokens. Numbers tracked from claude-
            haiku-4.5 average usage in BL-025 audit logs. */}
        <p className="text-on-surface-variant text-[10px]">
          {t("wizard.discardCostHint")}
        </p>
        <SecondaryButton onClick={onDiscard} disabled={busy}>
          {t("wizard.buttons.discard")}
        </SecondaryButton>
      </div>
      <div className="flex gap-2">
        <SecondaryButton onClick={onRegenerate} disabled={busy}>
          {t("wizard.buttons.regenerate")}
        </SecondaryButton>
        <GradientButton onClick={onSaveAndEdit} disabled={busy || !hasGenerated}>
          {t("wizard.buttons.saveAndEdit")}
        </GradientButton>
      </div>
    </div>
  );
}
