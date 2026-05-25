/**
 * Pure date helpers for `/insight/weekly-report` — no DB / framework deps so
 * range/range tests can import without spinning up Prisma.
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Monday 00:00 UTC of the ISO week containing `d`. */
export function isoWeekStartUtc(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  // ISO week: Monday=1...Sunday=7. JS getUTCDay: Sunday=0...Saturday=6.
  const dow = out.getUTCDay();
  const offsetToMonday = dow === 0 ? -6 : 1 - dow;
  out.setUTCDate(out.getUTCDate() + offsetToMonday);
  return out;
}

/** Sunday 00:00 UTC at the end of the week starting `weekStart`. */
export function isoWeekEndUtc(weekStart: Date): Date {
  return new Date(weekStart.getTime() + 6 * DAY_MS);
}
