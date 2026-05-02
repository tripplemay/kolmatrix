"use client";

/**
 * BM1-F003 · Single product card in the /knowledge-base grid.
 *
 * Mirrors Stitch knowledge-base.html §Card 1-3 structure: category pill →
 * title → USP/audience line → status chips at the bottom. The chip state
 * is driven by `aiAssets.status` so the user sees generation in flight,
 * success counts, or a failure prompt without refreshing JSON.
 *
 * BL-025-F007: when assets are ready, the email + video chip rows
 * become `next/link` anchors targeting `/assets?productId=…&types=…`
 * so a click jumps to the asset library with the right filters
 * pre-applied. Pending / failed / null states stay as static rows
 * (no asset rows to navigate to yet).
 */
import { useFormatter, useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useState, useTransition } from "react";

import { cn } from "@/lib/utils";

import { triggerAiGeneration } from "./actions";
import type { ProductListItem } from "./types";

interface Props {
  product: ProductListItem;
  onEdit: (product: ProductListItem) => void;
  onDelete: (product: ProductListItem) => void;
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

export function ProductCard({ product, onEdit, onDelete }: Props) {
  const t = useTranslations("knowledgeBase.card");
  const format = useFormatter();
  const locale = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const [generatePending, startGenerate] = useTransition();
  const [generateError, setGenerateError] = useState<string | null>(null);
  const assets = product.aiAssets;
  const canTriggerGenerate = !assets || assets.status === "failed";

  const handleGenerate = () => {
    setGenerateError(null);
    startGenerate(async () => {
      const res = await triggerAiGeneration(product.id);
      if (!res.ok) {
        setGenerateError(res.error ?? "generic");
      }
    });
  };

  const emailCount = assets && assets.status === "ready" ? assets.emailTemplates.length : 0;
  const videoCount = assets && assets.status === "ready" ? assets.videoScripts.length : 0;

  return (
    <div
      className="glass-panel card-glow border-on-surface/5 flex h-full flex-col rounded-2xl border p-6"
      data-testid="product-card"
    >
      <div className="mb-4 flex items-start justify-between">
        <div
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider uppercase",
            pillClass(product.category)
          )}
        >
          {product.category}
        </div>
        <div className="relative">
          <button
            type="button"
            className="text-on-surface-variant transition-colors hover:text-white"
            aria-label={t("editAction")}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <span className="material-symbols-outlined" aria-hidden>
              more_vert
            </span>
          </button>
          {menuOpen ? (
            <div className="border-outline-variant bg-surface-high absolute top-7 right-0 z-10 w-32 rounded-lg border p-1 shadow-xl">
              <button
                type="button"
                className="text-on-surface hover:bg-surface w-full rounded-md px-3 py-2 text-left text-xs"
                onClick={() => {
                  setMenuOpen(false);
                  onEdit(product);
                }}
              >
                {t("editAction")}
              </button>
              <button
                type="button"
                className="hover:bg-surface w-full rounded-md px-3 py-2 text-left text-xs text-rose-300"
                onClick={() => {
                  setMenuOpen(false);
                  onDelete(product);
                }}
              >
                {t("deleteAction")}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <h3 className="mb-2 line-clamp-2 text-lg font-bold text-white">{product.name}</h3>
      <p className="text-on-surface-variant mb-4 line-clamp-2 text-[13px]">
        {product.targetAudience ?? product.uniqueSellingPoints}
      </p>

      <div className="mt-auto space-y-2">
        {assets?.status === "ready" ? (
          <>
            <ChipRow
              tone="emerald"
              icon="check_circle"
              label={t("emailTemplates", { count: emailCount })}
              href={`/${locale}/assets?productId=${product.id}&types=email`}
              ariaLabel={t("emailTemplates", { count: emailCount })}
            />
            <ChipRow
              tone="emerald"
              icon="check_circle"
              label={t("videoScripts", { count: videoCount })}
              href={`/${locale}/assets?productId=${product.id}&types=video_script`}
              ariaLabel={t("videoScripts", { count: videoCount })}
            />
          </>
        ) : assets?.status === "pending" ? (
          <ChipRow tone="amber" icon="progress_activity" label={t("generating")} spin />
        ) : assets?.status === "failed" ? (
          <ChipRow tone="rose" icon="error" label={t("generationFailed")} />
        ) : (
          <ChipRow tone="neutral" icon="horizontal_rule" label={t("noAssetsYet")} />
        )}
        {canTriggerGenerate ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generatePending}
            data-testid="product-generate-ai-button"
            className={cn(
              "border-cyan/30 bg-cyan/10 text-cyan mt-1 flex w-full items-center justify-center gap-1 rounded-lg border px-3 py-1.5 text-[12px] font-semibold transition-colors",
              "hover:border-cyan hover:bg-cyan/15 disabled:cursor-wait disabled:opacity-60"
            )}
          >
            <span
              className={cn(
                "material-symbols-outlined text-[16px]",
                generatePending && "animate-spin"
              )}
              aria-hidden
            >
              {generatePending ? "progress_activity" : "auto_awesome"}
            </span>
            <span>
              {generatePending
                ? t("generateAiPending")
                : assets?.status === "failed"
                  ? t("generateAiRetry")
                  : t("generateAiCta")}
            </span>
          </button>
        ) : null}
        {generateError ? <p className="text-[11px] text-rose-300">{t("generateAiError")}</p> : null}
        <p className="text-on-surface-variant/60 pt-2 text-[11px]">
          {t("lastUpdated", {
            date: format.dateTime(new Date(product.updatedAt), {
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
  /** When set, renders the row as a `next/link` anchor — used by
   *  F007 to jump from the KB card into /assets with filters pre-applied. */
  href?: string;
  /** Tooltip / aria-label for the link variant. */
  ariaLabel?: string;
}

const CHIP_TONE: Record<ChipRowProps["tone"], string> = {
  emerald: "text-emerald-400",
  amber: "text-amber-400",
  rose: "text-rose-400",
  neutral: "text-on-surface-variant/60",
};

function ChipRow({ tone, icon, label, spin, href, ariaLabel }: ChipRowProps) {
  const inner = (
    <>
      <span
        className={cn("material-symbols-outlined text-[18px]", spin && "animate-spin")}
        aria-hidden
      >
        {icon}
      </span>
      <span>{label}</span>
    </>
  );
  const baseClass = cn("flex items-center gap-2 text-[12px] font-medium", CHIP_TONE[tone]);

  if (href) {
    return (
      <Link
        href={href}
        title={ariaLabel ?? label}
        aria-label={ariaLabel ?? label}
        className={cn(
          baseClass,
          "hover:text-on-surface cursor-pointer transition-colors hover:opacity-90"
        )}
      >
        {inner}
      </Link>
    );
  }
  return <div className={baseClass}>{inner}</div>;
}
