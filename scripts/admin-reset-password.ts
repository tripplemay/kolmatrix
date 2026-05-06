/**
 * One-shot admin password reset.
 *
 * Authored 2026-05-06 to recover prod login after the 2026-04-24 random
 * rotation password was lost. **Delete this file in the next commit
 * after the reset has run.**
 *
 * Usage (prod or staging):
 *   RESET_PASSWORD='<new password ≥12 chars>' npx tsx scripts/admin-reset-password.ts
 *
 * Constraints:
 *   - Hard-coded target emails (admin@ + marketer@kolmatrix.local) — no
 *     way to pass an arbitrary email from the CLI by accident.
 *   - Password read from env var (not argv) so it doesn't show up in
 *     `ps aux` listings.
 *   - Rejects passwords shorter than 12 chars to honour BL-035-F001's
 *     credential minimum.
 *   - Bcrypt cost factor 12 — same as prisma/seed.ts:260.
 */
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const TARGETS = ["admin@kolmatrix.local", "marketer@kolmatrix.local"] as const;
const MIN_PASSWORD_LENGTH = 12;
const BCRYPT_COST = 12;

async function main(): Promise<void> {
  const newPassword = process.env.RESET_PASSWORD;
  if (!newPassword) {
    console.error(
      "[reset-password] RESET_PASSWORD env var not set; aborting.",
    );
    process.exit(2);
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    console.error(
      `[reset-password] RESET_PASSWORD must be >= ${MIN_PASSWORD_LENGTH} chars (BL-035-F001 minimum); aborting.`,
    );
    process.exit(2);
  }

  const prisma = new PrismaClient();
  try {
    const hashedPassword = await bcrypt.hash(newPassword, BCRYPT_COST);
    let updated = 0;
    for (const email of TARGETS) {
      const result = await prisma.user.updateMany({
        where: { email },
        data: { hashedPassword },
      });
      console.log(
        `[reset-password] ${email}: ${result.count} row(s) updated.`,
      );
      updated += result.count;
    }
    if (updated !== TARGETS.length) {
      console.error(
        `[reset-password] expected ${TARGETS.length} updates, got ${updated}; check DB.`,
      );
      process.exit(3);
    }
    console.log(
      `[reset-password] ${updated}/${TARGETS.length} accounts reset successfully.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[reset-password] fatal:", err);
  process.exit(1);
});
