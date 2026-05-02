/**
 * B5-F004 · Recent 6 videos grid (server component).
 *
 * Renders 3×2 thumbnail grid below the overview info card. Items are
 * resolved upstream in page.tsx via `loadRecentVideos` (channels.list
 * contentDetails 1u + playlistItems.list 1u, cached 24h in
 * `Kol.metadata.recent_videos`) and passed in as a prop so F006's
 * topic-cloud loader can reuse the same fetch instead of re-hitting
 * YouTube + the DB.
 */
import { getTranslations } from "next-intl/server";
import Image from "next/image";

import { GlassPanel } from "@/components/common";
import type { RecentVideoItem } from "@/lib/kol-detail/recent-videos";

interface Props {
  items: RecentVideoItem[] | null;
  platform: string;
}

export async function RecentVideosGrid(props: Props) {
  const t = await getTranslations("kolProfile.recentVideos");

  if (props.platform !== "youtube") return null;

  return (
    <GlassPanel
      className="border-on-surface/5 rounded-2xl border p-6"
      data-testid="kol-recent-videos"
    >
      <h2 className="text-cyan-fixed mb-4 text-sm font-semibold tracking-wider uppercase">
        {t("title")}
      </h2>
      {props.items && props.items.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {props.items.slice(0, 6).map((v) => (
            <a
              key={v.videoId}
              href={`https://www.youtube.com/watch?v=${v.videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="group hover:border-cyan-fixed/30 overflow-hidden rounded-lg border border-white/5 bg-white/[0.02] transition-colors"
              data-testid={`kol-recent-video-${v.videoId}`}
            >
              {v.thumbnailUrl ? (
                <Image
                  src={v.thumbnailUrl}
                  alt=""
                  width={320}
                  height={180}
                  loading="lazy"
                  className="aspect-video w-full object-cover"
                />
              ) : (
                <div className="text-on-surface-variant/40 flex aspect-video w-full items-center justify-center">
                  <span className="material-symbols-outlined" aria-hidden>
                    play_circle
                  </span>
                </div>
              )}
              <p className="text-on-surface group-hover:text-cyan-fixed line-clamp-2 px-2 py-2 text-xs">
                {v.title}
              </p>
            </a>
          ))}
        </div>
      ) : (
        <p className="text-on-surface-variant/70 text-xs">{t("empty")}</p>
      )}
    </GlassPanel>
  );
}
