import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { loadProductAssetCounts } from "@/lib/assets/queries";
import { withTenant } from "@/lib/db";
import type { ProductAiAssets } from "@/lib/products/generateAiAssets";

import { ProductsClient } from "./ProductsClient";
import type { ProductListItem } from "./types";

export const metadata = { title: "Knowledge Base — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function KnowledgeBasePage({ params }: Props) {
  await params; // honour Next.js async params contract
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  // BL-030-F002 — loadProductAssetCounts shares the same withTenant
  // tx as the product list so the chip counts honor RLS and avoid an
  // extra round-trip per card. groupBy runs once over the visible
  // page (≤100 products).
  const { rows, assetCounts } = await withTenant(tenantId, async (tx) => {
    const productRows = await tx.product.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    const counts = await loadProductAssetCounts(
      tx,
      productRows.map((r) => r.id)
    );
    return { rows: productRows, assetCounts: counts };
  });

  const products: ProductListItem[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    category: r.category,
    targetAudience: r.targetAudience,
    uniqueSellingPoints: r.uniqueSellingPoints,
    downloadUrl: r.downloadUrl,
    launchDate: r.launchDate ? r.launchDate.toISOString() : null,
    aiAssets: r.aiAssets as ProductAiAssets | null,
    assetCounts: assetCounts.get(r.id) ?? { emailCount: 0, videoCount: 0 },
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  const t = await getTranslations("knowledgeBase");

  return (
    <div className="mx-auto max-w-7xl space-y-8 pb-24">
      <nav
        className="flex items-center gap-2 text-[12px] font-medium text-on-surface-variant"
        aria-label="Breadcrumb"
      >
        <span>{t("breadcrumbRoot")}</span>
        <span className="material-symbols-outlined text-[14px]" aria-hidden>
          chevron_right
        </span>
        <span className="text-cyan">{t("breadcrumbCurrent")}</span>
      </nav>

      <ProductsClient products={products} />

      <section className="space-y-3" aria-label={t("recentActivityTitle")}>
        <h3 className="pl-1 text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-fixed">
          {t("recentActivityTitle")}
        </h3>
        <div className="-mx-1 flex gap-4 overflow-x-auto px-1 pb-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <ActivityChip
              key={i}
              title={t(`mockActivity.heading${i}` as `mockActivity.heading${1 | 2 | 3 | 4 | 5}`)}
              time={t(`mockActivity.time${i}` as `mockActivity.time${1 | 2 | 3 | 4 | 5}`)}
              icon={ACTIVITY_ICONS[i - 1]}
              tone={ACTIVITY_TONES[i - 1]}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

const ACTIVITY_ICONS = [
  "auto_fix_high",
  "video_library",
  "mail",
  "image",
  "history",
] as const;

const ACTIVITY_TONES: Array<"cyan" | "warning" | "purple" | "neutral"> = [
  "cyan",
  "warning",
  "purple",
  "cyan",
  "neutral",
];

const TONE_CLASS: Record<(typeof ACTIVITY_TONES)[number], string> = {
  cyan: "text-cyan",
  warning: "text-warning",
  purple: "text-purple",
  neutral: "text-on-surface-variant",
};

interface ActivityChipProps {
  title: string;
  time: string;
  icon: string;
  tone: (typeof ACTIVITY_TONES)[number];
}

function ActivityChip({ title, time, icon, tone }: ActivityChipProps) {
  return (
    <div
      className="flex flex-none items-center gap-3 rounded-xl border border-outline-variant/30 bg-surface-low p-3.5"
      style={{ width: "16rem" }}
    >
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-lg bg-surface-highest ${TONE_CLASS[tone]}`}
      >
        <span className="material-symbols-outlined" aria-hidden>
          {icon}
        </span>
      </div>
      <div className="min-w-0">
        <p className="w-40 truncate text-[13px] font-semibold text-white">
          {title}
        </p>
        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-on-surface-variant">
          <span>{time}</span>
          <span className="h-1 w-1 rounded-full bg-slate-700" />
          <span className="text-cyan">2.1 Credits</span>
        </div>
      </div>
    </div>
  );
}
