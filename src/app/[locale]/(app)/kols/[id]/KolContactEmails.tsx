/**
 * BL-083-F004 · Contact emails section (server component).
 *
 * Lists the business emails the fork unlocked for a KOL (`kol.emails`
 * JSONB array, populated by the F003 import path / F006 backfill), each
 * tagged with a provenance chip derived from `kol.email_source`:
 *   - 'business-unlock' → green   ("unlocked via YouTube business email")
 *   - 'bio-regex'       → grey    ("extracted from bio text")
 *   - anything else / 'manual'    → neutral grey
 *
 * When the KOL has no emails the panel shows an "email not public"
 * placeholder so the section reads consistently for the ~70% of YT KOLs
 * (and all TT/IG) that have no unlocked email yet.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";

interface Props {
  /** Raw `kol.emails` JSONB value — typed loosely (Prisma.JsonValue) so
   *  the caller can pass it through without coercion. Sanitised here. */
  emails: unknown;
  /** `kol.email_source` — 'business-unlock' | 'bio-regex' | 'manual' | …  */
  emailSource: string | null;
}

/** Defensively coerce the JSONB value into a list of non-empty email
 *  strings. The write path only ever stores a string[], but the column
 *  is untyped JSON so we guard against legacy / malformed rows. Exported
 *  for unit coverage of the display logic. */
export function coerceEmails(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is string => typeof e === "string")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

export type SourceVariant = "businessUnlock" | "bioRegex" | "manual";

/** Map the raw `email_source` column value onto a presentation variant.
 *  Unknown / 'manual' values fall back to the neutral grey chip. */
export function resolveSourceVariant(emailSource: string | null): SourceVariant {
  if (emailSource === "business-unlock") return "businessUnlock";
  if (emailSource === "bio-regex") return "bioRegex";
  return "manual";
}

export async function KolContactEmails({ emails, emailSource }: Props) {
  const t = await getTranslations("kolProfile.contactEmails");
  const list = coerceEmails(emails);
  const variant = resolveSourceVariant(emailSource);

  const chipLabel =
    variant === "businessUnlock"
      ? t("sourceBusinessUnlock")
      : variant === "bioRegex"
        ? t("sourceBioRegex")
        : t("sourceManual");

  const chipClass =
    variant === "businessUnlock"
      ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
      : "border-on-surface/15 bg-on-surface/5 text-on-surface-variant";

  return (
    <GlassPanel
      className="border-on-surface/5 rounded-2xl border p-6"
      data-testid="kol-contact-emails"
    >
      <h2 className="text-cyan-fixed mb-4 text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h2>

      {list.length > 0 ? (
        <ul className="flex flex-col gap-2" data-testid="kol-contact-emails-list">
          {list.map((email) => (
            <li
              key={email}
              className="flex flex-wrap items-center justify-between gap-2"
            >
              <a
                href={`mailto:${email}`}
                className="text-on-surface hover:text-cyan text-sm break-all transition-colors"
              >
                {email}
              </a>
              <span
                data-testid={`kol-contact-email-source-${variant}`}
                className={`rounded border px-2 py-0.5 text-[11px] font-medium ${chipClass}`}
              >
                {chipLabel}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p
          className="text-on-surface-variant/70 text-sm"
          data-testid="kol-contact-emails-empty"
        >
          {t("empty")}
        </p>
      )}
    </GlassPanel>
  );
}
