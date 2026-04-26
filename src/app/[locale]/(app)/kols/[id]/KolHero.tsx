/**
 * MVP-vf-F006 · KOL profile hero (server component).
 *
 * Top banner: avatar + display name + handle + bio + 4 inline stats.
 * Pulled out of page.tsx to keep the parent under the ≤20 hardcoded
 * className threshold.
 */
import { getTranslations } from "next-intl/server";

interface Props {
  displayName: string;
  handle: string;
  platform: string;
  bio: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  language: string | null;
  followerCount: number;
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

export async function KolHero(props: Props) {
  const t = await getTranslations("kolProfile.hero");
  return (
    <section
      className="glass-panel relative overflow-hidden rounded-2xl border border-white/5 p-8"
      data-testid="kol-hero"
    >
      <div className="flex flex-wrap items-start gap-6">
        <div
          className="flex h-[120px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-white/10 bg-gradient-to-br from-cyan-fixed-dim to-cyan-soft text-3xl font-extrabold text-on-primary shadow-2xl"
          aria-hidden
        >
          {props.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={props.avatarUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <span>{initialsOf(props.displayName)}</span>
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-white">
              {props.displayName}
            </h1>
            <p className="mt-1 text-sm text-cyan-fixed">
              @{props.handle} · {props.platform.toUpperCase()}
            </p>
          </div>
          {props.bio ? (
            <p className="max-w-2xl text-sm leading-relaxed text-on-surface-variant">
              {props.bio}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-4 text-[13px] text-on-surface-variant">
            <Stat label={t("followers")} value={formatFollowers(props.followerCount)} />
            <Stat label={t("country")} value={props.countryCode ?? t("unknown")} />
            <Stat label={t("language")} value={props.language ?? t("unknown")} />
            <Stat label={t("platform")} value={props.platform.toUpperCase()} />
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant/70">
        {label}
      </span>
      <span className="text-sm font-semibold text-white">{value}</span>
    </div>
  );
}
