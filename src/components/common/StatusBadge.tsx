/**
 * Hotfix-F001 · `<StatusBadge>` — domain-aware coloured pill.
 *
 * Four supported domains map to the project's status enums:
 *
 *   campaign        — draft / active / completed
 *   kolRelationship — prospect / first_contact / negotiating /
 *                     long_term / paused / terminated  (BM1 Kol model)
 *   kolCampaign     — pending / contacted / quoted / signed /
 *                     delivered / paid  (BM2 KolCampaign 6-stage)
 *   email           — queued / sent / opened / replied / bounced
 *
 * Unknown statuses fall back to a neutral grey tone so a typo never
 * crashes the page; logging the surprise is the caller's job.
 */
import { cn } from "@/lib/utils";

export type StatusDomain =
  | "campaign"
  | "kolRelationship"
  | "kolCampaign"
  | "email";

const NEUTRAL = "border-outline-variant bg-surface-high/40 text-on-surface-variant";
const CYAN = "border-cyan/30 bg-cyan/10 text-cyan";
const EMERALD = "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
const PURPLE = "border-purple/30 bg-purple/10 text-purple";
const ERROR = "border-error/30 bg-error/10 text-error";

const TONE_MAP: Record<StatusDomain, Record<string, string>> = {
  campaign: {
    draft: NEUTRAL,
    active: CYAN,
    completed: EMERALD,
  },
  kolRelationship: {
    prospect: NEUTRAL,
    first_contact: CYAN,
    negotiating: PURPLE,
    long_term: EMERALD,
    paused: NEUTRAL,
    terminated: ERROR,
  },
  kolCampaign: {
    pending: NEUTRAL,
    contacted: CYAN,
    quoted: PURPLE,
    signed: EMERALD,
    delivered: EMERALD,
    paid: EMERALD,
  },
  email: {
    queued: NEUTRAL,
    sent: CYAN,
    opened: CYAN,
    replied: EMERALD,
    bounced: ERROR,
  },
};

export interface StatusBadgeProps {
  domain: StatusDomain;
  status: string;
  /** Visible text — usually the localized status label. */
  label: string;
  className?: string;
  /** Render with an animated pulse dot (active campaigns, etc). */
  pulse?: boolean;
}

export function StatusBadge({
  domain,
  status,
  label,
  className,
  pulse,
}: StatusBadgeProps) {
  const tone = TONE_MAP[domain]?.[status] ?? NEUTRAL;
  return (
    <span
      data-testid="status-badge"
      data-domain={domain}
      data-status={status}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        tone,
        className
      )}
    >
      {pulse ? (
        <span
          aria-hidden
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
        />
      ) : null}
      {label}
    </span>
  );
}
