"use client";

/**
 * BL-069-F003 · Brief campaign form (client component).
 *
 * Adapts the BM2-F004 campaigns/new/CampaignForm shape for the /brief
 * route. Key changes vs the source:
 *   - Controlled React state (useState) instead of useActionState +
 *     FormData. The form fields must be programmatically updatable
 *     when BriefAiInputBar.onParsed fires (AI auto-fill flow).
 *   - kpiTarget removed; targetAudience textarea + categories
 *     multi-select added (brief-specific fields per spec §F003).
 *   - applyParsed honours §5 不变量 #6: only fill EMPTY fields. When a
 *     field is already filled and the AI suggests a different value,
 *     surface a small "AI 建议: X" diff hint next to that field.
 *   - Submit button accepts onSubmit prop (F005 will wire to
 *     createCampaignFromBriefAction); F003 ships a stub so the form is
 *     testable in isolation.
 */
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useState,
} from "react";
import Link from "next/link";

import { CAMPAIGN_MARKETS, type CampaignMarket } from "@/lib/campaigns/schema";

import type { ParsedBriefFields } from "./brief-actions";

/** Imperative handle exposed via React.forwardRef so the parent (page
 *  wrapper) can route BriefAiInputBar.onParsed callbacks into the
 *  form's encapsulated state + diff-hint logic without lifting the
 *  whole state up. */
export interface CampaignFormHandle {
  applyParsed: (parsed: ParsedBriefFields) => void;
}

export interface CampaignFormLabels {
  name: string;
  nameHint: string;
  product: string;
  productSelectorLabel: string;
  manageProductsLink: string;
  noProducts: string;
  budgetAmount: string;
  budgetCurrency: string;
  budgetHint: string;
  startDate: string;
  endDate: string;
  markets: string;
  targetAudience: string;
  targetAudienceHint: string;
  categories: string;
  categoriesHint: string;
  submit: string;
  submitting: string;
  aiDiffHintPrefix: string;
}

export interface CampaignFormMarketLabels {
  global: string;
  us: string;
  eu: string;
  jp: string;
  kr: string;
  sea: string;
  cn: string;
  latam: string;
}

interface ProductOption {
  id: string;
  name: string;
  category: string;
}

interface Props {
  locale: string;
  products: ProductOption[];
  /** State surface that BriefAiInputBar mutates via setParsedFromAi. */
  initialFields?: Partial<CampaignFormFields>;
  labels: CampaignFormLabels;
  marketLabels: CampaignFormMarketLabels;
  /** F005 will wire this to createCampaignFromBriefAction. F003 ships a
   *  no-op default so the form is render/test-able without F005. */
  onSubmit?: (fields: CampaignFormFields) => void | Promise<void>;
}

/**
 * Internal form state. Strings match HTML input semantics (controlled);
 * markets/categories are arrays for multi-select.
 */
export interface CampaignFormFields {
  name: string;
  productId: string;
  budgetAmount: string;
  budgetCurrency: string;
  startDate: string;
  endDate: string;
  markets: CampaignMarket[];
  targetAudience: string;
  categories: string[];
}

/** Per-field "AI suggested" hints surfaced when user-filled value
 *  differs from a later AI suggestion (§5 不变量 #6). Each entry is a
 *  short string the form renders below the field. */
export type AiDiffHints = Partial<Record<keyof CampaignFormFields, string>>;

const EMPTY_FIELDS: CampaignFormFields = {
  name: "",
  productId: "",
  budgetAmount: "",
  budgetCurrency: "USD",
  startDate: "",
  endDate: "",
  markets: [],
  targetAudience: "",
  categories: [],
};

const INPUT_CLASS =
  "h-10 w-full rounded-lg border border-outline-variant bg-surface/40 px-3 text-sm text-on-surface placeholder-on-surface-variant/60 focus:border-cyan focus:outline-none focus:ring-1 focus:ring-cyan";

const CURRENCY_OPTIONS = ["USD", "CNY", "JPY", "KRW", "EUR"] as const;

/**
 * Best-effort map from LLM `markets[]` strings (uppercase ISO-3166 codes
 * like "SEA"/"JP") to the project's CAMPAIGN_MARKETS enum (lowercase
 * "sea"/"jp"). Anything we can't recognise is silently dropped — the
 * user can still pick it manually.
 */
function mapAiMarkets(aiMarkets: string[]): CampaignMarket[] {
  const out = new Set<CampaignMarket>();
  for (const m of aiMarkets) {
    const lower = m.trim().toLowerCase();
    if ((CAMPAIGN_MARKETS as readonly string[]).includes(lower)) {
      out.add(lower as CampaignMarket);
    }
  }
  return [...out];
}

export const CampaignForm = forwardRef<CampaignFormHandle, Props>(function CampaignForm(
  { locale, products, initialFields, labels, marketLabels, onSubmit },
  ref,
) {
  const [fields, setFields] = useState<CampaignFormFields>({
    ...EMPTY_FIELDS,
    ...initialFields,
  });
  const [aiHints, setAiHints] = useState<AiDiffHints>({});
  const [submitting, setSubmitting] = useState(false);

  /**
   * Public API for BriefAiInputBar.onParsed (wired via page.tsx).
   * Per §5 不变量 #6 — only fill empty fields; when a field is already
   * filled AND the AI suggests a non-equal value, surface a small
   * diff hint rather than overwriting.
   */
  const applyParsed = useCallback(
    (parsed: ParsedBriefFields) => {
      // Use a functional setFields so we read the latest state in the
      // same render cycle; compute diff hints in parallel and apply
      // them via setAiHints after the field update closure returns.
      setFields((prev) => {
        const next = { ...prev };
        const hints: AiDiffHints = {};

        if (parsed.productId) {
          if (!next.productId) next.productId = parsed.productId;
          else if (next.productId !== parsed.productId) {
            const suggested = products.find((p) => p.id === parsed.productId);
            hints.productId = suggested?.name ?? parsed.productId;
          }
        }

        if (parsed.budget) {
          if (!next.budgetAmount) {
            next.budgetAmount = String(parsed.budget.amount);
            next.budgetCurrency = parsed.budget.currency;
          } else if (next.budgetAmount !== String(parsed.budget.amount)) {
            hints.budgetAmount = `${parsed.budget.amount} ${parsed.budget.currency}`;
          }
        }

        if (parsed.startDate) {
          if (!next.startDate) next.startDate = parsed.startDate;
          else if (next.startDate !== parsed.startDate) {
            hints.startDate = parsed.startDate;
          }
        }
        if (parsed.endDate) {
          if (!next.endDate) next.endDate = parsed.endDate;
          else if (next.endDate !== parsed.endDate) {
            hints.endDate = parsed.endDate;
          }
        }

        const aiMarkets = mapAiMarkets(parsed.markets);
        if (aiMarkets.length > 0) {
          if (next.markets.length === 0) next.markets = aiMarkets;
          else {
            const filtered = aiMarkets.filter((m) => !next.markets.includes(m));
            if (filtered.length > 0) {
              hints.markets = filtered.map((m) => marketLabels[m]).join(", ");
            }
          }
        }

        if (parsed.targetAudience) {
          if (!next.targetAudience) next.targetAudience = parsed.targetAudience;
          else if (next.targetAudience !== parsed.targetAudience) {
            hints.targetAudience = parsed.targetAudience;
          }
        }

        if (parsed.categories.length > 0) {
          if (next.categories.length === 0) next.categories = parsed.categories;
          else {
            const filtered = parsed.categories.filter(
              (c) => !next.categories.includes(c),
            );
            if (filtered.length > 0) hints.categories = filtered.join(", ");
          }
        }

        // Surface hints in the same tick as fields by scheduling the
        // hint update from inside the field updater. React batches
        // both setStates so the next render sees both new field
        // values and new diff hints atomically.
        setAiHints(hints);
        return next;
      });
    },
    [products, marketLabels],
  );

  // Expose applyParsed to the parent via useImperativeHandle so the
  // BriefAiInputBar.onParsed callback can route into the form's
  // encapsulated state without lifting it up.
  useImperativeHandle(ref, () => ({ applyParsed }), [applyParsed]);

  const onMarketToggle = useCallback((m: CampaignMarket) => {
    setFields((prev) => ({
      ...prev,
      markets: prev.markets.includes(m)
        ? prev.markets.filter((x) => x !== m)
        : [...prev.markets, m],
    }));
  }, []);

  const onSubmitClick = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      if (submitting || !onSubmit) return;
      setSubmitting(true);
      try {
        await onSubmit(fields);
      } finally {
        setSubmitting(false);
      }
    },
    [submitting, onSubmit, fields],
  );

  const noProducts = products.length === 0;

  return (
    <form
      onSubmit={onSubmitClick}
      className="glass-panel space-y-5 rounded-2xl border border-on-surface/5 p-6"
      data-testid="brief-campaign-form"
      noValidate
    >
      {/* Product selector */}
      <div>
        <label
          htmlFor="brief-product"
          className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
        >
          <span>
            {labels.productSelectorLabel}
            <span className="ml-1 text-cyan">*</span>
          </span>
          <Link
            href={`/${locale}/brief?tab=products`}
            data-testid="brief-manage-products-link"
            className="text-[10px] font-medium normal-case tracking-normal text-cyan hover:underline"
          >
            {labels.manageProductsLink} →
          </Link>
        </label>
        {noProducts ? (
          <p
            className="rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber"
            data-testid="brief-no-products"
          >
            {labels.noProducts}
          </p>
        ) : (
          <select
            id="brief-product"
            value={fields.productId}
            onChange={(e) =>
              setFields((p) => ({ ...p, productId: e.target.value }))
            }
            required
            data-testid="brief-product-select"
            className={INPUT_CLASS}
          >
            <option value="" disabled>
              —
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.category}
              </option>
            ))}
          </select>
        )}
        <AiHint hint={aiHints.productId} prefix={labels.aiDiffHintPrefix} field="productId" />
      </div>

      {/* Campaign name (manual entry, not parsed by LLM) */}
      <div>
        <label
          htmlFor="brief-name"
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
        >
          {labels.name}
        </label>
        <input
          id="brief-name"
          name="name"
          type="text"
          maxLength={80}
          value={fields.name}
          onChange={(e) => setFields((p) => ({ ...p, name: e.target.value }))}
          data-testid="brief-name-input"
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-[11px] text-on-surface-variant/70">
          {labels.nameHint}
        </p>
      </div>

      {/* Budget amount + currency */}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <div>
          <label
            htmlFor="brief-budget-amount"
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
          >
            {labels.budgetAmount}
          </label>
          <input
            id="brief-budget-amount"
            name="budgetAmount"
            type="text"
            inputMode="decimal"
            placeholder="10000"
            value={fields.budgetAmount}
            onChange={(e) =>
              setFields((p) => ({ ...p, budgetAmount: e.target.value }))
            }
            data-testid="brief-budget-amount"
            className={INPUT_CLASS}
          />
          <p className="mt-1 text-[11px] text-on-surface-variant/70">
            {labels.budgetHint}
          </p>
          <AiHint
            hint={aiHints.budgetAmount}
            prefix={labels.aiDiffHintPrefix}
            field="budgetAmount"
          />
        </div>
        <div>
          <label
            htmlFor="brief-budget-currency"
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
          >
            {labels.budgetCurrency}
          </label>
          <select
            id="brief-budget-currency"
            value={fields.budgetCurrency}
            onChange={(e) =>
              setFields((p) => ({ ...p, budgetCurrency: e.target.value }))
            }
            data-testid="brief-budget-currency"
            className={INPUT_CLASS}
          >
            {CURRENCY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Dates */}
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label
            htmlFor="brief-start-date"
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
          >
            {labels.startDate}
          </label>
          <input
            id="brief-start-date"
            type="date"
            value={fields.startDate}
            onChange={(e) =>
              setFields((p) => ({ ...p, startDate: e.target.value }))
            }
            data-testid="brief-start-date"
            className={INPUT_CLASS}
          />
          <AiHint
            hint={aiHints.startDate}
            prefix={labels.aiDiffHintPrefix}
            field="startDate"
          />
        </div>
        <div>
          <label
            htmlFor="brief-end-date"
            className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
          >
            {labels.endDate}
          </label>
          <input
            id="brief-end-date"
            type="date"
            value={fields.endDate}
            onChange={(e) =>
              setFields((p) => ({ ...p, endDate: e.target.value }))
            }
            data-testid="brief-end-date"
            className={INPUT_CLASS}
          />
          <AiHint
            hint={aiHints.endDate}
            prefix={labels.aiDiffHintPrefix}
            field="endDate"
          />
        </div>
      </div>

      {/* Markets */}
      <div>
        <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">
          {labels.markets}
        </span>
        <div
          className="grid grid-cols-2 gap-2 md:grid-cols-4"
          data-testid="brief-markets"
        >
          {CAMPAIGN_MARKETS.map((m) => (
            <label
              key={m}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant bg-surface/30 px-3 py-2 text-sm text-on-surface transition-colors hover:border-cyan/40"
            >
              <input
                type="checkbox"
                checked={fields.markets.includes(m)}
                onChange={() => onMarketToggle(m)}
                data-testid={`brief-market-${m}`}
                className="h-4 w-4 accent-cyan"
              />
              <span>{marketLabels[m]}</span>
            </label>
          ))}
        </div>
        <AiHint hint={aiHints.markets} prefix={labels.aiDiffHintPrefix} field="markets" />
      </div>

      {/* Target audience */}
      <div>
        <label
          htmlFor="brief-target-audience"
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
        >
          {labels.targetAudience}
        </label>
        <textarea
          id="brief-target-audience"
          rows={3}
          maxLength={500}
          value={fields.targetAudience}
          onChange={(e) =>
            setFields((p) => ({ ...p, targetAudience: e.target.value }))
          }
          data-testid="brief-target-audience"
          className={`${INPUT_CLASS} h-auto min-h-[72px] py-2 leading-5`}
        />
        <p className="mt-1 text-[11px] text-on-surface-variant/70">
          {labels.targetAudienceHint}
        </p>
        <AiHint
          hint={aiHints.targetAudience}
          prefix={labels.aiDiffHintPrefix}
          field="targetAudience"
        />
      </div>

      {/* Categories (text input csv — minimal F003 surface; F004
          ProductListPanel will own the canonical category list) */}
      <div>
        <label
          htmlFor="brief-categories"
          className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-on-surface-variant"
        >
          {labels.categories}
        </label>
        <input
          id="brief-categories"
          type="text"
          placeholder="mobile-game, rpg"
          value={fields.categories.join(", ")}
          onChange={(e) =>
            setFields((p) => ({
              ...p,
              categories: e.target.value
                .split(",")
                .map((c) => c.trim())
                .filter((c) => c.length > 0),
            }))
          }
          data-testid="brief-categories"
          className={INPUT_CLASS}
        />
        <p className="mt-1 text-[11px] text-on-surface-variant/70">
          {labels.categoriesHint}
        </p>
        <AiHint
          hint={aiHints.categories}
          prefix={labels.aiDiffHintPrefix}
          field="categories"
        />
      </div>

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={submitting || noProducts}
          data-testid="brief-submit"
          className="gradient-cta flex h-11 items-center justify-center rounded-lg px-6 text-sm font-bold text-on-primary shadow-[0_0_12px_rgba(0,229,255,0.2)] transition-transform hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? labels.submitting : labels.submit}
        </button>
      </div>
    </form>
  );
});

/**
 * Tiny AI diff hint rendered under a field when applyParsed determined
 * the AI suggestion differs from a user-filled value. Kept compact so
 * it doesn't crowd the form; clicking it could later become an
 * "accept suggestion" action (Phase 5 candidate).
 */
function AiHint({
  hint,
  prefix,
  field,
}: {
  hint: string | undefined;
  prefix: string;
  field: string;
}) {
  if (!hint) return null;
  return (
    <p
      className="mt-1 text-xs italic text-cyan/80"
      data-testid={`brief-ai-hint-${field}`}
    >
      {prefix} {hint}
    </p>
  );
}

/**
 * Test-only re-export so the brief page can wire BriefAiInputBar →
 * CampaignForm without lifting all state to the parent. Parent passes
 * a setParsedRef into both children; the AI input bar invokes
 * setParsedRef.current(parsed). This keeps applyParsed's complex diff
 * logic inside this component.
 */
export type BriefApplyParsed = (parsed: ParsedBriefFields) => void;
