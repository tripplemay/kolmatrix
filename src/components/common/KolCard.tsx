/**
 * KolCard — KOL 卡片（grid 网格卡 / row 表格行 双变体）
 *
 * grid：Dashboard AI 推荐 / KOL Discovery 结果。头像居中，AiScoreBadge
 *   右上角浮标，tags 一行 flex-wrap。
 * row： KOL Database / Campaign detail 参与 KOL 行。头像居左，AI score
 *   inline，tags 同行。
 * HTML 源：dashboard.html:365-380（grid）。
 */
import { cn } from "@/lib/utils";

import { AiScoreBadge } from "./AiScoreBadge";
import { AvatarWithPlatformBadge } from "./AvatarWithPlatformBadge";
import { TagChip } from "./TagChip";

type Variant = "grid" | "row";
type Platform = "youtube" | "twitch" | "tiktok" | "instagram";

interface KolCardProps {
  name: string;
  avatar?: string | null;
  followers: string;
  aiScore?: number;
  platform?: Platform;
  tags?: string[];
  variant?: Variant;
  onClick?: () => void;
  className?: string;
}

export function KolCard({
  name,
  avatar,
  followers,
  aiScore,
  platform,
  tags,
  variant = "grid",
  onClick,
  className,
}: KolCardProps) {
  const isGrid = variant === "grid";

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      className={cn(
        "group bg-surface-low hover:bg-surface-high border-transparent hover:border-cyan/30 relative rounded-[16px] border transition-colors",
        isGrid ? "flex flex-col items-center p-5 text-center" : "flex items-center gap-4 p-4",
        onClick && "cursor-pointer",
        className
      )}
    >
      {isGrid && typeof aiScore === "number" ? (
        <div className="absolute top-3 right-3 z-10">
          <AiScoreBadge score={aiScore} variant="pill" size="sm" />
        </div>
      ) : null}
      <AvatarWithPlatformBadge
        src={avatar}
        name={name}
        size={isGrid ? "lg" : "sm"}
        platform={platform}
      />
      <div className={cn("flex min-w-0 flex-col", isGrid ? "mt-3 items-center" : "flex-1")}>
        <h4 className="text-on-surface truncate text-sm font-bold">{name}</h4>
        <p className="text-on-surface-variant/70 text-xs">{followers}</p>
        {tags && tags.length ? (
          <div className={cn("mt-2 flex flex-wrap gap-1", isGrid ? "justify-center" : "justify-start")}>
            {tags.slice(0, 3).map((t) => (
              <TagChip key={t} label={t} tone="navy" />
            ))}
          </div>
        ) : null}
      </div>
      {!isGrid && typeof aiScore === "number" ? (
        <AiScoreBadge score={aiScore} variant="pill" size="sm" className="shrink-0" />
      ) : null}
    </div>
  );
}
