"use client";

/**
 * BM1-F003 · Single product card in the /knowledge-base grid.
 *
 * Mirrors Stitch knowledge-base.html §Card 1-3 structure: category pill →
 * title → USP/audience line → status chips at the bottom. The chip state
 * is driven by `aiAssets.status` so the user sees generation in flight,
 * success counts, or a failure prompt without refreshing JSON.
 */
import { useFormatter, useTranslations } from "next-intl";

import { cn } from "@/lib/utils";

import type { ProductListItem } from "./types";

interface Props {
  product: ProductListItem;
}

const CATEGORY_TONE: Record<string, string> = {
  MOBA: "bg-cyan/10 text-cyan",
  FPS: "bg-purple/15 text-purple",
  RPG: "bg-warning/15 text-warning",
};

function pillClass(category: string): string {
  const key = category.toUpperCase();
  return CATEGORY_TONE[key] ?? "bg-slate-800 text-on-surface-variant";
}

export function ProductCard({ product }: Props) {
  const t = useTranslations("knowledgeBase.card");
  const format = useFormatter();
  const assets = product.aiAssets;

  const emailCount =
    assets && assets.status === "ready" ? assets.emailTemplates.length : 0;
  const videoCount =
    assets && assets.status === "ready" ? assets.videoScripts.length : 0;

  return (
    <div
      className="glass-panel card-glow flex h-full flex-col rounded-2xl border border-on-surface/5 p-6"
      data-testid="product-card"
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider",
            pillClass(product.category)
          )}
        >
          {product.category}
        </div>
        <button
          type="button"
          className="text-on-surface-variant hover:text-white transition-colors"
          aria-label={t("editAction")}
          disabled
        >
          <span className="material-symbols-outlined" aria-hidden>
            more_vert
          </span>
        </button>
      </div>

      <h3 className="mb-2 text-lg font-bold text-white line-clamp-2">
        {product.name}
      </h3>
      <p className="mb-4 text-[13px] text-on-surface-variant line-clamp-2">
        {product.targetAudience ?? product.uniqueSellingPoints}
      </p>

      <div className="mt-auto space-y-2">
        {assets?.status === "ready" ? (
          <>
            <ChipRow
              tone="emerald"
              icon="check_circle"
              label={t("emailTemplates", { count: emailCount })}
            />
            <ChipRow
              tone="emerald"
              icon="check_circle"
              label={t("videoScripts", { count: videoCount })}
            />
          </>
        ) : assets?.status === "pending" ? (
          <ChipRow tone="amber" icon="progress_activity" label={t("generating")} spin />
        ) : assets?.status === "failed" ? (
          <ChipRow
            tone="rose"
            icon="error"
            label={t("generationFailed")}
          />
        ) : (
          <ChipRow
            tone="neutral"
            icon="horizontal_rule"
            label={t("noAssetsYet")}
          />
        )}
        <p className="pt-2 text-[11px] text-on-surface-variant/60">
          {t("lastUpdated", {
            date: format.dateTime(product.updatedAt, {
              year: "numeric",
              month: "short",
              day: "numeric",
            }),
          })}
        </p>
      </div>
    </div>
  );
}

interface ChipRowProps {
  tone: "emerald" | "amber" | "rose" | "neutral";
  icon: string;
  label: string;
  spin?: boolean;
}

const CHIP_TONE: Record<ChipRowProps["tone"], string> = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  neutral: "text-on-surface-variant/60",
};

function ChipRow({ tone, icon, label, spin }: ChipRowProps) {
  return (
    <div className={cn("flex items-center gap-2 text-[12px] font-medium", CHIP_TONE[tone])}>
      <span
        className={cn(
          "material-symbols-outlined text-[18px]",
          spin && "animate-spin"
        )}
        aria-hidden
      >
        {icon}
      </span>
      <span>{label}</span>
    </div>
  );
}

