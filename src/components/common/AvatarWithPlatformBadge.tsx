/**
 * AvatarWithPlatformBadge — 头像 + 平台小角标（YouTube / Twitch / TikTok / IG）
 *
 * 平台色保留 Tailwind 预设（design-system §11 色彩 token 边界政策：
 * 外部品牌色不 token 化）。HTML 源：kol-discovery.html:247-251。
 * 4 档尺寸（sm w-10 / md w-14 / lg w-16 / xl w-[140px]）匹配跨页用法。
 */
import Image from "next/image";

import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg" | "xl";
type Platform = "youtube" | "twitch" | "tiktok" | "instagram";

interface AvatarWithPlatformBadgeProps {
  src?: string | null;
  alt?: string;
  name?: string;
  size?: Size;
  platform?: Platform;
  hoverBorder?: boolean;
  className?: string;
}

const AVATAR_SIZE: Record<Size, string> = {
  sm: "h-10 w-10",
  md: "h-14 w-14",
  lg: "h-16 w-16",
  xl: "h-[140px] w-[140px]",
};

// next/image `sizes` hint per size variant (BIx-F005-C). Value mirrors
// the CSS `width` of the parent `<div>` so the responsive image
// loader picks the smallest source that still fills the box.
const AVATAR_SIZES_HINT: Record<Size, string> = {
  sm: "40px",
  md: "56px",
  lg: "64px",
  xl: "140px",
};

const BADGE_SIZE: Record<Size, string> = {
  sm: "h-4 w-4 text-[10px]",
  md: "h-5 w-5 text-[12px]",
  lg: "h-6 w-6 text-[13px]",
  xl: "h-10 w-10 text-[18px]",
};

const PLATFORM_STYLE: Record<Platform, { bg: string; icon: string }> = {
  youtube: { bg: "bg-red-600", icon: "play_arrow" },
  twitch: { bg: "bg-purple-600", icon: "sports_esports" },
  tiktok: { bg: "bg-black", icon: "music_note" },
  instagram: { bg: "bg-gradient-to-br from-pink-500 to-violet-600", icon: "photo_camera" },
};

export function AvatarWithPlatformBadge({
  src,
  alt = "",
  name = "",
  size = "md",
  platform,
  hoverBorder = true,
  className,
}: AvatarWithPlatformBadgeProps) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const platformStyle = platform ? PLATFORM_STYLE[platform] : null;

  return (
    <div
      className={cn(
        "relative inline-flex shrink-0 overflow-visible rounded-full border-2 border-transparent transition-colors",
        hoverBorder && "group-hover:border-cyan hover:border-cyan",
        AVATAR_SIZE[size],
        className
      )}
    >
      <div className="bg-surface-high relative h-full w-full overflow-hidden rounded-full">
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes={AVATAR_SIZES_HINT[size]}
            className="object-cover"
          />
        ) : (
          <div className="gradient-cta flex h-full w-full items-center justify-center">
            <span className="text-navy-base text-sm font-bold">{initial}</span>
          </div>
        )}
      </div>
      {platformStyle ? (
        <span
          aria-label={`${platform} badge`}
          className={cn(
            "border-surface-low absolute right-0 bottom-0 inline-flex items-center justify-center rounded-full border-2 text-white",
            platformStyle.bg,
            BADGE_SIZE[size]
          )}
        >
          <span className="material-symbols-outlined" aria-hidden style={{ fontSize: "inherit" }}>
            {platformStyle.icon}
          </span>
        </span>
      ) : null}
    </div>
  );
}
