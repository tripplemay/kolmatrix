"use client";

/**
 * BL-069-F003 · Client wrapper that wires BriefAiInputBar.onParsed →
 * CampaignForm.applyParsed via a ref. Keeps the page-level RSC free of
 * client-only state plumbing.
 *
 * BL-069-F005: onSubmit now calls createCampaignFromBriefAction and
 * router.push("/match?campaignId=:id") on success so the /match mount
 * triggers the BL-067 F005 pre-warm worker. Failure modes surface a
 * compact toast above the form (silent fallback per §5 不变量 #4 —
 * form stays usable so the user can retry / edit / submit manually).
 */
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import {
  createCampaignFromBriefAction,
  type ParsedBriefFields,
} from "./brief-actions";
import {
  BriefAiInputBar,
  type BriefAiInputBarLabels,
} from "./BriefAiInputBar";
import {
  CampaignForm,
  type CampaignFormFields,
  type CampaignFormHandle,
  type CampaignFormLabels,
  type CampaignFormMarketLabels,
} from "./CampaignForm";

interface ProductOption {
  id: string;
  name: string;
  category: string;
}

export interface BriefPageClientSubmitLabels {
  unauthorized: string;
  validationFailed: string;
  productNotFound: string;
  internalError: string;
}

interface Props {
  locale: string;
  products: ProductOption[];
  aiLabels: BriefAiInputBarLabels;
  formLabels: CampaignFormLabels;
  marketLabels: CampaignFormMarketLabels;
  submitErrorLabels: BriefPageClientSubmitLabels;
}

export function BriefPageClient({
  locale,
  products,
  aiLabels,
  formLabels,
  marketLabels,
  submitErrorLabels,
}: Props) {
  const router = useRouter();
  const formRef = useRef<CampaignFormHandle | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const onParsed = useCallback((parsed: ParsedBriefFields) => {
    formRef.current?.applyParsed(parsed);
  }, []);

  const onSubmit = useCallback(
    async (fields: CampaignFormFields) => {
      setSubmitError(null);
      // Surface a missing-product error inline rather than dispatching
      // a network round-trip we know will fail validation_failed.
      if (!fields.productId) {
        setSubmitError(submitErrorLabels.validationFailed);
        return;
      }

      const result = await createCampaignFromBriefAction({
        name: fields.name,
        productId: fields.productId,
        markets: fields.markets,
        budget:
          fields.budgetAmount && fields.budgetAmount.trim().length > 0
            ? {
                amount: Number(fields.budgetAmount),
                currency: fields.budgetCurrency,
              }
            : null,
        startDate: fields.startDate || null,
        endDate: fields.endDate || null,
        targetAudience: fields.targetAudience,
        categories: fields.categories,
      });

      if (!result.ok) {
        const message =
          result.error === "unauthorized"
            ? submitErrorLabels.unauthorized
            : result.error === "validation_failed"
              ? submitErrorLabels.validationFailed
              : result.error === "product_not_found"
                ? submitErrorLabels.productNotFound
                : submitErrorLabels.internalError;
        setSubmitError(message);
        return;
      }

      // Success → push to /match so the AiRecommendationPanel mount
      // triggers the BL-067 F005 prewarm worker (wired in BL-066/067,
      // unchanged by BL-069).
      router.push(`/${locale}/match?campaignId=${result.campaignId}`);
    },
    [router, locale, submitErrorLabels],
  );

  return (
    <div className="space-y-6">
      <BriefAiInputBar
        locale={locale}
        onParsed={onParsed}
        labels={aiLabels}
      />
      {submitError ? (
        <p
          className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-sm text-error"
          data-testid="brief-submit-error"
          role="alert"
        >
          {submitError}
        </p>
      ) : null}
      <CampaignForm
        ref={formRef}
        locale={locale}
        products={products}
        labels={formLabels}
        marketLabels={marketLabels}
        onSubmit={onSubmit}
      />
    </div>
  );
}
