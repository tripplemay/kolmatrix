/**
 * MVP-vf-F006 · Empty state for the Collabs / Contacts / AI tabs.
 *
 * Per F005 acceptance these tabs sit in B2-B6 territory; the marketer
 * sees a friendly "what's coming" message instead of a blank panel.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";

import type { KolTabKey } from "./KolTabsNav";

interface Props {
  tab: KolTabKey;
}

export async function EmptyTabState({ tab }: Props) {
  const tTabs = await getTranslations("kolProfile.tabs");
  const tEmpty = await getTranslations("kolProfile.emptyTab");
  return (
    <GlassPanel
      data-testid={`kol-empty-${tab}`}
      className="rounded-2xl border border-on-surface/5 p-10 text-center"
    >
      <h2 className="text-lg font-semibold text-white">{tTabs(tab)}</h2>
      <p className="mt-3 text-sm text-on-surface-variant">{tEmpty(tab)}</p>
    </GlassPanel>
  );
}
