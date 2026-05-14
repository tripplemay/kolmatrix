/**
 * BL-066-F002 · /campaigns/[id] Brief Summary panel (顶段, server component).
 *
 * 按 design-draft/bl066-campaign-detail-ai-main-panel/main.html 1:1 还原:
 *   ACTIVE/AI-DRIVEN pills + H1 + 右上 Accepted/Contacted 计数 + 4 列
 *   grid (Target Market / Demographics / Budget / 按钮组).
 *
 * 口径锁 per F002 audit §裁决 #1=A:
 *   - Target Market = markets.join(", ") fallback "Global"
 *   - Demographics  = product.targetAudience 直显 fallback "—"
 *   - Budget        = Intl.NumberFormat currency fallback "—"
 *   - Edit Brief    → /[locale]/campaigns/[id]/edit
 *   - Launch Comm   → /[locale]/reach?campaignId=[id]
 *   - 隐藏 "/N target" (kpiTarget unstructured, BL-068 规范化)
 */
import Link from "next/link";

interface Labels {
  statusActive: string;
  statusDraft: string;
  statusCompleted: string;
  aiDrivenBadge: string;
  targetMarket: string;
  targetMarketDefault: string;
  demographics: string;
  demographicsUnset: string;
  budget: string;
  budgetUnset: string;
  acceptedLabel: string;
  contactedLabel: string;
  editBrief: string;
  launchComm: string;
}

interface Props {
  campaign: {
    id: string;
    name: string;
    status: string;
    markets: string[];
    budgetAmount: number | null;
    budgetCurrency: string;
    productTargetAudience: string | null;
  };
  counts: {
    accepted: number;
    contacted: number;
  };
  locale: string;
  labels: Labels;
}

function formatBudget(amount: number | null, currency: string): string | null {
  if (amount == null) return null;
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: (currency || "USD").toUpperCase(),
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${(currency || "USD").toUpperCase()} ${amount.toFixed(0)}`;
  }
}

function statusLabel(status: string, labels: Labels): string {
  if (status === "active") return labels.statusActive;
  if (status === "completed") return labels.statusCompleted;
  return labels.statusDraft;
}

function statusPillClasses(status: string): string {
  if (status === "active")
    return "border-cyan/20 bg-cyan/10 text-cyan-fixed";
  if (status === "completed")
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-300";
  return "border-outline-variant bg-surface/40 text-on-surface-variant";
}

export function BriefSummaryPanel({ campaign, counts, locale, labels }: Props) {
  const targetMarket =
    campaign.markets.length > 0
      ? campaign.markets.join(", ")
      : labels.targetMarketDefault;
  const demographics =
    campaign.productTargetAudience && campaign.productTargetAudience.length > 0
      ? campaign.productTargetAudience
      : labels.demographicsUnset;
  const budgetDisplay =
    formatBudget(campaign.budgetAmount, campaign.budgetCurrency) ??
    labels.budgetUnset;

  return (
    <section
      className="glass-panel relative flex flex-col gap-4 overflow-hidden rounded-[16px] border border-on-surface/5 p-6"
      data-testid="campaign-brief-summary"
    >
      <div
        className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-cyan-fixed-dim to-transparent"
        aria-hidden
      />

      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusPillClasses(campaign.status)}`}
              data-testid="campaign-brief-status-pill"
            >
              <span
                className="h-1.5 w-1.5 animate-pulse rounded-full bg-current"
                aria-hidden
              />
              {statusLabel(campaign.status, labels)}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-purple-container/40 bg-purple-container/20 px-2.5 py-1 text-xs font-semibold text-purple">
              <span
                className="material-symbols-outlined text-[14px]"
                aria-hidden
              >
                auto_awesome
              </span>
              {labels.aiDrivenBadge}
            </span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {campaign.name}
          </h1>
        </div>

        <div className="flex shrink-0 gap-4">
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              {labels.acceptedLabel}
            </span>
            <span
              className="text-2xl font-bold text-white"
              data-testid="campaign-brief-accepted-count"
            >
              {counts.accepted}
            </span>
          </div>
          <div
            className="my-1 w-px self-stretch bg-outline-variant/30"
            aria-hidden
          />
          <div className="flex flex-col items-end gap-1">
            <span className="text-xs font-medium uppercase tracking-wider text-on-surface-variant">
              {labels.contactedLabel}
            </span>
            <span
              className="text-2xl font-bold text-cyan-fixed"
              data-testid="campaign-brief-contacted-count"
            >
              {counts.contacted}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-outline-variant/20 bg-surface/50 p-3">
          <span className="mb-1 block text-xs text-on-surface-variant">
            {labels.targetMarket}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[16px] text-cyan-fixed"
              aria-hidden
            >
              public
            </span>
            <span
              className="text-sm font-medium text-white"
              data-testid="campaign-brief-target-market"
            >
              {targetMarket}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant/20 bg-surface/50 p-3">
          <span className="mb-1 block text-xs text-on-surface-variant">
            {labels.demographics}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[16px] text-purple"
              aria-hidden
            >
              groups
            </span>
            <span
              className="line-clamp-2 text-sm font-medium text-white"
              data-testid="campaign-brief-demographics"
            >
              {demographics}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-outline-variant/20 bg-surface/50 p-3">
          <span className="mb-1 block text-xs text-on-surface-variant">
            {labels.budget}
          </span>
          <div className="flex items-center gap-2">
            <span
              className="material-symbols-outlined text-[16px] text-cyan"
              aria-hidden
            >
              attach_money
            </span>
            <span
              className="text-sm font-medium text-white"
              data-testid="campaign-brief-budget"
            >
              {budgetDisplay}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3">
          <Link
            href={`/${locale}/campaigns/${campaign.id}/edit`}
            className="rounded-lg border border-outline-variant/30 bg-surface-high px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-bright"
            data-testid="campaign-brief-edit-link"
          >
            {labels.editBrief}
          </Link>
          <Link
            href={`/${locale}/reach?campaignId=${campaign.id}`}
            className="gradient-cta inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-on-primary shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all hover:shadow-[0_0_25px_rgba(0,229,255,0.5)]"
            data-testid="campaign-brief-launch-link"
          >
            <span
              className="material-symbols-outlined text-[16px]"
              aria-hidden
            >
              forward_to_inbox
            </span>
            {labels.launchComm}
          </Link>
        </div>
      </div>
    </section>
  );
}
