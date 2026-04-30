/**
 * B5-F004 · Recent 6 videos grid (server component).
 *
 * Renders 3×2 thumbnail grid below the overview info card. Resolves the
 * uploads playlist via channels.list contentDetails (1u) and the items
 * via playlistItems.list (1u), cached 24h in `Kol.metadata.recent_videos`
 * — see `src/lib/kol-detail/recent-videos.ts`.
 */
import { getTranslations } from "next-intl/server";

import { GlassPanel } from "@/components/common";
import { loadRecentVideos } from "@/lib/kol-detail/recent-videos";

interface Props {
  tenantId: string;
  kolId: string;
  platform: string;
  externalId: string | null;
  metadata: unknown;
}

export async function RecentVideosGrid(props: Props) {
  const t = await getTranslations("kolProfile.recentVideos");

  const items = await loadRecentVideos({
    tenantId: props.tenantId,
    kolId: props.kolId,
    platform: props.platform,
    externalId: props.externalId,
    metadata: props.metadata,
    apiKey: process.env.YOUTUBE_API_KEY,
  });

  if (props.platform !== "youtube") return null;

  return (
    <GlassPanel
      className="rounded-2xl border border-on-surface/5 p-6"
      data-testid="kol-recent-videos"
    >
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-cyan-fixed">
        {t("title")}
      </h2>
      {items && items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {items.slice(0, 6).map((v) => (
            <a
              key={v.videoId}
              href={`https://www.youtube.com/watch?v=${v.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] transition-colors hover:border-cyan-fixed/30"
              data-testid={`kol-recent-video-${v.videoId}`}
            >
              {v.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={v.thumbnailUrl}
                  alt=""
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="flex aspect-video w-full items-center justify-center text-on-surface-variant/40">
                  <span className="material-symbols-outlined" aria-hidden>
                    play_circle
                  </span>
                </div>
              )}
              <p className="line-clamp-2 px-2 py-2 text-xs text-on-surface group-hover:text-cyan-fixed">
                {v.title}
              </p>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-xs text-on-surface-variant/70">{t("empty")}</p>
      )}
    </GlassPanel>
  );
}
