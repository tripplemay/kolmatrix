import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { getTranslations } from "next-intl/server";

import { LandingPage } from "./(marketing)/_components/LandingPage";

/**
 * 2026-05-19 landing page · Root locale page.
 *
 * Anonymous → render marketing landing.
 * Authenticated → redirect to /insight (user's home surface).
 *
 * Middleware also performs this split for the un-prefixed `/` so
 * authenticated users skip the landing page entirely; this server
 * component is the fallback for direct `/zh/` or `/en/` visits.
 */
interface Props {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "landing.meta" });
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai";
  const url = `${baseUrl}/${locale}`;
  return {
    title: t("title"),
    description: t("description"),
    // BL-115-F004 — SEO keywords (localized, comma-separated in i18n).
    keywords: t("keywords").split(",").map((k) => k.trim()).filter(Boolean),
    openGraph: {
      title: t("title"),
      description: t("description"),
      url,
      locale,
    },
    twitter: { card: "summary_large_image" },
    alternates: {
      canonical: url,
      languages: {
        zh: `${baseUrl}/zh`,
        en: `${baseUrl}/en`,
      },
    },
  };
}

export default async function LocalizedRootPage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();
  if (session?.user) {
    redirect(`/${locale}/insight`);
  }
  return <LandingPage locale={locale} />;
}
