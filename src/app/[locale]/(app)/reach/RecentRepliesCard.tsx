/**
 * BM2-F006 · Recent replies card.
 *
 * EmailLog rows with `repliedAt IS NOT NULL`, most recent first.
 * Reply body text isn't stored in MVP (no Resend webhook yet, B4),
 * so the card shows the subject line as a stand-in until then.
 */
import { getTranslations, getFormatter } from "next-intl/server";
import Image from "next/image";

import type { RecentReplyRow } from "@/lib/email/analytics";

interface Props {
  rows: RecentReplyRow[];
}

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

export async function RecentRepliesCard({ rows }: Props) {
  const t = await getTranslations("outreach.recentReplies");
  const format = await getFormatter();

  return (
    <section
      data-testid="outreach-recent-replies"
      className="glass-panel flex flex-col gap-4 rounded-2xl border border-on-surface/5 p-6"
    >
      <header>
        <h3 className="text-sm font-bold text-white">{t("title")}</h3>
        <p className="text-[11px] text-on-surface-variant/70">{t("subtitle")}</p>
      </header>
      {rows.length === 0 ? (
        // BL-110-F004 — reply tracking isn't wired (inbound email = B4),
        // so nothing ever writes repliedAt and this list is empty in prod.
        // Show an honest "待上线(B4)" message instead of "No replies yet"
        // (which falsely implies replies are being tracked at 0). Once B4
        // writes repliedAt, rows populate and the list revives.
        <p
          data-testid="outreach-recent-replies-pending"
          className="py-8 text-center text-xs text-on-surface-variant"
        >
          {t("pending")}
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((r) => (
            <li
              key={`${r.kolId}-${r.repliedAt}`}
              data-testid="outreach-recent-reply-row"
              className="flex gap-3"
            >
              <span
                aria-hidden
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-xs font-bold text-on-primary"
              >
                {r.avatarUrl ? (
                  // BL-070-F010 — 36×36 explicit dims + unoptimized for
                  // heterogeneous sender avatar CDNs.
                  <Image
                    src={r.avatarUrl}
                    alt=""
                    width={36}
                    height={36}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initialsOf(r.displayName)
                )}
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-white">
                    {r.displayName}
                  </span>
                  <time
                    dateTime={r.repliedAt}
                    title={format.dateTime(new Date(r.repliedAt), {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    className="text-[10px] text-on-surface-variant"
                  >
                    {timeAgo(r.repliedAt)}
                  </time>
                </div>
                <p
                  className="line-clamp-1 text-[12px] text-on-surface-variant"
                  title={t("bodyPlaceholderTooltip")}
                >
                  {t("subjectPrefix")} {r.subject}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
