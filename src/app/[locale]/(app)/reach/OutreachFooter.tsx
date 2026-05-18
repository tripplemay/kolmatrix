/**
 * BM2-F006 · Outreach footer (compliance + daily limit).
 *
 * Per adjudication §12 #9: drop IP Reputation (static metadata only
 * useful with Resend Admin API), keep Compliance + Daily Limit.
 */
import { getTranslations } from "next-intl/server";

interface Props {
  dailyLimit: number;
  sentToday: number;
}

export async function OutreachFooter({ dailyLimit, sentToday }: Props) {
  const t = await getTranslations("outreach.footer");

  return (
    <footer
      data-testid="outreach-footer"
      className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/5 bg-surface-low/60 px-4 py-3 text-[11px]"
    >
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-on-surface-variant">
            {t("complianceLabel")}
          </span>
          <span className="font-semibold text-cyan">{t("complianceValue")}</span>
        </div>
        <span className="h-3 w-px bg-white/10" aria-hidden />
        <div className="flex items-center gap-2">
          <span className="font-bold uppercase tracking-wider text-on-surface-variant">
            {t("dailyLimitLabel")}
          </span>
          <span className="font-semibold text-white">
            {t("dailyLimitValue", {
              sent: new Intl.NumberFormat("en-US").format(sentToday),
              limit: new Intl.NumberFormat("en-US").format(dailyLimit),
            })}
          </span>
        </div>
      </div>
      <p className="text-[10px] text-on-surface-variant/70">
        {t("engineVersion")}
      </p>
    </footer>
  );
}
