import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { isLocale, routing } from "@/i18n/routing";
import { isAdminRole } from "@/lib/auth/roles";
import {
  ApifyPreviewError,
  APIFY_KOL_PLATFORMS,
  APIFY_KOL_SORTS,
  fetchApifyKolPage,
  type ApifyKolPlatform,
  type ApifyKolSort,
  type ApifyPreviewQuery,
} from "@/lib/admin/apify-preview-client";

import { PreviewTable } from "./PreviewTable";
import { StatsCards } from "./StatsCards";

export const metadata = { title: "Apify-KOL Preview (READ-ONLY) — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const DEFAULT_PAGE_SIZE = 50;

function parseSearchQuery(
  raw: Record<string, string | string[] | undefined>
): ApifyPreviewQuery {
  function pick(name: string): string | undefined {
    const value = raw[name];
    if (Array.isArray(value)) return value[0];
    return value;
  }

  const platformRaw = pick("platform");
  const platform =
    platformRaw && (APIFY_KOL_PLATFORMS as readonly string[]).includes(platformRaw)
      ? (platformRaw as ApifyKolPlatform)
      : undefined;

  const sortRaw = pick("sort");
  const sort =
    sortRaw && (APIFY_KOL_SORTS as readonly string[]).includes(sortRaw)
      ? (sortRaw as ApifyKolSort)
      : undefined;

  const minFollowersRaw = pick("minFollowers");
  const minFollowers =
    minFollowersRaw == null || minFollowersRaw === ""
      ? undefined
      : Number.isFinite(Number(minFollowersRaw))
        ? Number(minFollowersRaw)
        : undefined;

  const pageRaw = pick("page");
  const parsedPage = pageRaw == null || pageRaw === "" ? 1 : Number(pageRaw);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;

  const pageSizeRaw = pick("pageSize");
  const parsedSize =
    pageSizeRaw == null || pageSizeRaw === "" ? DEFAULT_PAGE_SIZE : Number(pageSizeRaw);
  const pageSize =
    Number.isFinite(parsedSize) && parsedSize > 0
      ? Math.min(200, Math.max(10, Math.floor(parsedSize)))
      : DEFAULT_PAGE_SIZE;

  const hasEmail = pick("hasEmail") === "true" ? true : undefined;

  return { platform, sort, minFollowers, page, pageSize, hasEmail };
}

export default async function ApifyPreviewPage({ params, searchParams }: Props) {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : routing.defaultLocale;

  const session = await auth();
  if (!session?.user) {
    redirect(`/${locale}/login`);
  }
  if (!isAdminRole(session.user.role)) {
    redirect(`/${locale}/insight`);
  }

  const t = await getTranslations({ locale, namespace: "admin.apifyPreview" });
  const query = parseSearchQuery(await searchParams);

  let result: Awaited<ReturnType<typeof fetchApifyKolPage>> | null = null;
  let error: { kind: string; message: string } | null = null;
  try {
    result = await fetchApifyKolPage(query);
  } catch (err) {
    if (err instanceof ApifyPreviewError) {
      error = { kind: err.kind, message: err.message };
    } else {
      error = {
        kind: "transient",
        message: err instanceof Error ? err.message : String(err),
      };
    }
  }

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

        {error ? (
          <div
            role="alert"
            data-testid="apify-preview-fetch-error"
            className="rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-sm text-error"
          >
            {t("fetchError", { kind: error.kind, message: error.message })}
          </div>
        ) : (
          <>
            <StatsCards items={result?.data ?? []} total={result?.total ?? 0} />
            <PreviewTable
              items={result?.data ?? []}
              page={result?.page ?? 1}
              pageSize={result?.pageSize ?? query.pageSize ?? DEFAULT_PAGE_SIZE}
              total={result?.total ?? 0}
              query={query}
            />
          </>
        )}
      </div>
    </div>
  );
}
