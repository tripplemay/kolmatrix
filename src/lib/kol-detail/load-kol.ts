/**
 * BL-107-F001 (M4) · KOL detail-page loader.
 *
 * Extracted out of `kols/[id]/page.tsx` so the soft-delete / suspicious
 * filter口径 is unit-testable without pulling the whole server component
 * (next-intl/server + next/image + sub-components) into vitest.
 *
 * Audit finding (full-feature-chain-audit-2026-06-09 §M4): the detail
 * page used `findUnique({ where: { id } })` with NO `deletedAt` /
 * `isSuspicious` filter, so a soft-deleted or suspicious KOL still
 * rendered via its direct link — inconsistent with the /match list,
 * which hides them (`src/lib/kol/filters.ts`: `{ deletedAt: null }` +
 * `{ isSuspicious: false }`). We mirror that canonical口径 here:
 * `findFirst` (findUnique only accepts unique columns) with both guards,
 * so a tombstoned/suspicious KOL resolves to `null` → the page calls
 * `notFound()`.
 */
import type { Prisma } from "@prisma/client";

import { withTenant } from "@/lib/db";

const KOL_DETAIL_SELECT = {
  id: true,
  platform: true,
  handle: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  countryCode: true,
  language: true,
  followerCount: true,
  engagementRate: true,
  avgViews: true,
  categories: true,
  tags: true,
  valueScore: true,
  uploadsPerMonth: true,
  lastUploadAt: true,
  monetizationStatus: true,
  brandSafetyRating: true,
  isGaming: true,
  relationshipStatus: true,
  bannerUrl: true,
  channelCreatedAt: true,
  videoCount: true,
  externalId: true,
  metadata: true,
  emails: true,
  emailSource: true,
} as const satisfies Prisma.KolSelect;

export type KolDetailShape = Prisma.KolGetPayload<{
  select: typeof KOL_DETAIL_SELECT;
}>;

export async function loadKol(
  tenantId: string,
  kolId: string,
): Promise<KolDetailShape | null> {
  return withTenant(tenantId, async (tx) => {
    // findFirst (not findUnique): the where clause carries non-unique
    // soft-delete / suspicious guards that match the /match list口径.
    return tx.kol.findFirst({
      where: { id: kolId, deletedAt: null, isSuspicious: false },
      select: KOL_DETAIL_SELECT,
    });
  });
}
