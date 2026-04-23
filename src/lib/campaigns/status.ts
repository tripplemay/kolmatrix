/**
 * BM2 · Campaign status enum (app-layer).
 *
 * Per the F003 adjudication §7 (#E) we keep the 3-value lifecycle
 * {draft, active, completed} + an implicit "all" filter value. The DB
 * column is free-text String; validation lives at the zod layer to stay
 * consistent with Kol.relationshipStatus / KolCampaign.status (both
 * also enforce enums outside Postgres).
 *
 * `paused` is deliberately out of MVP scope (spec §2 Out of Scope).
 */
import { z } from "zod";

export const CAMPAIGN_STATUS_VALUES = ["draft", "active", "completed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUS_VALUES)[number];

export const CAMPAIGN_STATUS_FILTER_VALUES = [
  "all",
  ...CAMPAIGN_STATUS_VALUES,
] as const;
export type CampaignStatusFilter = (typeof CAMPAIGN_STATUS_FILTER_VALUES)[number];

export const campaignStatusSchema = z.enum(CAMPAIGN_STATUS_VALUES);
export const campaignStatusFilterSchema = z.enum(
  CAMPAIGN_STATUS_FILTER_VALUES
);

export function isCampaignStatus(value: string): value is CampaignStatus {
  return (CAMPAIGN_STATUS_VALUES as readonly string[]).includes(value);
}
