/**
 * BL-069-F003 · /brief page — natural-language campaign creation.
 *
 * Server component:
 *   - Resolves session + tenant
 *   - Fetches the tenant's products (id/name/category) for the form's
 *     product selector
 *   - Pulls all `brief.*` i18n keys (5 locale cover) and hands them
 *     down to the client wrapper
 *
 * Tab routing:
 *   - Default / `?tab=campaign` → CampaignForm + BriefAiInputBar
 *   - `?tab=products` → ProductListPanel placeholder (F004 will wire
 *     the actual CRUD UI; this commit ships the route handler so
 *     redirects from /knowledge-base (F006) land cleanly)
 *
 * Note vs BL-064 placeholder: this page no longer re-exports
 * /knowledge-base/page. The KB route will be 301-redirected to
 * /brief?tab=products in F006.
 */
import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";

import { BriefPageClient } from "./BriefPageClient";

export const metadata = { title: "Brief — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pickFirst(raw: string | string[] | undefined): string | undefined {
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export default async function BriefPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const tab = pickFirst(sp.tab) ?? "campaign";

  const products = await withTenant(tenantId, (tx) =>
    tx.product.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, category: true },
      orderBy: { createdAt: "desc" },
    }),
  );

  const t = await getTranslations("brief");
  const tAi = await getTranslations("brief.aiInputBar");
  const tForm = await getTranslations("brief.form");
  const tMarkets = await getTranslations("brief.markets");

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-16">
      <header>
        <h1
          data-testid="brief-page-title"
          className="text-2xl font-bold tracking-tight text-white"
        >
          {t("pageTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-on-surface-variant">
          {t("subtitle")}
        </p>
      </header>

      {/* Tab bar — F003 lays out the two routes; F004 will wire actual
          ProductListPanel under tab=products. Stays plain anchors so
          server-side navigation is straightforward. */}
      <nav
        className="flex gap-1 border-b border-on-surface/10"
        data-testid="brief-tabs"
      >
        <a
          href={`/${locale}/brief`}
          data-testid="brief-tab-campaign"
          aria-current={tab !== "products" ? "page" : undefined}
          className={
            tab !== "products"
              ? "border-b-2 border-cyan px-4 py-2 text-sm font-bold text-cyan"
              : "px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface"
          }
        >
          {t("tabCampaign")}
        </a>
        <a
          href={`/${locale}/brief?tab=products`}
          data-testid="brief-tab-products"
          aria-current={tab === "products" ? "page" : undefined}
          className={
            tab === "products"
              ? "border-b-2 border-cyan px-4 py-2 text-sm font-bold text-cyan"
              : "px-4 py-2 text-sm font-medium text-on-surface-variant hover:text-on-surface"
          }
        >
          {t("tabProducts")}
        </a>
      </nav>

      {tab === "products" ? (
        <ProductsPanelPlaceholder />
      ) : (
        <BriefPageClient
          locale={locale}
          products={products}
          aiLabels={{
            inputPlaceholder: tAi("placeholder"),
            generateButton: tAi("generateButton"),
            loading: tAi("loading"),
            feedbackPrefix: tAi("feedbackPrefix"),
            unparsableToast: tAi("unparsableToast"),
            malformedToast: tAi("malformedToast"),
            productCrossTenantToast: tAi("productCrossTenantToast"),
            capExhaustedToast: tAi("capExhaustedToast"),
            networkError: tAi("networkError"),
          }}
          formLabels={{
            name: tForm("name"),
            nameHint: tForm("nameHint"),
            product: tForm("productSelectorLabel"),
            productSelectorLabel: tForm("productSelectorLabel"),
            manageProductsLink: tForm("manageProductsLink"),
            noProducts: tForm("noProducts"),
            budgetAmount: tForm("budgetAmount"),
            budgetCurrency: tForm("budgetCurrency"),
            budgetHint: tForm("budgetHint"),
            startDate: tForm("startDate"),
            endDate: tForm("endDate"),
            markets: tForm("markets"),
            targetAudience: tForm("targetAudience"),
            targetAudienceHint: tForm("targetAudienceHint"),
            categories: tForm("categories"),
            categoriesHint: tForm("categoriesHint"),
            submit: tForm("submit"),
            submitting: tForm("submitting"),
            aiDiffHintPrefix: tForm("aiDiffHintPrefix"),
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
        />
      )}
    </div>
  );
}

/**
 * F003 placeholder for the products tab. F004 will replace this with
 * a real ProductListPanel (CRUD migrated from /knowledge-base).
 */
function ProductsPanelPlaceholder() {
  return (
    <div
      className="glass-panel rounded-2xl border border-on-surface/5 p-8 text-center text-on-surface-variant"
      data-testid="brief-products-panel-placeholder"
    >
      <p className="text-sm">
        Product list panel will land in BL-069-F004 (migrated from /knowledge-base).
      </p>
    </div>
  );
}
