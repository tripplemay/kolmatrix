/**
 * BM2-F003 · Campaign list URL ↔ where-clause plumbing.
 *
 * Mirrors the BM1 KOL filter helper (src/lib/kol/filters.ts) so the
 * /campaigns page reads search params straight from Next's route and
 * builds a Prisma `where` + cursor cursor without leaking details into
 * the server component.
 */
import type { Prisma } from "@prisma/client";

import {
  CAMPAIGN_STATUS_FILTER_VALUES,
  type CampaignStatusFilter,
} from "./status";

export interface CampaignListFilters {
  status: CampaignStatusFilter; // "all" when unset
  search?: string;
  cursor?: string;
}

function readOne(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

export function parseCampaignFilters(
  raw: Record<string, string | string[] | undefined>
): CampaignListFilters {
  const rawStatus = readOne(raw.status);
  const status: CampaignStatusFilter =
    rawStatus &&
    (CAMPAIGN_STATUS_FILTER_VALUES as readonly string[]).includes(rawStatus)
      ? (rawStatus as CampaignStatusFilter)
      : "all";

  const rawSearch = readOne(raw.search);
  const search =
    rawSearch && rawSearch.trim().length > 0 ? rawSearch.trim() : undefined;

  const rawCursor = readOne(raw.cursor);
  const cursor =
    rawCursor && rawCursor.trim().length > 0 ? rawCursor.trim() : undefined;

  return { status, search, cursor };
}

/**
 * Serialise the filter state back into URL params. Drops defaults so
 * the canonical URL stays short (`?status=draft` vs
 * `?status=draft&search=`). `overrides` lets callers toggle a single
 * dimension (typically clearing `cursor` when another filter changes).
 */
export function serializeCampaignFilters(
  filters: CampaignListFilters,
  overrides: Partial<CampaignListFilters> = {}
): URLSearchParams {
  const merged: CampaignListFilters = { ...filters, ...overrides };
  const params = new URLSearchParams();
  if (merged.status && merged.status !== "all") {
    params.set("status", merged.status);
  }
  if (merged.search) params.set("search", merged.search);
  if (merged.cursor) params.set("cursor", merged.cursor);
  return params;
}

/**
 * Prisma WHERE for a tenant-scoped campaign list. Tenant isolation is
 * enforced at the RLS layer (withTenant) — we do NOT add tenant_id to
 * the where clause here.
 */
export function buildCampaignWhere(
  filters: CampaignListFilters
): Prisma.CampaignWhereInput {
  const where: Prisma.CampaignWhereInput = {};
  if (filters.status !== "all") {
    where.status = filters.status;
  }
  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }
  return where;
}
