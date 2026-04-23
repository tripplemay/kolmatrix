// BM1-F001 · KOL platform union + Zod enum (adjudication #D).
//
// Kol.platform is a TEXT column at the DB layer so future platforms
// can be added without a schema migration. Applications should go
// through this module to get:
//   - KolPlatform          — narrow TS union type
//   - KolPlatformSchema    — Zod enum for API/form validation
//   - normalizePlatform()  — canonical lowercase form used everywhere
//                            (seed + UI + filter) so equality matches.

import { z } from "zod";

export const KOL_PLATFORMS = [
  "youtube",
  "tiktok",
  "instagram",
  "twitch",
  "twitter",
] as const;

export type KolPlatform = (typeof KOL_PLATFORMS)[number];

export const KolPlatformSchema = z.enum(KOL_PLATFORMS);

const ALIASES: Record<string, KolPlatform> = {
  yt: "youtube",
  youtube: "youtube",
  "youtube.com": "youtube",
  tt: "tiktok",
  tiktok: "tiktok",
  "tiktok.com": "tiktok",
  ig: "instagram",
  insta: "instagram",
  instagram: "instagram",
  twitch: "twitch",
  "twitch.tv": "twitch",
  x: "twitter",
  twitter: "twitter",
};

/**
 * Normalize an incoming platform string (seed data, user input, URL
 * fragment) to the canonical lowercase form. Returns null for unknown
 * values so callers can decide whether to skip the row or surface an
 * error to the user.
 */
export function normalizePlatform(input: string | null | undefined): KolPlatform | null {
  if (!input) return null;
  const key = input.trim().toLowerCase();
  return ALIASES[key] ?? null;
}
