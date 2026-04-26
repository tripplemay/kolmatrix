/**
 * BM2-F003 + MVP-vf-F004 · Campaign list URL ↔ where-clause plumbing.
 *
 * Mirrors the BM1 KOL filter helper. Hotfix expanded the dim list from
 * 2 → 7 (per Stitch prototype): status chips multi-select, plus four
 * extra dropdowns (Game, Region, Owner, Date range) — Owner stays
 * disabled in the UI for the MVP solo-tenant case but is read here so
 * the URL roundtrip is honest.
 */
import type { Prisma } from "@prisma/client";
import { z } from "zod";

import {
  CAMPAIGN_STATUS_VALUES,
  type CampaignStatus,
} from "./status";

export interface CampaignListFilters {
  /**
   * Selected status chips. Empty array = "All". The pre-hotfix shape
   * was a single `status: CampaignStatusFilter` ("all" | "draft" |
   * "active" | "completed"); we now lift it to an array so the chip
   * row can multi-select. Backwards-compatible URL: a lone
   * `?status=active` still parses to `["active"]`.
   */
  statuses: CampaignStatus[];
  /** Free-text match against campaign name. */
  search?: string;
  /** Campaign.game string match (Stitch dropdown). */
  games: string[];
  /** Campaign.markets array overlap (Stitch "Region" dropdown). */
  regions: string[];
  /** ownerUserId. UI is disabled in solo-tenant MVP — the param survives URL roundtrips for forward-compat. */
  ownerIds: string[];
  /** YYYY-MM-DD inclusive lower bound on Campaign.startDate. */
  dateFrom?: string;
  /** YYYY-MM-DD inclusive upper bound on Campaign.startDate. */
  dateTo?: string;
  cursor?: string;
}

const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "expected YYYY-MM-DD");

function readOne(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value;
}

function readMany(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value.flatMap((v) => v.split(",").map((s) => s.trim()).filter(Boolean));
  }
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseCampaignFilters(
  raw: Record<string, string | string[] | undefined>
): CampaignListFilters {
  const rawStatuses = readMany(raw.status);
  const statuses = rawStatuses.filter((v): v is CampaignStatus =>
    (CAMPAIGN_STATUS_VALUES as readonly string[]).includes(v)
  );

  const rawSearch = readOne(raw.search);
  const search =
    rawSearch && rawSearch.trim().length > 0 ? rawSearch.trim() : undefined;

  const rawCursor = readOne(raw.cursor);
  const cursor =
    rawCursor && rawCursor.trim().length > 0 ? rawCursor.trim() : undefined;

  const games = readMany(raw.game);
  const regions = readMany(raw.region);
  const ownerIds = readMany(raw.owner);

  const dateFromRaw = readOne(raw.dateFrom);
  const dateToRaw = readOne(raw.dateTo);
  const dateFrom = dateFromRaw && dateOnly.safeParse(dateFromRaw).success
    ? dateFromRaw
    : undefined;
  const dateTo = dateToRaw && dateOnly.safeParse(dateToRaw).success
    ? dateToRaw
    : undefined;

  return { statuses, search, games, regions, ownerIds, dateFrom, dateTo, cursor };
}

/**
 * Serialise the filter state back into URL params. Drops defaults so
 * the canonical URL stays short. `overrides` lets callers toggle a
 * single dimension (typically clearing `cursor` when another filter
 * changes).
 */
export function serializeCampaignFilters(
  filters: CampaignListFilters,
  overrides: Partial<CampaignListFilters> = {}
): URLSearchParams {
  const merged: CampaignListFilters = { ...filters, ...overrides };
  const params = new URLSearchParams();
  for (const s of merged.statuses ?? []) params.append("status", s);
  if (merged.search) params.set("search", merged.search);
  for (const g of merged.games ?? []) params.append("game", g);
  for (const r of merged.regions ?? []) params.append("region", r);
  for (const o of merged.ownerIds ?? []) params.append("owner", o);
  if (merged.dateFrom) params.set("dateFrom", merged.dateFrom);
  if (merged.dateTo) params.set("dateTo", merged.dateTo);
  if (merged.cursor) params.set("cursor", merged.cursor);
  return params;
}

/**
 * Prisma WHERE for a tenant-scoped campaign list. Tenant isolation is
 * enforced at the RLS layer (withTenant) — we do NOT add tenant_id
 * to the where clause here.
 */
export function buildCampaignWhere(
  filters: CampaignListFilters
): Prisma.CampaignWhereInput {
  const where: Prisma.CampaignWhereInput = {};
  if (filters.statuses.length > 0) {
    where.status = { in: filters.statuses };
  }
  if (filters.search) {
    where.name = { contains: filters.search, mode: "insensitive" };
  }
  if (filters.games.length > 0) {
    where.game = { in: filters.games };
  }
  if (filters.regions.length > 0) {
    where.markets = { hasSome: filters.regions };
  }
  if (filters.ownerIds.length > 0) {
    where.ownerUserId = { in: filters.ownerIds };
  }
  if (filters.dateFrom || filters.dateTo) {
    where.startDate = {};
    if (filters.dateFrom) where.startDate.gte = new Date(filters.dateFrom);
    if (filters.dateTo) where.startDate.lte = new Date(filters.dateTo);
  }
  return where;
}
