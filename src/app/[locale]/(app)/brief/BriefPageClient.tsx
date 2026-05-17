"use client";

/**
 * BL-069-F003 · Client wrapper that wires BriefAiInputBar.onParsed →
 * CampaignForm.applyParsed via a ref. Keeps the page-level RSC free of
 * client-only state plumbing.
 *
 * Submit is left as a stub in F003 — F005 will wire it to
 * createCampaignFromBriefAction + router.push("/match?campaignId=...").
 */
import { useCallback, useRef } from "react";

import type { ParsedBriefFields } from "./brief-actions";
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

interface Props {
  locale: string;
  products: ProductOption[];
  aiLabels: BriefAiInputBarLabels;
  formLabels: CampaignFormLabels;
  marketLabels: CampaignFormMarketLabels;
}

export function BriefPageClient({
  locale,
  products,
  aiLabels,
  formLabels,
  marketLabels,
}: Props) {
  const formRef = useRef<CampaignFormHandle | null>(null);

  const onParsed = useCallback((parsed: ParsedBriefFields) => {
    formRef.current?.applyParsed(parsed);
  }, []);

  // F005 will replace this stub with createCampaignFromBriefAction +
  // router.push. For F003 we log to console so manual QA can sanity-
  // check the wiring without crashing the page.
  const onSubmit = useCallback(async (fields: CampaignFormFields) => {
    console.log("[brief] Submit (F005 will wire this):", fields);
  }, []);

  return (
    <div className="space-y-6">
      <BriefAiInputBar
        locale={locale}
        onParsed={onParsed}
        labels={aiLabels}
      />
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
