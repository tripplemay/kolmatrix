/**
 * ActivityFeedItem — 活动时间线条目
 *
 * 用于 Dashboard "Recent Activity" / campaign-detail timeline / email-center
 * reply feed。`showTimeline=true` 时左侧渲染 4px 圆点 + 垂直残余线；
 * 关闭时退化成普通 list item。
 * HTML 源：campaign-detail.html:493-499。
 */
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Accent = "cyan" | "purple" | "secondary";

interface ActivityFeedItemProps {
  text: ReactNode;
  time: string;
  icon?: string;
  accent?: Accent;
  showTimeline?: boolean;
  rightAction?: ReactNode;
  className?: string;
}

const ACCENT_BORDER: Record<Accent, string> = {
  cyan: "border-brand-500",
  purple: "border-purple",
  secondary: "border-on-surface-variant",
};

export function ActivityFeedItem({
  text,
  time,
  icon,
  accent = "cyan",
  showTimeline = true,
  rightAction,
  className,
}: ActivityFeedItemProps) {
  return (
    <div
      className={cn(
        "relative flex items-start justify-between gap-3",
        showTimeline && "pl-8",
        className
      )}
    >
      {showTimeline ? (
        <span
          aria-hidden
          className={cn(
            "bg-navy-base absolute top-1.5 left-0 h-3.5 w-3.5 rounded-full border-2",
            ACCENT_BORDER[accent]
          )}
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-on-surface text-[13px] leading-snug">{text}</p>
        <span className="text-on-surface-variant/70 text-[11px]">{time}</span>
      </div>
      {icon ? (
        <span
          className="text-on-surface-variant/70 material-symbols-outlined text-[18px]"
          aria-hidden
        >
          {icon}
        </span>
      ) : null}
      {rightAction ? <div className="shrink-0">{rightAction}</div> : null}
    </div>
  );
}
