/**
 * BL-051a-F010 · Pure-function unit tests for the share-token
 * lifecycle helper introduced in F002 (`validateShareTokenState`).
 *
 * Covered:
 *   - Live token in the future → 'valid'
 *   - Past expiresAt → 'expired'
 *   - Revoked link beats expiry order ('revoked' wins even after TTL)
 *   - null state → 'not_found'
 *   - null expiresAt → 'expired' (preserves the legacy "no token = no
 *     access" surface so the never-expires path requires a real
 *     timestamp; spec D4 deviation noted in attachShareToken)
 */
import { describe, expect, it } from "vitest";

import { validateShareTokenState } from "@/lib/weekly-report/share-token";

const NOW = new Date(Date.UTC(2026, 4, 7, 12, 0, 0));

describe("validateShareTokenState", () => {
  it("returns 'valid' when expiresAt is in the future and not revoked", () => {
    const future = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    expect(
      validateShareTokenState(
        { expiresAt: future, revokedAt: null },
        NOW
      )
    ).toBe("valid");
  });

  it("returns 'expired' once expiresAt has passed", () => {
    const past = new Date(NOW.getTime() - 1);
    expect(
      validateShareTokenState({ expiresAt: past, revokedAt: null }, NOW)
    ).toBe("expired");
  });

  it("returns 'revoked' even when the token is still inside its TTL", () => {
    const future = new Date(NOW.getTime() + 24 * 60 * 60 * 1000);
    const revokedAt = new Date(NOW.getTime() - 60_000);
    expect(
      validateShareTokenState({ expiresAt: future, revokedAt }, NOW)
    ).toBe("revoked");
  });

  it("returns 'revoked' when expired AND revoked (revocation wins)", () => {
    const past = new Date(NOW.getTime() - 1);
    const revokedAt = new Date(NOW.getTime() - 120_000);
    expect(
      validateShareTokenState({ expiresAt: past, revokedAt }, NOW)
    ).toBe("revoked");
  });

  it("returns 'not_found' when state is null", () => {
    expect(validateShareTokenState(null, NOW)).toBe("not_found");
  });

  it("returns 'expired' when expiresAt is null (no live token)", () => {
    expect(
      validateShareTokenState({ expiresAt: null, revokedAt: null }, NOW)
    ).toBe("expired");
  });
});
