/**
 * BM2-F010 · Brand header (Planner adjudication §13 row #6 — A 全实现).
 *
 * Tenant logo (initials fallback) + name + week range + AI-Generated
 * badge + Download PDF + Share + Regenerate. Three action buttons are
 * client-side; the rest is server-rendered.
 */
import { WeeklyReportClientActions } from "./WeeklyReportClientActions";

interface Props {
  tenant: { name: string; logoUrl: string | null };
  weekRangeLabel: string;
  reportId: string;
  aiBadge: string;
  downloadPdfLabel: string;
  shareLabel: string;
  regenerateLabel: string;
  shareToastSuccessTemplate: string;
  shareToastErrorTemplate: string;
  weekStartIso: string;
  locale: "en" | "zh";
}

function tenantInitials(name: string): string {
  const words = name
    .replace(/[^A-Za-z一-鿿\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function WeeklyReportBrandHeader({
  tenant,
  weekRangeLabel,
  reportId,
  aiBadge,
  downloadPdfLabel,
  shareLabel,
  regenerateLabel,
  shareToastSuccessTemplate,
  shareToastErrorTemplate,
  weekStartIso,
  locale,
}: Props) {
  return (
    <section
      data-testid="weekly-report-brand-header"
      className="flex flex-wrap items-center gap-6 rounded-2xl border border-white/5 bg-surface-low/60 p-6"
    >
      <div className="relative">
        {tenant.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tenant.logoUrl}
            alt={`${tenant.name} logo`}
            className="h-16 w-16 rounded-full border-2 border-cyan object-cover"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-cyan bg-surface-container shadow-[0_0_15px_rgba(0,229,255,0.15)]">
            <span className="text-2xl font-black text-cyan">
              {tenantInitials(tenant.name)}
            </span>
          </div>
        )}
      </div>
      <div className="flex-grow">
        <h3 className="text-xl font-bold text-white">{tenant.name}</h3>
        <p className="mt-1 text-sm text-on-surface-variant">{weekRangeLabel}</p>
      </div>
      <div
        className="flex flex-wrap items-center gap-3"
        data-testid="weekly-report-print-hide"
      >
        <span className="flex items-center gap-1.5 rounded-full bg-purple/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-purple">
          <span aria-hidden className="material-symbols-outlined text-[14px]">
            bolt
          </span>
          {aiBadge}
        </span>
        <WeeklyReportClientActions
          reportId={reportId}
          tenantName={tenant.name}
          weekStartIso={weekStartIso}
          locale={locale}
          downloadPdfLabel={downloadPdfLabel}
          shareLabel={shareLabel}
          regenerateLabel={regenerateLabel}
          shareToastSuccessTemplate={shareToastSuccessTemplate}
          shareToastErrorTemplate={shareToastErrorTemplate}
        />
      </div>
    </section>
  );
}
