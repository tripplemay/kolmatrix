import type { Prisma } from "@prisma/client";
import { getFormatter, getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { auth } from "@/auth";
import { withTenant } from "@/lib/db";
import {
  RELATIONSHIP_STATUSES,
  type RelationshipStatus,
} from "@/lib/kol/filters";
import { cn } from "@/lib/utils";

import { RelationshipStatusSelect } from "./RelationshipStatusSelect";
import { SavedToggleButton } from "./SavedToggleButton";

type TabKey = "overview" | "collabs" | "contacts" | "ai";
const TABS: TabKey[] = ["overview", "collabs", "contacts", "ai"];

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

function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function resolveTab(raw: string | string[] | undefined): TabKey {
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
    isSaved: true;
    isGaming: true;
    relationshipStatus: true;
  };
}>;

async function loadKol(
  tenantId: string,
  kolId: string
): Promise<KolDetailShape | null> {
  return withTenant(tenantId, async (tx) => {
    const row = await tx.kol.findUnique({
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
        isSaved: true,
        isGaming: true,
        relationshipStatus: true,
      },
    });
    return row;
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
  const tHero = await getTranslations("kolProfile.hero");
  const tOv = await getTranslations("kolProfile.overview");
  const tTabs = await getTranslations("kolProfile.tabs");
  const tEmpty = await getTranslations("kolProfile.emptyTab");
  const format = await getFormatter();

  const basePath = `/${locale}/kols/${id}`;
  const engagementRate =
    kol.engagementRate == null ? null : Number(kol.engagementRate.toString());

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-16">
      <nav
        className="flex items-center gap-2 text-xs text-on-surface-variant"
        aria-label="Breadcrumb"
      >
        <Link
          href={`/${locale}/database`}
          className="inline-flex items-center gap-1 transition-colors hover:text-cyan"
        >
          <span className="material-symbols-outlined text-[14px]" aria-hidden>
            arrow_back
          </span>
          {t("backToDatabase")}
        </Link>
        <span aria-hidden>·</span>
        <span className="truncate text-cyan-fixed">{kol.displayName}</span>
      </nav>

      <section
        className="glass-panel relative overflow-hidden rounded-2xl border border-white/5 p-8"
        data-testid="kol-hero"
      >
        <div className="flex flex-wrap items-start gap-6">
          <div
            className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/10 bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-3xl font-extrabold text-on-primary shadow-2xl"
            aria-hidden
          >
            {kol.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={kol.avatarUrl}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <span>{initialsOf(kol.displayName)}</span>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white">
                {kol.displayName}
              </h1>
              <p className="mt-1 text-sm text-cyan-fixed">
                @{kol.handle} · {kol.platform.toUpperCase()}
              </p>
            </div>
            {kol.bio ? (
              <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
                {kol.bio}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-4 text-[13px] text-on-surface-variant">
              <HeroStat
                label={tHero("followers")}
                value={formatFollowers(kol.followerCount)}
              />
              <HeroStat
                label={tHero("country")}
                value={kol.countryCode ?? tHero("unknown")}
              />
              <HeroStat
                label={tHero("language")}
                value={kol.language ?? tHero("unknown")}
              />
              <HeroStat
                label={tHero("platform")}
                value={kol.platform.toUpperCase()}
              />
            </div>
          </div>
        </div>
      </section>

      <nav
        role="tablist"
        aria-label="KOL profile tabs"
        className="flex gap-1 border-b border-white/5"
      >
        {TABS.map((key) => {
          const isActive = key === activeTab;
          const href =
            key === "overview" ? basePath : `${basePath}?tab=${key}`;
          return (
            <Link
              key={key}
              href={href}
              role="tab"
              aria-selected={isActive}
              data-testid={`kol-tab-${key}`}
              className={cn(
                "border-b-2 px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "border-cyan text-cyan"
                  : "border-transparent text-on-surface-variant hover:text-cyan/80"
              )}
            >
              {tTabs(key)}
            </Link>
          );
        })}
      </nav>

      {activeTab === "overview" ? (
        <section
          className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]"
          data-testid="kol-overview"
        >
          <div className="glass-panel rounded-2xl border border-on-surface/5 p-6">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cyan-fixed">
              {tOv("sectionInfo")}
            </h2>
            <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label={tOv("fieldPlatform")} value={kol.platform} />
              <Field label={tOv("fieldHandle")} value={`@${kol.handle}`} />
              <Field
                label={tOv("fieldCountry")}
                value={kol.countryCode ?? tHero("unknown")}
              />
              <Field
                label={tOv("fieldLanguage")}
                value={kol.language ?? tHero("unknown")}
              />
              <Field
                label={tOv("fieldFollowers")}
                value={formatFollowers(kol.followerCount)}
              />
              <Field
                label={tOv("fieldEngagement")}
                value={
                  engagementRate != null
                    ? `${engagementRate.toFixed(1)}%`
                    : tHero("unknown")
                }
              />
              <Field
                label={tOv("fieldAvgViews")}
                value={
                  kol.avgViews != null
                    ? formatFollowers(kol.avgViews)
                    : tHero("unknown")
                }
              />
              <Field
                label={tOv("fieldUploadsPerMonth")}
                value={
                  kol.uploadsPerMonth != null
                    ? String(kol.uploadsPerMonth)
                    : tHero("unknown")
                }
              />
              <Field
                label={tOv("fieldLastUpload")}
                value={
                  kol.lastUploadAt
                    ? format.dateTime(kol.lastUploadAt, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })
                    : tHero("unknown")
                }
              />
              <Field
                label={tOv("fieldMonetization")}
                value={kol.monetizationStatus ?? tHero("unknown")}
              />
              <Field
                label={tOv("fieldBrandSafety")}
                value={kol.brandSafetyRating ?? tHero("unknown")}
              />
            </dl>
            <div className="mt-6 space-y-3">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  {tOv("fieldTags")}
                </p>
                {kol.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {kol.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded border border-cyan-fixed/20 bg-cyan-fixed/10 px-2 py-1 text-[11px] text-cyan-fixed"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-on-surface-variant/70">
                    {tOv("tagsEmpty")}
                  </p>
                )}
              </div>
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
                  {tOv("fieldBio")}
                </p>
                <p className="text-sm text-on-surface-variant">
                  {kol.bio ?? tOv("bioEmpty")}
                </p>
              </div>
            </div>
          </div>

          <aside className="flex flex-col gap-6">
            <div className="glass-panel rounded-2xl border border-cyan/20 p-6 text-center ambient-glow">
              <p className="text-[11px] font-bold uppercase tracking-wider text-cyan-fixed">
                {tOv("valueScoreLabel")}
              </p>
              {kol.valueScore != null ? (
                <>
                  <p className="mt-2 text-5xl font-extrabold text-cyan">
                    {kol.valueScore}
                  </p>
                  <p className="mt-3 text-xs text-on-surface-variant">
                    {tOv("valueScoreCaption")}
                  </p>
                  <details className="mt-4 text-left text-[11px] text-on-surface-variant">
                    <summary className="cursor-pointer select-none text-cyan-fixed">
                      {tOv("valueBreakdownTitle")}
                    </summary>
                    <ul className="mt-2 space-y-1 pl-3">
                      <li>• {tOv("valueBreakdownFollowers")}</li>
                      <li>• {tOv("valueBreakdownEngagement")}</li>
                      <li>• {tOv("valueBreakdownCategories")}</li>
                      <li>• {tOv("valueBreakdownNormalize")}</li>
                    </ul>
                  </details>
                </>
              ) : (
                <p className="mt-2 text-xs text-on-surface-variant/70">
                  {tOv("valueEmpty")}
                </p>
              )}
            </div>

            <div
              className="glass-panel space-y-5 rounded-2xl border border-on-surface/5 p-6"
              data-testid="kol-actions"
            >
              <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-fixed">
                {tOv("sectionActions")}
              </h2>
              <RelationshipStatusSelect
                kolId={kol.id}
                currentStatus={
                  (RELATIONSHIP_STATUSES as readonly string[]).includes(
                    kol.relationshipStatus
                  )
                    ? (kol.relationshipStatus as RelationshipStatus)
                    : "prospect"
                }
              />
              <SavedToggleButton kolId={kol.id} currentSaved={kol.isSaved} />
            </div>
          </aside>
        </section>
      ) : (
        <section
          className="glass-panel rounded-2xl border border-on-surface/5 p-10 text-center"
          data-testid={`kol-empty-${activeTab}`}
        >
          <h2 className="text-lg font-semibold text-white">
            {tTabs(activeTab)}
          </h2>
          <p className="mt-3 text-sm text-on-surface-variant">
            {tEmpty(activeTab)}
          </p>
        </section>
      )}
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
        {label}
      </span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-on-surface">{value}</dd>
    </div>
  );
}
