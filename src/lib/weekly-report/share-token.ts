/**
 * BM2-F010 · Share-token primitives (Planner adjudication §13.5 #4 + §F010).
 *
 * - Token: 24 bytes of cryptographic randomness, base64url-encoded.
 *   Yields 32 URL-safe characters (no `+`, `/`, or `=` padding) so it
 *   slots straight into `/shared/weekly-report/{token}` without
 *   percent-encoding.
 * - Expiry: 7 days from generation.
 *
 * Pure functions only — DB write happens in `persistence.ts`.
 */
import { randomBytes } from "node:crypto";

export const SHARE_TOKEN_BYTES = 24;
export const SHARE_TOKEN_TTL_DAYS = 7;

export function generateShareToken(): string {
  return randomBytes(SHARE_TOKEN_BYTES).toString("base64url");
}

export function computeShareTokenExpiry(now: Date = new Date()): Date {
  const out = new Date(now);
  out.setUTCDate(out.getUTCDate() + SHARE_TOKEN_TTL_DAYS);
  return out;
}

export function isShareTokenExpired(
  expiresAt: Date | null,
  now: Date = new Date()
): boolean {
  if (!expiresAt) return true;
  return expiresAt.getTime() <= now.getTime();
}

// BL-051a-F002 — three-state validation surface for share tokens.
// Callers pass the persisted state pair (expiresAt + revokedAt) plus
// an optional `now`; the function returns the enum the page render and
// the revoke API both consume. `null` state = no row matched the
// token (unknown/malformed). Pure so it lives in share-token.ts and
// stays trivially unit-testable.

export type ShareTokenStatus = "valid" | "expired" | "revoked" | "not_found";

export interface ShareTokenState {
  expiresAt: Date | null;
  revokedAt: Date | null;
}

export function validateShareTokenState(
  state: ShareTokenState | null,
  now: Date = new Date()
): ShareTokenStatus {
  if (!state) return "not_found";
  // Revocation wins over expiry: an explicitly killed link must read
  // as 'revoked' even after the natural expiry, so the audit trail
  // matches the user-visible reason.
  if (state.revokedAt !== null) return "revoked";
  if (isShareTokenExpired(state.expiresAt, now)) return "expired";
  return "valid";
}
