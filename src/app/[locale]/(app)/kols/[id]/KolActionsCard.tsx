/**
 * MVP-vf-F006 · Right-rail Actions card.
 *
 * BL-063 F003: SavedToggleButton removed (isSaved decommissioned per
 * ADR-013). Card now wraps RelationshipStatusSelect alone.
 */
import { getTranslations } from "next-intl/server";

import {
  RELATIONSHIP_STATUSES,
  type RelationshipStatus,
} from "@/lib/kol/filters";

import { RelationshipStatusSelect } from "./RelationshipStatusSelect";

interface Props {
  kolId: string;
  relationshipStatus: string;
}

export async function KolActionsCard({ kolId, relationshipStatus }: Props) {
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
    </div>
  );
}
