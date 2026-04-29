/**
 * BM2-F006 · RSC helpers for the /outreach composer.
 *
 * Loads the data the composer UI needs up-front:
 *   - tenant campaigns (for the top-left campaign selector)
 *   - active campaign detail (kolCampaigns + emails)
 *   - system email templates filtered by locale
 *   - marketer display name (for {{marketer.name}})
 */
import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { loadOutreachTemplates } from "@/lib/email/templates";

export interface OutreachCampaignOption {
  id: string;
  name: string;
  status: string;
  productName: string | null;
  kolCount: number;
}

export interface OutreachKolRow {
  kolCampaignId: string;
  kolId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  platform: string;
  email: string | null;
  contactStatus: string;
}

export interface OutreachTemplateOption {
  id: string;
  name: string;
  subject: string;
  body: string;
  variables: unknown;
  locale: string;
  type: string;
  scope: "system" | "user";
}

export interface OutreachComposerData {
  campaigns: OutreachCampaignOption[];
  selectedCampaign: {
    id: string;
    name: string;
    productId: string | null;
    productName: string | null;
    productCategory: string | null;
    productUsp: string | null;
    kols: OutreachKolRow[];
  } | null;
  templates: OutreachTemplateOption[];
  marketerName: string;
}

export async function loadOutreachComposerData(
  tenantId: string,
  campaignId: string | null,
  locale: "en" | "zh"
): Promise<OutreachComposerData> {
  const session = await auth();
  const marketerName = session?.user?.name ?? "Marketer";

  return withTenant(tenantId, async (tx) => {
    const campaigns = await tx.campaign.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        product: { select: { name: true } },
        _count: { select: { kolCampaigns: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const campaignOptions: OutreachCampaignOption[] = campaigns.map((c) => ({
      id: c.id,
      name: c.name,
      status: c.status,
      productName: c.product?.name ?? null,
      kolCount: c._count.kolCampaigns,
    }));

    let selected: OutreachComposerData["selectedCampaign"] = null;
    if (campaignId) {
      const row = await tx.campaign.findUnique({
        where: { id: campaignId },
        select: {
          id: true,
          name: true,
          product: {
            select: {
              id: true,
              name: true,
              category: true,
              uniqueSellingPoints: true,
            },
          },
          kolCampaigns: {
            select: {
              id: true,
              status: true,
              kol: {
                select: {
                  id: true,
                  displayName: true,
                  handle: true,
                  avatarUrl: true,
                  platform: true,
                  email: true,
                },
              },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });
      if (row) {
        selected = {
          id: row.id,
          name: row.name,
          productId: row.product?.id ?? null,
          productName: row.product?.name ?? null,
          productCategory: row.product?.category ?? null,
          productUsp: row.product?.uniqueSellingPoints ?? null,
          kols: row.kolCampaigns.map((kc) => ({
            kolCampaignId: kc.id,
            kolId: kc.kol.id,
            displayName: kc.kol.displayName,
            handle: kc.kol.handle,
            avatarUrl: kc.kol.avatarUrl,
            platform: kc.kol.platform,
            email: kc.kol.email,
            contactStatus: kc.status,
          })),
        };
      }
    }

    const templates = await loadOutreachTemplates(tx, tenantId, locale);

    return {
      campaigns: campaignOptions,
      selectedCampaign: selected,
      templates,
      marketerName,
    };
  });
}
