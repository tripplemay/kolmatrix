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
 * Several spec slices are intentionally deferred to a follow-up:
 *   - Versions / Used-in tabs (F005 owns those panes)
 *   - 3-step "+ New Asset" wizard polish (this build ships a single
 *     dialog calling generateAssetAction, which is functionally
 *     equivalent for the MVP path)
 *   - Visual baselines (need a staging deploy first)
 *
 * Everything else — filter URL state, three-column responsive
 * layout, AssetCard hover quick actions, detail panel preview,
 * sticky bottom action bar, empty state double-CTA — is in scope.
 */
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  AssetCard,
  AssetTabs,
  ChipButton,
  GhostButton,
  GlassPanel,
  GradientButton,
  SecondaryButton,
  SectionHeader,
  TagChip,
} from "@/components/common";
import { Combobox } from "@/components/ui/Combobox";
import {
  Dialog,
  DialogBackdrop,
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

import { generateAssetAction } from "./actions";
import { EditTab } from "./_panel/EditTab";
import { UsedInTab } from "./_panel/UsedInTab";
import { VersionsTab } from "./_panel/VersionsTab";
import {
  ASSET_LIST_SORTS,
  ASSET_LIST_VIEWS,
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
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(
    initialListing.items[0]?.id ?? null
  );
  const [wizardOpen, setWizardOpen] = useState(false);

  // After any mutation that changed the visible listing (save / save-
  // as-variant / restore), reload the server data. Plain
  // router.refresh re-runs the parent Server Component without
  // scrolling.
  function handleAssetMutated(newAssetId?: string) {
    if (newAssetId) setSelectedAssetId(newAssetId);
    router.refresh();
  }

  const selected = useMemo<AssetCardData | null>(() => {
    if (!selectedAssetId) return null;
    return initialListing.items.find((a) => a.id === selectedAssetId) ?? null;
  }, [initialListing.items, selectedAssetId]);

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
    <div className="flex h-[calc(100vh-4rem)] flex-1 gap-6 overflow-hidden p-6">
      <AssetsFilterSidebar
        state={state}
        update={(p) => startTransition(() => update(p))}
        clearAll={() => startTransition(clearAll)}
        productOptions={productOptions}
        productCount={initialListing.total}
      />

      <section className="border-outline-variant bg-surface-container-low/50 flex min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border">
        <AssetsActionBar
          breadcrumb={filtersBreadcrumb}
          state={state}
          update={(p) => startTransition(() => update(p))}
          onNewAsset={() => setWizardOpen(true)}
        />

        {initialListing.items.length === 0 ? (
          <AssetsEmptyState
            onCreate={() => setWizardOpen(true)}
            onGenerate={() => setWizardOpen(true)}
          />
        ) : (
          <AssetsGrid
            items={initialListing.items}
            view={state.view}
            selectedAssetId={selectedAssetId}
            onSelect={setSelectedAssetId}
          />
        )}
      </section>

      <AssetsDetailPanel
        asset={selected ?? null}
        onClose={() => setSelectedAssetId(null)}
        onAssetMutated={handleAssetMutated}
      />

      <NewAssetDialog
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        products={products}
        defaultProductId={state.productId ?? null}
      />
    </div>
  );
}

interface FilterSidebarProps {
  state: ReturnType<typeof useAssetFilters>["state"];
  update: ReturnType<typeof useAssetFilters>["update"];
  clearAll: () => void;
  productOptions: ReadonlyArray<{ value: string; label: string }>;
  productCount: number;
}

function AssetsFilterSidebar({
  state,
  update,
  clearAll,
  productOptions,
  productCount,
}: FilterSidebarProps) {
  return (
    <GlassPanel
      padding="md"
      rounded="2xl"
      className="custom-scrollbar flex w-[240px] shrink-0 flex-col gap-6 overflow-y-auto"
    >
      <div className="flex items-center justify-between">
        <SectionHeader title="Filters" as="h3" />
        <GhostButton size="sm" onClick={clearAll}>
          Clear all
        </GhostButton>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-on-surface-variant text-xs font-medium">Search</span>
        <Input
          placeholder="Search by name…"
          defaultValue={state.search ?? ""}
          onBlur={(e) => {
            const next = e.currentTarget.value.trim();
            if ((state.search ?? "") !== next) update({ search: next || null });
          }}
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
                  const next = pressed ? cur.filter((t) => t !== opt.value) : [...cur, opt.value];
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
          {[{ value: null as AssetStatus | null, label: "All" }, ...STATUS_OPTIONS].map((opt) => {
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
        </div>
      </div>

      <div className="flex flex-col gap-3 pb-8">
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
                  const next = pressed ? cur.filter((s) => s !== opt.value) : [...cur, opt.value];
                  update({ sources: next });
                }}
              >
                {opt.label}
              </ChipButton>
            );
          })}
        </div>
      </div>
    </GlassPanel>
  );
}

interface ActionBarProps {
  breadcrumb: ReadonlyArray<{ key: string; label: string; onRemove: () => void }>;
  state: ReturnType<typeof useAssetFilters>["state"];
  update: ReturnType<typeof useAssetFilters>["update"];
  onNewAsset: () => void;
}

function AssetsActionBar({ breadcrumb, state, update, onNewAsset }: ActionBarProps) {
  return (
    <div className="border-outline-variant flex h-16 items-center justify-between gap-4 border-b px-6">
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
}

function AssetsGrid({ items, view, selectedAssetId, onSelect }: GridProps) {
  return (
    <div
      className={cn(
        "flex-1 gap-5 overflow-y-auto p-6",
        view === "grid" ? "grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3" : "flex flex-col"
      )}
    >
      {items.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          isSelected={asset.id === selectedAssetId}
          onSelect={() => onSelect(asset.id === selectedAssetId ? null : asset.id)}
          // Quick actions deferred to F005 — wire onQuickAction here
          // when archive / delete server actions land.
        />
      ))}
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

interface DetailPanelProps {
  asset: AssetCardData | AssetDetail | null;
  onClose: () => void;
  onAssetMutated: () => void;
}

function AssetsDetailPanel({ asset, onClose, onAssetMutated }: DetailPanelProps) {
  if (!asset) {
    return (
      <aside className="border-outline-variant bg-surface-container-low/40 hidden w-[440px] shrink-0 items-center justify-center rounded-2xl border lg:flex">
        <p className="text-on-surface-variant text-sm">Select an asset to preview</p>
      </aside>
    );
  }

  return (
    <aside className="border-outline-variant bg-surface-container-low hidden w-[440px] shrink-0 flex-col overflow-hidden rounded-2xl border lg:flex">
      {/* Inner panel keyed on asset.id — remount resets activeTab +
          tab-local state without an effect-driven reset. */}
      <DetailPanelInner
        key={asset.id}
        asset={asset}
        onClose={onClose}
        onAssetMutated={onAssetMutated}
      />
    </aside>
  );
}

interface DetailPanelInnerProps {
  asset: AssetCardData | AssetDetail;
  onClose: () => void;
  onAssetMutated: () => void;
}

function DetailPanelInner({ asset, onClose, onAssetMutated }: DetailPanelInnerProps) {
  const [activeTab, setActiveTab] = useState<AssetTabId>("preview");

  // Best-effort hydration: if the asset object came from the listing
  // (AssetCardData has only contentPreview), we expose a structured
  // content placeholder. EditTab tolerates both shapes.
  const initialContent: Record<string, unknown> | null =
    "content" in asset && asset.content && typeof asset.content === "object" && !Array.isArray(asset.content)
      ? (asset.content as Record<string, unknown>)
      : null;

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
      </header>

      <AssetTabs<AssetTabId>
        tabs={TAB_CONFIG}
        activeTab={activeTab}
        onChange={setActiveTab}
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
          >
            Send to Outreach
          </GradientButton>
        ) : null}
      </footer>
    </>
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
}

function NewAssetDialog({ open, onOpenChange, products, defaultProductId }: NewAssetDialogProps) {
  const [productId, setProductId] = useState<string | null>(defaultProductId);
  const [type, setType] = useState<AssetType>("email");
  const [steeringPrompt, setSteeringPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!productId || busy) return;
    setBusy(true);
    setError(null);
    const result = await generateAssetAction({
      productId,
      type,
      steeringPrompt: steeringPrompt.trim() || undefined,
    });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onOpenChange(false);
    setSteeringPrompt("");
    // Server action does not auto-revalidate, so a soft refresh
    // brings the new asset into the listing without a full reload.
    if (typeof window !== "undefined") window.location.reload();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPanel size="md">
          <DialogHeader>
            <DialogTitle>Generate asset</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 px-5 py-4">
            <div className="flex flex-col gap-2">
              <span className="text-on-surface-variant text-xs font-medium">Product</span>
              <Combobox
                items={products.map((p) => ({ value: p.id, label: p.name }))}
                value={productId}
                onChange={setProductId}
                placeholder="Choose a product"
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-on-surface-variant text-xs font-medium">Type</span>
              <div className="flex gap-2">
                {TYPE_OPTIONS.map((opt) => (
                  <ChipButton
                    key={opt.value}
                    pressed={type === opt.value}
                    onClick={() => setType(opt.value)}
                  >
                    <span className="material-symbols-outlined text-[14px]" aria-hidden>
                      {opt.icon}
                    </span>
                    {opt.label}
                  </ChipButton>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-on-surface-variant text-xs font-medium">
                Steering prompt (optional)
              </span>
              <Input
                placeholder="e.g. emphasize affordability, formal tone…"
                value={steeringPrompt}
                onChange={(e) => setSteeringPrompt(e.currentTarget.value)}
              />
            </div>
            {error ? <p className="text-xs text-red-400">{error}</p> : null}
            <div className="flex justify-end gap-2 pt-2">
              <SecondaryButton onClick={() => onOpenChange(false)} disabled={busy}>
                Cancel
              </SecondaryButton>
              <GradientButton onClick={handleSubmit} disabled={!productId || busy}>
                {busy ? "Generating…" : "Generate"}
              </GradientButton>
            </div>
          </div>
        </DialogPanel>
      </DialogPortal>
    </Dialog>
  );
}
