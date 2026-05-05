/**
 * UUID-shaped string validation.
 *
 * Lives in its own module (no DATABASE_URL dependency) so callers can
 * import it from raw-SQL builders that must NOT pull in the Prisma
 * singleton at module load time (e.g. test files that boot a
 * Testcontainers DB inside beforeAll).
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Throw when `value` is not a UUID string. Used by raw-SQL paths
 * (BL-034 F004 etc.) to defend against malformed identifiers reaching
 * the database even after the eventual `::uuid` cast would also reject
 * them.
 */
export function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(`${label} must be a UUID string, got ${value}`);
  }
}
