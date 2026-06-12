/**
 * BM2-F007 · `kol.relationshipStatus` mutation helper.
 *
 * Shared by:
 *   - BM1-F006 Server Action `updateKolRelationshipStatus`
 *     (kept as-is for the kol profile page; we only re-export the
 *     enum + return shape from there if needed in future cleanup)
 *   - BM2-F007 `/crm` row select (Server Action wrapping this helper)
 *
 * BL-107-F002/M6: the `PATCH /api/kols/[id]/relationship-status` REST
 * wrapper was deleted as an orphan (zero fetch callers; the /crm Server
 * Action calls this helper directly). The helper itself is unchanged.
 *
 * Logs `kol.relationship_changed` to audit_log (the existing BM1
 * action name — Planner §13 #J:A locked) so /crm Recent Changes
 * keeps reading the same stream.
 */
import { withTenant } from "@/lib/db";
import { logAudit } from "@/lib/audit/log";
import { logEvent } from "@/lib/events/log";
import {
  RELATIONSHIP_STATUSES,
  type RelationshipStatus,
} from "@/lib/kol/filters";

export class CrmRelationshipError extends Error {
  constructor(
    public readonly code:
      | "not_found"
      | "invalid_status"
      | "db_error",
    message: string
  ) {
    super(message);
    this.name = "CrmRelationshipError";
  }
}

export function isRelationshipStatus(v: string): v is RelationshipStatus {
  return (RELATIONSHIP_STATUSES as readonly string[]).includes(v);
}

export interface UpdateRelationshipResult {
  id: string;
  relationshipStatus: RelationshipStatus;
  before: RelationshipStatus | null;
}

export async function updateKolRelationshipStatusHelper(
  tenantId: string,
  actorId: string,
  kolId: string,
  next: string
): Promise<UpdateRelationshipResult> {
  if (!isRelationshipStatus(next)) {
    throw new CrmRelationshipError("invalid_status", "unknown status");
  }

  let before: RelationshipStatus | null = null;
  let updatedRow: { id: string; relationshipStatus: RelationshipStatus };

  try {
    const result = await withTenant(tenantId, async (tx) => {
      const existing = await tx.kol.findUnique({
        where: { id: kolId },
        select: { id: true, relationshipStatus: true },
      });
      if (!existing) {
        throw new CrmRelationshipError("not_found", "kol not found");
      }
      const updated = await tx.kol.update({
        where: { id: kolId },
        data: { relationshipStatus: next },
        select: { id: true, relationshipStatus: true },
      });
      return {
        existing: existing.relationshipStatus as RelationshipStatus,
        updated: {
          id: updated.id,
          relationshipStatus: updated.relationshipStatus as RelationshipStatus,
        },
      };
    });
    before = result.existing;
    updatedRow = result.updated;
  } catch (err) {
    if (err instanceof CrmRelationshipError) throw err;
    console.error("[updateKolRelationshipStatusHelper] failed:", err);
    throw new CrmRelationshipError("db_error", "failed to update kol");
  }

  if (before !== updatedRow.relationshipStatus) {
    // Use the BM1 audit action name so /crm Recent Changes reads
    // both BM1- and BM2-originated rows uniformly.
    await logAudit({
      actorId,
      action: "kol.relationship_changed",
      targetType: "kol",
      targetId: updatedRow.id,
      tenantId,
      before: { relationshipStatus: before },
      after: { relationshipStatus: updatedRow.relationshipStatus },
    });
    void logEvent({
      type: "kol.relationship_updated",
      tenantId,
      actorId,
      resourceId: updatedRow.id,
      payload: { before, after: updatedRow.relationshipStatus },
    });
  }

  return {
    id: updatedRow.id,
    relationshipStatus: updatedRow.relationshipStatus,
    before,
  };
}
