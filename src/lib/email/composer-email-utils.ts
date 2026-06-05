/**
 * BL-083-F005 · Pure email-provenance helpers for the outreach composer.
 *
 * Kept in a standalone, dependency-free module (no `auth` / Prisma
 * imports) so BOTH the server data loader (`composer-data.ts`) AND the
 * client composer (`OutreachComposer.tsx`) can import them without
 * dragging server-only code into the client bundle.
 */

/** Coerce a `kol.emails` JSONB value into a list of non-empty strings.
 *  The column is untyped JSON, so guard defensively. */
export function coerceComposerEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

/** The address a send defaults to: the first fork-unlocked business email
 *  if present, else the legacy single email, else null. */
export function pickPrimaryEmail(
  emails: string[],
  legacyEmail: string | null,
): string | null {
  if (emails.length > 0) return emails[0];
  return legacyEmail && legacyEmail.length > 0 ? legacyEmail : null;
}

/** True when the KOL has a usable email but it came from bio-regex
 *  extraction (lower deliverability) rather than a fork business-email
 *  unlock. Drives the composer's "verify this address" warning banner +
 *  per-row tooltip. */
export function isBioRegexOnly(row: {
  email: string | null;
  emails: string[];
  emailSource: string | null;
}): boolean {
  const hasEmail = row.email != null && row.email.length > 0;
  return hasEmail && row.emails.length === 0 && row.emailSource === "bio-regex";
}
