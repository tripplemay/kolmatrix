/**
 * BM2-F004 · Campaign create page /campaigns/new
 *
 * Standalone page (per spec §F004 "独立页 减少状态管理复杂度"). RSC
 * fetches the tenant's product list directly via withTenant — no
 * intermediate /api/products endpoint needed for the dropdown because
 * we already have a server context with auth resolved. Client form
 * handles state via useActionState + per-field error map.
 */
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";

import { CampaignForm } from "./CampaignForm";

export const metadata = { title: "New Campaign — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function NewCampaignPage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const products = await withTenant(tenantId, (tx) =>
    tx.product.findMany({
      select: { id: true, name: true, category: true },
      orderBy: { createdAt: "desc" },
    })
  );

  const t = await getTranslations("campaigns.new");
  const tErrors = await getTranslations("campaigns.new.errors");
  const tMarkets = await getTranslations("campaigns.new.markets");

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header className="flex items-end justify-between gap-4">
        <div>
          <Link
            href={`/${locale}/campaigns`}
            data-testid="campaign-new-back"
            className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-on-surface-variant transition-colors hover:text-cyan"
          >
            <span className="material-symbols-outlined text-[16px]" aria-hidden>
              arrow_back
            </span>
            {t("backToList")}
          </Link>
          <h1
            data-testid="campaign-new-title"
            className="text-2xl font-bold tracking-tight text-white"
          >
            {t("title")}
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
            {t("subtitle")}
          </p>
        </div>
      </header>

      {products.length === 0 ? (
        <div
          className="glass-panel flex flex-col items-center gap-3 rounded-2xl border border-on-surface/5 p-12 text-center"
          data-testid="campaign-new-no-products"
        >
          <span
            className="material-symbols-outlined text-[48px] text-cyan/50"
            aria-hidden
          >
            inventory_2
          </span>
          <h2 className="text-lg font-semibold text-white">
            {t("noProducts.title")}
          </h2>
          <p className="max-w-md text-sm text-on-surface-variant">
            {t("noProducts.body")}
          </p>
          <Link
            href={`/${locale}/knowledge-base`}
            data-testid="campaign-new-no-products-cta"
            className="gradient-cta mt-2 rounded-lg px-5 py-2 text-sm font-bold text-on-primary"
          >
            {t("noProducts.cta")}
          </Link>
        </div>
      ) : (
        <CampaignForm
          products={products}
          labels={{
            name: t("fields.name"),
            nameHint: t("fields.nameHint"),
            product: t("fields.product"),
            budget: t("fields.budget"),
            budgetHint: t("fields.budgetHint"),
            startDate: t("fields.startDate"),
            endDate: t("fields.endDate"),
            game: t("fields.game"),
            gameHint: t("fields.gameHint"),
            markets: t("fields.markets"),
            kpiTarget: t("fields.kpiTarget"),
            kpiTargetHint: t("fields.kpiTargetHint"),
            submit: t("submit"),
            submitting: t("submitting"),
          }}
          marketLabels={{
            global: tMarkets("global"),
            us: tMarkets("us"),
            eu: tMarkets("eu"),
            jp: tMarkets("jp"),
            kr: tMarkets("kr"),
            sea: tMarkets("sea"),
            cn: tMarkets("cn"),
            latam: tMarkets("latam"),
          }}
          errorLabels={{
            nameRequired: tErrors("nameRequired"),
            productIdRequired: tErrors("productIdRequired"),
            productNotFound: tErrors("productNotFound"),
            budgetInvalid: tErrors("budgetInvalid"),
            budgetOverflow: tErrors("budgetOverflow"),
            dateInvalid: tErrors("dateInvalid"),
            endBeforeStart: tErrors("endBeforeStart"),
            ownerInvalid: tErrors("ownerInvalid"),
            generic: tErrors("generic"),
            unauthorized: tErrors("unauthorized"),
          }}
        />
      )}
    </div>
  );
}
