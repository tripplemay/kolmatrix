/**
 * BM2-F007 · Recent stage changes table.
 *
 * audit_log-driven, action='kol.relationship_changed', last 30 rows.
 * Per Planner adjudication §13 #H:A — spec wins over Stitch's
 * KolCampaign-snapshot variant because the audit_log stream is the
 * CRM page's unique value (who/when/before→after).
 */
import { getTranslations, getFormatter } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";

import { StatusBadge } from "@/components/common/StatusBadge";
import { TBody, THead, TRow, Table, TCell } from "@/components/ui/Table";

import {
  RELATIONSHIP_STATUSES,
  type RelationshipStatus,
} from "@/lib/kol/filters";
import type { CrmRecentChange } from "@/lib/crm/overview";

interface Props {
  rows: CrmRecentChange[];
  locale: string;
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const STATUS_SET = new Set<string>(RELATIONSHIP_STATUSES);

export async function CrmRecentChanges({ rows, locale }: Props) {
  const t = await getTranslations("crm.recentChanges");
  const tStatus = await getTranslations("relationshipStatus");
  const format = await getFormatter();

  return (
    <section
      data-testid="crm-recent-changes"
      className="overflow-hidden rounded-2xl border border-white/5 bg-surface-low/60"
    >
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <div>
          <h2 className="text-lg font-bold text-white">{t("title")}</h2>
          <p className="mt-0.5 text-[11px] text-on-surface-variant/70">
            {t("subtitle")}
          </p>
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-6 py-12 text-center text-sm text-on-surface-variant">
          {t("empty")}
        </p>
      ) : (
        <Table>
          <THead>
            <TRow interactive={false}>
              <TCell as="th">{t("cols.kol")}</TCell>
              <TCell as="th">{t("cols.actor")}</TCell>
              <TCell as="th">{t("cols.when")}</TCell>
              <TCell as="th">{t("cols.before")}</TCell>
              <TCell as="th">{t("cols.after")}</TCell>
            </TRow>
          </THead>
          <TBody>
            {rows.map((r, i) => {
              const before =
                r.before && STATUS_SET.has(r.before)
                  ? (r.before as RelationshipStatus)
                  : null;
              const after =
                r.after && STATUS_SET.has(r.after)
                  ? (r.after as RelationshipStatus)
                  : null;
              return (
                <TRow
                  key={`${r.kolId ?? "k"}-${r.changedAt}-${i}`}
                  data-testid="crm-recent-changes-row"
                  data-kol-id={r.kolId ?? ""}
                >
                  <TCell>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary"
                      >
                        {r.kolAvatarUrl ? (
                          // BL-070-F010 — 36×36 explicit dims + unoptimized for
                          // heterogeneous platform avatar CDNs.
                          <Image
                            src={r.kolAvatarUrl}
                            alt=""
                            width={36}
                            height={36}
                            className="h-full w-full object-cover"
                            unoptimized
                          />
                        ) : (
                          initialsOf(r.kolName)
                        )}
                      </span>
                      <div className="min-w-0">
                        {r.kolId ? (
                          <Link
                            href={`/${locale}/kols/${r.kolId}`}
                            className="truncate text-sm font-semibold text-white hover:text-cyan"
                          >
                            {r.kolName ?? "—"}
                          </Link>
                        ) : (
                          <span className="text-sm text-on-surface-variant">
                            —
                          </span>
                        )}
                      </div>
                    </div>
                  </TCell>
                  <TCell>
                    <span className="text-xs text-on-surface">
                      {r.actorName ?? r.actorId?.slice(0, 8) ?? "—"}
                    </span>
                  </TCell>
                  <TCell>
                    <time
                      dateTime={r.changedAt}
                      className="text-xs text-on-surface-variant"
                      title={format.dateTime(new Date(r.changedAt), {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    >
                      {format.dateTime(new Date(r.changedAt), {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  </TCell>
                  <TCell>
                    {before ? (
                      <StatusBadge
                        domain="kolRelationship"
                        status={before}
                        label={tStatus(before)}
                      />
                    ) : (
                      <span className="text-xs text-on-surface-variant">—</span>
                    )}
                  </TCell>
                  <TCell>
                    {after ? (
                      <StatusBadge
                        domain="kolRelationship"
                        status={after}
                        label={tStatus(after)}
                      />
                    ) : (
                      <span className="text-xs text-on-surface-variant">—</span>
                    )}
                  </TCell>
                </TRow>
              );
            })}
          </TBody>
        </Table>
      )}
    </section>
  );
}
