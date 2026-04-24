/**
 * BM2-F006 · Domain health card (static per adjudication §12 #E).
 *
 * BI3-F005 + ADR-010 confirmed kolquest.com DKIM / SPF / DMARC are
 * validated against Resend. Reputation is a conservative static 98
 * until a real Resend Admin API ships in B4.
 */
import { getTranslations } from "next-intl/server";

export async function DomainHealthCard() {
  const t = await getTranslations("outreach.domainHealth");
  const reputation = 98;
  const rows: Array<{ label: string; value: string; testId: string }> = [
    {
      label: t("dkim"),
      value: t("configured"),
      testId: "outreach-domain-dkim",
    },
    {
      label: t("spf"),
      value: t("validated"),
      testId: "outreach-domain-spf",
    },
    {
      label: t("dmarc"),
      value: t("enforced"),
      testId: "outreach-domain-dmarc",
    },
  ];

  return (
    <section
      data-testid="outreach-domain-health"
      className="glass-panel relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-on-surface/5 p-6"
    >
      <div className="absolute -right-16 -top-16 h-32 w-32 rounded-full bg-cyan/5 blur-3xl" />
      <header className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cyan/10 text-cyan shadow-[0_0_12px_rgba(0,229,255,0.25)]">
          <span
            className="material-symbols-outlined text-[20px]"
            aria-hidden
          >
            verified_user
          </span>
        </span>
        <div>
          <h3 className="text-sm font-bold text-white">{t("title")}</h3>
          <p className="flex items-center gap-2 text-[11px] text-cyan">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
            {t("healthy")}
          </p>
        </div>
      </header>
      <ul className="flex flex-col gap-3">
        {rows.map((r) => (
          <li
            key={r.testId}
            data-testid={r.testId}
            className="flex items-center justify-between rounded-xl border border-white/5 bg-surface-high/40 px-3 py-2.5"
          >
            <span className="text-sm text-on-surface">{r.label}</span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-cyan">
              {r.value}
            </span>
          </li>
        ))}
        <li
          data-testid="outreach-domain-reputation"
          className="flex items-center justify-between rounded-xl border border-white/5 bg-surface-high/40 px-3 py-2.5"
        >
          <span className="text-sm text-on-surface">{t("reputation")}</span>
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface">
              <div
                className="h-full bg-cyan"
                style={{ width: `${reputation}%` }}
              />
            </div>
            <span className="text-xs font-bold tabular-nums text-white">
              {reputation}%
            </span>
          </div>
        </li>
      </ul>
    </section>
  );
}
