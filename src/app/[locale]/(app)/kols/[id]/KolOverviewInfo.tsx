/**
 * MVP-vf-F006 · Overview tab — KOL info card (server component).
 *
 * The big definition list of platform / handle / country / language /
 * followers / engagement / avg views / uploads / last upload /
 * monetization / brand safety, plus tags + bio sections. Pulled out
 * of page.tsx to keep the parent slim.
 */
import { getFormatter, getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";

interface Props {
  platform: string;
  handle: string;
  countryCode: string | null;
  language: string | null;
  followerCount: number;
  engagementRate: number | null;
  avgViews: number | null;
  uploadsPerMonth: number | null;
  lastUploadAt: Date | null;
  monetizationStatus: string | null;
  brandSafetyRating: string | null;
  tags: string[];
  bio: string | null;
}

function formatFollowers(n: number | null): string | null {
  if (n == null) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export async function KolOverviewInfo(props: Props) {
  const t = await getTranslations("kolProfile.overview");
  const tHero = await getTranslations("kolProfile.hero");
  const format = await getFormatter();
  const unknown = tHero("unknown");

  return (
    <GlassPanel className="rounded-2xl border border-on-surface/5 p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cyan-fixed">
        {t("sectionInfo")}
      </h2>
      <dl className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Field label={t("fieldPlatform")} value={props.platform} />
        <Field label={t("fieldHandle")} value={`@${props.handle}`} />
        <Field label={t("fieldCountry")} value={props.countryCode ?? unknown} />
        <Field label={t("fieldLanguage")} value={props.language ?? unknown} />
        <Field
          label={t("fieldFollowers")}
          value={formatFollowers(props.followerCount) ?? unknown}
        />
        <Field
          label={t("fieldEngagement")}
          value={
            props.engagementRate != null
              ? `${props.engagementRate.toFixed(1)}%`
              : unknown
          }
        />
        <Field
          label={t("fieldAvgViews")}
          value={formatFollowers(props.avgViews) ?? unknown}
        />
        <Field
          label={t("fieldUploadsPerMonth")}
          value={
            props.uploadsPerMonth != null ? String(props.uploadsPerMonth) : unknown
          }
        />
        <Field
          label={t("fieldLastUpload")}
          value={
            props.lastUploadAt
              ? format.dateTime(props.lastUploadAt, {
                  year: "numeric",
                  month: "short",
                  day: "numeric",
                })
              : unknown
          }
        />
        <Field
          label={t("fieldMonetization")}
          value={props.monetizationStatus ?? unknown}
        />
        <Field
          label={t("fieldBrandSafety")}
          value={props.brandSafetyRating ?? unknown}
        />
      </dl>

      <div className="mt-6 space-y-3">
        <TagsSection
          tags={props.tags}
          tagsLabel={t("fieldTags")}
          emptyLabel={t("tagsEmpty")}
        />
        <BioSection
          bio={props.bio}
          label={t("fieldBio")}
          emptyLabel={t("bioEmpty")}
        />
      </div>
    </GlassPanel>
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

function TagsSection({
  tags,
  tagsLabel,
  emptyLabel,
}: {
  tags: string[];
  tagsLabel: string;
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {tagsLabel}
      </p>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-cyan-fixed/20 bg-cyan-fixed/10 px-2 py-1 text-[11px] text-cyan-fixed"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant/70">{emptyLabel}</p>
      )}
    </div>
  );
}

function BioSection({
  bio,
  label,
  emptyLabel,
}: {
  bio: string | null;
  label: string;
  emptyLabel: string;
}) {
  return (
    <div>
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant">
        {label}
      </p>
      <p className="text-sm text-on-surface-variant">{bio ?? emptyLabel}</p>
    </div>
  );
}
