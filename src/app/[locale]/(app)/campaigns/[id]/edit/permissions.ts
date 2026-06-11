/**
 * BL-105-F001 · Campaign edit permission gate.
 *
 * Editing a campaign is restricted to its owner or an admin-tier user
 * (the detail page itself stays tenant-scoped read-only). The underlying
 * server actions enforce tenant scoping via RLS; this is the additional
 * owner/admin gate the spec requires at the page layer (双层门控).
 *
 * Pure + dependency-free so it's unit-testable without the RSC harness.
 */
import { isAdminRole } from "@/lib/auth/roles";

export function canEditCampaign(
  ownerUserId: string,
  userId: string | null | undefined,
  role: string | null | undefined,
): boolean {
  if (!userId) return false;
  if (ownerUserId === userId) return true;
  return isAdminRole(role);
}
