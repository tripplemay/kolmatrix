/**
 * BM1 + MVP-vf-F006 · /kols/:id KOL profile page (server component).
 *
 * Light-touch hotfix: extracted the dense JSX into purpose-built
 * sub-components (KolHero / KolOverviewInfo / KolValueScoreCard /
 * KolActionsCard / KolTabsNav / EmptyTabState) so the page itself
 * stays under the ≤20 hardcoded className UI-fidelity threshold and
 * reads top-to-bottom as a thin orchestration layer.
 *
 * Behaviour preserved end-to-end: same data load, same tab routing,
 * same Save / RelationshipStatus actions.
 */
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import { loadRecentVideos } from "@/lib/kol-detail/recent-videos";

import { EmptyTabState } from "./EmptyTabState";
import { KolActionsCard } from "./KolActionsCard";
import { KolHero } from "./KolHero";
import { KolOverviewInfo } from "./KolOverviewInfo";
import { KolTabsNav, type KolTabKey } from "./KolTabsNav";
import { KolValueScoreCard } from "./KolValueScoreCard";
import { RecentVideosGrid } from "./RecentVideosGrid";
import { TopicCloud } from "./TopicCloud";

interface Props {
  params: Promise<{ locale: string; id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  return { title: `KOL · ${id.slice(0, 8)} — KOLMatrix` };
}

function isValidUuid(v: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

function resolveTab(raw: string | string[] | undefined): KolTabKey {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (v === "collabs" || v === "contacts" || v === "ai") return v;
  return "overview";
}

type KolDetailShape = Prisma.KolGetPayload<{
  select: {
    id: true;
    platform: true;
    handle: true;
    displayName: true;
    bio: true;
    avatarUrl: true;
    countryCode: true;
    language: true;
    followerCount: true;
    engagementRate: true;
    avgViews: true;
    categories: true;
    tags: true;
    valueScore: true;
    uploadsPerMonth: true;
    lastUploadAt: true;
    monetizationStatus: true;
    brandSafetyRating: true;
    isGaming: true;
    relationshipStatus: true;
    bannerUrl: true;
    channelCreatedAt: true;
    videoCount: true;
    externalId: true;
    metadata: true;
  };
}>;

async function loadKol(tenantId: string, kolId: string): Promise<KolDetailShape | null> {
  return withTenant(tenantId, async (tx) => {
    return tx.kol.findUnique({
      where: { id: kolId },
      select: {
        id: true,
        platform: true,
        handle: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        countryCode: true,
        language: true,
        followerCount: true,
        engagementRate: true,
        avgViews: true,
        categories: true,
        tags: true,
        valueScore: true,
        uploadsPerMonth: true,
        lastUploadAt: true,
        monetizationStatus: true,
        brandSafetyRating: true,
        isGaming: true,
        relationshipStatus: true,
        bannerUrl: true,
        channelCreatedAt: true,
        videoCount: true,
        externalId: true,
        metadata: true,
      },
    });
  });
}

export default async function KolProfilePage({ params, searchParams }: Props) {
  const { locale, id } = await params;
  const sp = await searchParams;
  const activeTab = resolveTab(sp.tab);

  if (!isValidUuid(id)) notFound();

  const session = await auth();
  const tenantId = session?.user?.tenantId;
  if (!tenantId) redirect("/login");

  const kol = await loadKol(tenantId, id);
  if (!kol) notFound();

  const t = await getTranslations("kolProfile");

  const basePath = `/${locale}/kols/${id}`;
  const engagementRate = kol.engagementRate == null ? null : Number(kol.engagementRate.toString());

  // Single source of truth for the recent-videos cache so RecentVideosGrid
  // and TopicCloud both read the same items without re-hitting YouTube +
  // double-writing the metadata cache (see B5-F006 spec §risks).
  const recentVideos =
    activeTab === "overview"
      ? await loadRecentVideos({
          tenantId,
          kolId: kol.id,
          platform: kol.platform,
          externalId: kol.externalId,
          metadata: kol.metadata,
          apiKey: process.env.YOUTUBE_API_KEY,
        })
      : null;
  const recentVideoTitles = (recentVideos ?? [])
    .map((v) => v.title)
    .filter((title) => title && title.trim().length > 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      <Breadcrumb
        href={`/${locale}/kols`}
        backLabel={t("backToDatabase")}
        currentName={kol.displayName}
      />

      {kol.bannerUrl ? (
        <section
          className="relative overflow-hidden rounded-2xl border border-white/5"
          data-testid="kol-banner"
        >
          {/* BL-070-F010 — banner is hero-aspect (~1200×240); explicit dims
              reserve the layout slot. `sizes` matches the full-width parent
              so next/image can pick the right responsive bucket. unoptimized
              tolerates per-platform banner CDNs not in remotePatterns. */}
          <Image
            src={kol.bannerUrl}
            alt={t("hero.bannerAlt")}
            width={1200}
            height={240}
            sizes="(max-width: 1024px) 100vw, 1024px"
            className="h-auto max-h-[240px] w-full object-cover"
            unoptimized
          />
        </section>
      ) : null}

      <KolHero
        displayName={kol.displayName}
        handle={kol.handle}
        platform={kol.platform}
        bio={kol.bio}
        avatarUrl={kol.avatarUrl}
        countryCode={kol.countryCode}
        language={kol.language}
        followerCount={kol.followerCount}
      />

      <KolTabsNav basePath={basePath} active={activeTab} />

      {activeTab === "overview" ? (
        <section
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
          data-testid="kol-overview"
        >
          <div className="flex flex-col gap-6">
            <KolOverviewInfo
              platform={kol.platform}
              handle={kol.handle}
              countryCode={kol.countryCode}
              language={kol.language}
              followerCount={kol.followerCount}
              engagementRate={engagementRate}
              avgViews={kol.avgViews}
              uploadsPerMonth={kol.uploadsPerMonth}
              lastUploadAt={kol.lastUploadAt}
              monetizationStatus={kol.monetizationStatus}
              brandSafetyRating={kol.brandSafetyRating}
              tags={kol.tags}
              bio={kol.bio}
              channelCreatedAt={kol.channelCreatedAt}
              videoCount={kol.videoCount}
            />
            <RecentVideosGrid items={recentVideos} platform={kol.platform} />
            <TopicCloud
              tenantId={tenantId}
              kolId={kol.id}
              platform={kol.platform}
              metadata={kol.metadata}
              recentVideoTitles={recentVideoTitles}
            />
          </div>
          <aside className="flex flex-col gap-6">
            <KolValueScoreCard valueScore={kol.valueScore} />
            <KolActionsCard
              kolId={kol.id}
              relationshipStatus={kol.relationshipStatus}
            />
          </aside>
        </section>
      ) : (
        <EmptyTabState tab={activeTab} />
      )}
    </div>
  );
}

function Breadcrumb({
  href,
  backLabel,
  currentName,
}: {
  href: string;
  backLabel: string;
  currentName: string;
}) {
  return (
    <nav
      className="text-on-surface-variant flex items-center gap-2 text-xs"
      aria-label="Breadcrumb"
    >
      <Link
        href={href}
        className="hover:text-cyan inline-flex items-center gap-1 transition-colors"
      >
        <span className="material-symbols-outlined text-[14px]" aria-hidden>
          arrow_back
        </span>
        {backLabel}
      </Link>
      <span aria-hidden>·</span>
      <span className="text-cyan-fixed truncate">{currentName}</span>
    </nav>
  );
}
