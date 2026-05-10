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
  channelCreatedAt: Date | null;
  videoCount: number | null;
}

function formatChannelAge(createdAt: Date | null): string | null {
  if (!createdAt) return null;
  const ms = Date.now() - createdAt.getTime();
  if (ms <= 0) return null;
  const years = ms / (365.25 * 24 * 60 * 60 * 1000);
  if (years >= 1) return `${years.toFixed(1)}y`;
  const months = ms / (30.44 * 24 * 60 * 60 * 1000);
  return `${Math.max(1, Math.round(months))}mo`;
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
  const tEngagement = await getTranslations("kol.engagementRate");
  const format = await getFormatter();
  const unknown = tHero("unknown");
  const engagementTooltip = tEngagement("tooltip");

  return (
    <GlassPanel className="border-on-surface/5 rounded-2xl border p-6">
      <h2 className="text-cyan-fixed mb-4 text-sm font-semibold tracking-wider uppercase">
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
          value={props.engagementRate != null ? `${props.engagementRate.toFixed(1)}%` : unknown}
          tooltip={engagementTooltip}
        />
        <Field label={t("fieldAvgViews")} value={formatFollowers(props.avgViews) ?? unknown} />
        <Field
          label={t("fieldUploadsPerMonth")}
          value={props.uploadsPerMonth != null ? String(props.uploadsPerMonth) : unknown}
        />
        <Field
          label={t("fieldChannelAge")}
          value={formatChannelAge(props.channelCreatedAt) ?? unknown}
        />
        <Field
          label={t("fieldVideoCount")}
          value={props.videoCount != null ? String(props.videoCount) : unknown}
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
        <Field label={t("fieldMonetization")} value={props.monetizationStatus ?? unknown} />
        <Field label={t("fieldBrandSafety")} value={props.brandSafetyRating ?? unknown} />
      </dl>

      <div className="mt-6 space-y-3">
        <TagsSection tags={props.tags} tagsLabel={t("fieldTags")} emptyLabel={t("tagsEmpty")} />
        <BioSection bio={props.bio} label={t("fieldBio")} emptyLabel={t("bioEmpty")} />
      </div>
    </GlassPanel>
  );
}

function Field({
  label,
  value,
  tooltip,
}: {
  label: string;
  value: string;
  tooltip?: string;
}) {
  return (
    <div>
      <dt className="text-on-surface-variant flex items-center gap-1 text-[11px] font-semibold tracking-wider uppercase">
        <span>{label}</span>
        {tooltip ? (
          <span
            role="img"
            aria-label={tooltip}
            title={tooltip}
            data-testid="engagement-rate-tooltip"
            className="material-symbols-outlined cursor-help text-[14px] leading-none text-on-surface-variant/70"
          >
            info
          </span>
        ) : null}
      </dt>
      <dd className="text-on-surface mt-1 text-sm">{value}</dd>
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
      <p className="text-on-surface-variant mb-1 text-[11px] font-semibold tracking-wider uppercase">
        {tagsLabel}
      </p>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="border-cyan-fixed/20 bg-cyan-fixed/10 text-cyan-fixed rounded border px-2 py-1 text-[11px]"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant/70 text-xs">{emptyLabel}</p>
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
      <p className="text-on-surface-variant mb-1 text-[11px] font-semibold tracking-wider uppercase">
        {label}
      </p>
      <p className="text-on-surface-variant text-sm">{bio ?? emptyLabel}</p>
    </div>
  );
}
