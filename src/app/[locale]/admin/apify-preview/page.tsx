import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isLocale, routing } from "@/i18n/routing";

export const metadata = { title: "Apify-KOL Preview (READ-ONLY) — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function ApifyPreviewPage({ params }: Props) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : routing.defaultLocale;

  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }
  if (session.user.role !== "admin") {
    redirect(`/${locale}/dashboard`);
  }

  const t = await getTranslations({ locale, namespace: "admin.apifyPreview" });

  return (
    <div className="min-h-screen bg-surface-lowest p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold text-white">{t("title")}</h1>
          <div
            role="alert"
            data-testid="apify-preview-readonly-banner"
            className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning"
          >
            <span aria-hidden className="material-symbols-outlined text-base">
              warning
            </span>
            <span>{t("readOnlyWarning")}</span>
          </div>
        </header>
        {/* F002+F003+F004 fill in filter row, stats cards, and main table */}
      </div>
    </div>
  );
}
