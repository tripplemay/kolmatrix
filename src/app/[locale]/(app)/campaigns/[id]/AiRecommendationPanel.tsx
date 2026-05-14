"use client";

/**
 * BL-066-F002 · /campaigns/[id] AI recommendation panel skeleton.
 *
 * F002 范围 (per F002 audit §裁决 #2=B):
 *   - props productId/campaignId/locale/labels
 *   - 固定渲染 empty state (productId == null) 或 loading skeleton
 *     (productId != null), 按 design-draft empty.html / loading.html
 *     1:1 还原
 *   - **不调用 /api/kols/smart-match** — F003 才加 useEffect + fetch +
 *     status state + 5×2 卡片 grid + Accept/Skip/Replace 按钮
 *
 * F003 commit 在同文件 add:
 *   - useEffect → POST /api/kols/smart-match { productId, count: 30 }
 *   - useState pendingSet/acceptedSet/skippedSet/replacedSet
 *   - localStorage cache campaign-recommendations-{tenantId}-{campaignId}
 *   - 「Show next 5」cycle 取 cache 下一组
 *   - 「Accept」调 F004 acceptKolAction
 *   - C2 浅版「Why we suggest this」段
 */
import Link from "next/link";

interface EmptyLabels {
  eyebrow: string;
  heading: string;
  body: string;
  reconnectCta: string;
  kbCta: string;
  helpLink: string;
  info: string;
}

interface LoadingLabels {
  heading: string;
  badge: string;
  subtitle: string;
  whyEyebrow: string;
  footer: string;
}

interface Labels {
  empty: EmptyLabels;
  loading: LoadingLabels;
}

interface Props {
  productId: string | null;
  campaignId: string;
  locale: string;
  labels: Labels;
}

export function AiRecommendationPanel({
  productId,
  campaignId,
  locale,
  labels,
}: Props) {
  if (productId == null) {
    return <EmptyState campaignId={campaignId} locale={locale} labels={labels.empty} />;
  }
  return <LoadingSkeleton labels={labels.loading} />;
}

function EmptyState({
  campaignId,
  locale,
  labels,
}: {
  campaignId: string;
  locale: string;
  labels: EmptyLabels;
}) {
  return (
    <section
      className="flex min-h-[400px] flex-col items-center justify-center rounded-[16px] border border-outline-variant/20 bg-surface-low p-8 text-center shadow-[0_4px_30px_rgba(0,0,0,0.2)]"
      data-testid="campaign-ai-recommendation-empty"
    >
      <div className="relative mb-6 flex h-[120px] w-[120px] items-center justify-center">
        <div
          className="absolute inset-0 animate-[spin_10s_linear_infinite] rounded-full border-2 border-dashed border-slate-500/30"
          aria-hidden
        />
        <div className="relative flex h-[80px] w-[80px] items-center justify-center rounded-full bg-cyan/10 shadow-[0_0_30px_rgba(0,229,255,0.15)]">
          <span
            className="material-symbols-outlined text-[40px] text-cyan-fixed"
            style={{ fontVariationSettings: "'FILL' 1" }}
            aria-hidden
          >
            auto_awesome
          </span>
          <div
            className="absolute inset-0 rounded-full bg-cyan opacity-20 blur-[20px]"
            aria-hidden
          />
        </div>
      </div>

      <span className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.1em] text-cyan-fixed">
        {labels.eyebrow}
      </span>
      <h2 className="mb-3 text-[22px] font-bold tracking-tight text-white">
        {labels.heading}
      </h2>
      <p className="mb-8 max-w-[400px] text-sm leading-relaxed text-slate-300">
        {labels.body}
      </p>

      <div className="flex w-full max-w-[300px] flex-col items-center gap-3">
        <Link
          href={`/${locale}/campaigns/${campaignId}/edit`}
          className="gradient-cta inline-flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-on-primary shadow-[0_0_15px_rgba(0,229,255,0.25)] transition-opacity hover:opacity-90"
          data-testid="campaign-ai-recommendation-reconnect-link"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            hub
          </span>
          {labels.reconnectCta}
        </Link>
        <Link
          href={`/${locale}/products`}
          className="inline-flex w-full items-center justify-center rounded-lg border border-outline-variant/50 bg-transparent py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-highest"
          data-testid="campaign-ai-recommendation-kb-link"
        >
          {labels.kbCta}
        </Link>
        <span className="mt-2 text-[13px] font-medium text-cyan-fixed">
          {labels.helpLink}
        </span>
      </div>

      <div className="mt-8 w-full max-w-[400px] border-t border-outline-variant/30 pt-6">
        <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            info
          </span>
          {labels.info}
        </p>
      </div>
    </section>
  );
}

function LoadingSkeleton({ labels }: { labels: LoadingLabels }) {
  return (
    <section
      className="relative overflow-hidden rounded-[16px] border border-surface-highest/50 bg-surface-low p-6 shadow-[0_8px_32px_rgba(0,0,0,0.3)]"
      data-testid="campaign-ai-recommendation-loading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-cyan/5 blur-[80px]"
        aria-hidden
      />

      <div className="relative z-10 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className="material-symbols-outlined animate-pulse text-[24px] text-cyan"
            aria-hidden
          >
            auto_awesome
          </span>
          <h2 className="text-[20px] font-bold tracking-tight text-white">
            {labels.heading}
          </h2>
          <span className="flex items-center gap-1.5 rounded-full border border-surface-highest bg-surface-highest px-2.5 py-1 text-[11px] font-semibold text-on-surface-variant">
            <span
              className="h-1.5 w-1.5 animate-ping rounded-full bg-cyan"
              aria-hidden
            />
            {labels.badge}
          </span>
        </div>
        <div className="animate-pulse text-sm font-medium text-cyan/70">
          {labels.subtitle}
        </div>
      </div>

      <div className="campaign-ai-recommendation-progress mb-8" aria-hidden />

      <div className="relative z-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {Array.from({ length: 5 }).map((_, idx) => (
          <SkeletonCard key={idx} whyEyebrow={labels.whyEyebrow} />
        ))}
      </div>

      <div className="relative z-10 mt-6 text-center">
        <p className="text-[12px] italic text-slate-500">{labels.footer}</p>
      </div>
    </section>
  );
}

function SkeletonCard({ whyEyebrow }: { whyEyebrow: string }) {
  return (
    <div className="rounded-[12px] border border-surface-highest/30 bg-surface p-4">
      <div className="mb-4 flex items-start justify-between">
        <div className="campaign-ai-recommendation-shimmer h-11 w-11 rounded-full" />
        <div className="campaign-ai-recommendation-shimmer h-12 w-12 rounded-full" />
      </div>
      <div className="mb-4 space-y-2">
        <div className="campaign-ai-recommendation-shimmer h-4 w-3/4 rounded" />
        <div className="campaign-ai-recommendation-shimmer h-3 w-1/2 rounded" />
      </div>
      <div className="mb-4 flex gap-2">
        <div className="campaign-ai-recommendation-shimmer h-5 w-16 rounded-full" />
        <div className="campaign-ai-recommendation-shimmer h-5 w-12 rounded-full" />
      </div>
      <div className="mb-4">
        <span className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
          {whyEyebrow}
        </span>
        <div className="campaign-ai-recommendation-shimmer mb-1 h-3 w-full rounded" />
        <div className="campaign-ai-recommendation-shimmer h-3 w-4/5 rounded" />
      </div>
      <div className="mt-auto flex gap-2">
        <div className="campaign-ai-recommendation-shimmer h-8 w-full rounded opacity-40" />
        <div className="campaign-ai-recommendation-shimmer h-8 w-8 shrink-0 rounded opacity-40" />
      </div>
    </div>
  );
}
