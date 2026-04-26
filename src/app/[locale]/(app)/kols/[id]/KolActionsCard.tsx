/**
 * MVP-vf-F006 · Right-rail Actions card.
 *
 * Tiny shell around the existing client widgets (RelationshipStatusSelect
 * + SavedToggleButton). Lives here so page.tsx doesn't need to know
 * about either; one card == one component.
 */
import { getTranslations } from "next-intl/server";

import {
  RELATIONSHIP_STATUSES,
  type RelationshipStatus,
} from "@/lib/kol/filters";

import { RelationshipStatusSelect } from "./RelationshipStatusSelect";
import { SavedToggleButton } from "./SavedToggleButton";

interface Props {
  kolId: string;
  isSaved: boolean;
  relationshipStatus: string;
}

export async function KolActionsCard({ kolId, isSaved, relationshipStatus }: Props) {
  const t = await getTranslations("kolProfile.overview");
  const status: RelationshipStatus = (RELATIONSHIP_STATUSES as readonly string[]).includes(
    relationshipStatus
  )
    ? (relationshipStatus as RelationshipStatus)
    : "prospect";
  return (
    <div
      className="glass-panel space-y-5 rounded-2xl border border-on-surface/5 p-6"
      data-testid="kol-actions"
    >
      <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-fixed">
        {t("sectionActions")}
      </h2>
      <RelationshipStatusSelect kolId={kolId} currentStatus={status} />
      <SavedToggleButton kolId={kolId} currentSaved={isSaved} />
    </div>
  );
}
