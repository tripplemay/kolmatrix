/**
 * BM2 · KolCampaign.status enum (app-layer).
 *
 * 6-value contact lifecycle locked by MVP PRD §11:
 *
 *   pending → contacted → quoted → signed → delivered → paid
 *
 * Transitions allowed: any forward step (skips are OK — jumping
 * pending → signed is legal when a marketer imports an already-agreed
 * KOL). Backwards transitions are NOT rejected at the app layer (MVP
 * trade-off: the audit_log catches misuse; blocking edge-cases is
 * F011-backlog territory). Paused is explicitly out of scope.
 */
import { z } from "zod";

export const KOL_CAMPAIGN_STATUS_VALUES = [
  "pending",
  "contacted",
  "quoted",
  "signed",
  "delivered",
  "paid",
] as const;
export type KolCampaignStatus = (typeof KOL_CAMPAIGN_STATUS_VALUES)[number];

export const kolCampaignStatusSchema = z.enum(KOL_CAMPAIGN_STATUS_VALUES);

export function isKolCampaignStatus(v: string): v is KolCampaignStatus {
  return (KOL_CAMPAIGN_STATUS_VALUES as readonly string[]).includes(v);
}

/**
 * Ordering used for UI hints ("X completed stages"). Does not enforce
 * transition rules in the DB — zod + audit_log are the guardrails.
 */
export function kolCampaignStatusIndex(status: KolCampaignStatus): number {
  return KOL_CAMPAIGN_STATUS_VALUES.indexOf(status);
}
