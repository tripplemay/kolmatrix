import { getTranslations, setRequestLocale } from "next-intl/server";
import Link from "next/link";

export const metadata = { title: "Request received — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function RequestAccessSuccessPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("auth.requestAccess");

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-6 py-12">
      <div className="w-full max-w-md text-center">
        <div
          className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-cyan/10"
          aria-hidden="true"
        >
          <span className="material-symbols-outlined text-3xl text-cyan">check</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-white">{t("successTitle")}</h1>
        <p className="mt-3 text-base text-on-surface-variant">{t("successMessage")}</p>
        <Link
          href={`/${locale}/login`}
          className="mt-10 inline-block rounded-lg border border-cyan/30 px-6 py-3 text-sm font-semibold text-cyan transition-colors hover:bg-cyan/10"
        >
          {t("backToLogin")}
        </Link>
      </div>
    </main>
  );
}
