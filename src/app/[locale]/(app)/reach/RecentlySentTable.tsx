/**
 * BM2-F006 · "Recently sent" table (replaces Stitch Active send queue
 * per Planner adjudication §12 #F).
 *
 * Latest 10 EmailLog rows for the tenant; status is the outcome
 * (sent / mock_sent / bounced / failed), not a queue state.
 */
import { getTranslations, getFormatter } from "next-intl/server";
import Image from "next/image";

import { StatusBadge } from "@/components/common/StatusBadge";
import { TBody, THead, TRow, Table, TCell } from "@/components/ui/Table";

import type { RecentlySentRow } from "@/lib/email/analytics";

interface Props {
  rows: RecentlySentRow[];
}

const KNOWN_EMAIL_STATUSES = [
  "queued",
  "sent",
  "opened",
  "replied",
  "bounced",
  "mock_sent",
  "failed",
] as const;
type KnownEmailStatus = (typeof KNOWN_EMAIL_STATUSES)[number];

function emailStatusLabel(
  status: string,
  tStatus: (key: KnownEmailStatus) => string
): string {
  const typed = (KNOWN_EMAIL_STATUSES as readonly string[]).includes(status)
    ? (status as KnownEmailStatus)
    : "sent";
  return tStatus(typed);
}

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export async function RecentlySentTable({ rows }: Props) {
  const t = await getTranslations("outreach.recentlySent");
  const tStatus = await getTranslations("outreach.emailStatus");
  const format = await getFormatter();

  return (
    <section
      data-testid="outreach-recently-sent"
      className="glass-panel rounded-2xl border border-on-surface/5"
    >
      <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
        <h2 className="text-lg font-bold text-white">{t("title")}</h2>
        <span className="text-[11px] font-semibold text-on-surface-variant/70">
          {t("subtitle")}
        </span>
      </header>
      {rows.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-on-surface-variant">
          {t("empty")}
        </p>
      ) : (
        <Table>
          <THead>
            <TRow interactive={false}>
              <TCell as="th">{t("cols.kol")}</TCell>
              <TCell as="th">{t("cols.campaign")}</TCell>
              <TCell as="th">{t("cols.subject")}</TCell>
              <TCell as="th">{t("cols.status")}</TCell>
              <TCell as="th" align="right">
                {t("cols.sentAt")}
              </TCell>
            </TRow>
          </THead>
          <TBody>
            {rows.map((r) => (
              <TRow
                key={r.id}
                data-testid="outreach-recently-sent-row"
                data-kol-id={r.kolId ?? ""}
              >
                <TCell>
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-[10px] font-bold text-on-primary"
                    >
                      {r.avatarUrl ? (
                        // BL-070-F010 — 32×32 explicit dims + unoptimized for
                        // heterogeneous recipient avatar CDNs.
                        <Image
                          src={r.avatarUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="h-full w-full object-cover"
                          unoptimized
                        />
                      ) : (
                        initialsOf(r.displayName)
                      )}
                    </span>
                    <span className="truncate text-sm font-semibold text-white">
                      {r.displayName ?? "—"}
                    </span>
                  </div>
                </TCell>
                <TCell>
                  <span className="truncate text-sm text-on-surface">
                    {r.campaignName ?? "—"}
                  </span>
                </TCell>
                <TCell>
                  <span className="line-clamp-1 text-sm text-on-surface-variant">
                    {r.subject}
                  </span>
                </TCell>
                <TCell>
                  <StatusBadge
                    domain="email"
                    status={r.status}
                    label={emailStatusLabel(r.status, tStatus)}
                  />
                </TCell>
                <TCell align="right" numeric>
                  <span className="text-xs text-on-surface-variant">
                    {r.sentAt
                      ? format.dateTime(new Date(r.sentAt), {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </span>
                </TCell>
              </TRow>
            ))}
          </TBody>
        </Table>
      )}
    </section>
  );
}
