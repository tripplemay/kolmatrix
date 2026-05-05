#!/usr/bin/env npx tsx
/**
 * BL-035-F007 (AI-H3) — drop body PII from EmailLog rows older than
 * the retention horizon (default 30 days).
 *
 * Rationale: EmailLog.bodyHtml stores the post-substitution full
 * email body — KOL real names + emails + any free-text the marketer
 * pasted into the composer. It's load-bearing for "show me the email
 * I sent last week" but turns into a slow-leak privacy debt as soon
 * as a row is ~1 month old. Replace `bodyHtml` with the marker
 * "[REDACTED 30d retention]" and keep the metadata columns
 * (subject / to / status / providerMessageId / sentAt etc.) so
 * analytics + tracking remain functional.
 *
 * Usage:
 *   # Dry-run (default — prints what would change, writes nothing):
 *   npx tsx scripts/redact-old-email-logs.ts
 *
 *   # Real run:
 *   npx tsx scripts/redact-old-email-logs.ts --apply
 *
 *   # Override the horizon (default 30):
 *   EMAIL_LOG_RETENTION_DAYS=14 npx tsx scripts/redact-old-email-logs.ts --apply
 *
 * Crontab (user manual todo, spec §6.1 #3):
 *   0 2 * * * cd /opt/kolmatrix && npx tsx \
 *     scripts/redact-old-email-logs.ts --apply \
 *     >> /var/log/kolmatrix-redact.log 2>&1
 *
 * Rollback — once a row is redacted, the original bodyHtml is gone.
 * Restore from pg_dump captured before --execute, or accept the loss
 * (the row's metadata still tells you "we sent X to Y at T").
 */
import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

const REDACTION_MARKER = "[REDACTED 30d retention]";
const DEFAULT_RETENTION_DAYS = 30;

interface RedactStats {
  candidates: number;
  redacted: number;
  alreadyRedacted: number;
}

interface RedactOptions {
  apply: boolean;
  retentionDays: number;
  prisma: PrismaClient;
  log?: (msg: string) => void;
}

export async function redactOldEmailLogs(opts: RedactOptions): Promise<RedactStats> {
  const log = opts.log ?? console.log;
  const cutoff = new Date(Date.now() - opts.retentionDays * 24 * 60 * 60 * 1000);

  const candidateIds = (await opts.prisma.emailLog.findMany({
    where: {
      createdAt: { lt: cutoff },
      bodyHtml: { not: REDACTION_MARKER },
    },
    select: { id: true },
  })) as Array<{ id: string }>;

  const stats: RedactStats = {
    candidates: candidateIds.length,
    redacted: 0,
    alreadyRedacted: 0,
  };

  log(
    `[redact] cutoff=${cutoff.toISOString()} candidates=${stats.candidates} apply=${opts.apply}`,
  );

  if (!opts.apply || stats.candidates === 0) {
    return stats;
  }

  // Single bulk UPDATE — no need to fan out per-row because the
  // redaction is idempotent and cross-tenant on purpose (admin
  // client; tenants don't get to opt out of retention).
  const result = await opts.prisma.emailLog.updateMany({
    where: {
      id: { in: candidateIds.map((row) => row.id) },
      bodyHtml: { not: REDACTION_MARKER },
    },
    data: { bodyHtml: REDACTION_MARKER },
  });
  stats.redacted = result.count;
  return stats;
}

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const retentionDays = (() => {
    const raw = process.env.EMAIL_LOG_RETENTION_DAYS;
    const parsed = raw === undefined || raw === "" ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_RETENTION_DAYS;
  })();

  const connectionString = process.env.DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_ADMIN_URL (or DATABASE_URL fallback) must be set to run the redactor",
    );
  }
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const stats = await redactOldEmailLogs({ apply, retentionDays, prisma });
    console.log(
      `[redact] done apply=${apply} retentionDays=${retentionDays} candidates=${stats.candidates} redacted=${stats.redacted}`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

const invokedDirectly = (() => {
  if (typeof process === "undefined" || !process.argv?.[1]) return false;
  // Match either `tsx scripts/redact-old-email-logs.ts` or a compiled
  // .js path; argv[1] is the entry script the runner loaded.
  return /redact-old-email-logs\.(ts|js)$/.test(process.argv[1]);
})();

if (invokedDirectly) {
  main().catch((err) => {
    console.error("[redact] failed:", err);
    process.exitCode = 1;
  });
}
