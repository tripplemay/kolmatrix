/**
 * StatCard — KPI 卡片（数字 + 标签 + 可选 trend chip + 可选 sparkline）
 *
 * 跨 6 页出现。`trend` / `sparkline` / `icon` 均可选，单 metric 卡也 OK。
 * 决议 #1：sparkline 存在时右下角渲染 bar chart，缺时 trend chip 独占行。
 * HTML 源：dashboard.html:190-206 (完整形态含 sparkline)。
 */
import { cn } from "@/lib/utils";

type TrendDirection = "up" | "flat" | "down";
type TrendAccent = "emerald" | "purple" | "warning";

export interface StatCardTrend {
  direction: TrendDirection;
  percent: number;
  accent?: TrendAccent;
  /**
   * BL-052 F004: when set, the chip renders "—" instead of "X%" and the
   * tooltip text is exposed via the native `title` attribute on hover.
   * Used for the "data accumulating" fallback while the kpi_daily_snapshot
   * history is shorter than the trend window.
   */
  tooltip?: string;
}

interface StatCardProps {
  label: string;
  value: string | number;
  subLabel?: string;
  trend?: StatCardTrend;
  icon?: string;
  sparkline?: number[];
  className?: string;
}

const TREND_ICON: Record<TrendDirection, string> = {
  up: "trending_up",
  flat: "trending_flat",
  down: "trending_down",
};

const TREND_TEXT: Record<NonNullable<TrendAccent>, string> = {
  emerald: "text-emerald-400 bg-emerald-400/10",
  purple: "text-purple bg-purple/10",
  warning: "text-warning bg-warning/10",
};

function defaultAccent(dir: TrendDirection): TrendAccent {
  if (dir === "up") return "emerald";
  if (dir === "down") return "warning";
  return "purple";
}

export function StatCard({
  label,
  value,
  subLabel,
  trend,
  icon,
  sparkline,
  className,
}: StatCardProps) {
  const accent = trend?.accent ?? (trend ? defaultAccent(trend.direction) : "emerald");
  const sparkMax = sparkline && sparkline.length ? Math.max(...sparkline, 1) : 1;

  return (
    <div
      className={cn(
        "bg-surface-low ambient-glow relative flex flex-col justify-between overflow-hidden rounded-[16px] p-6",
        className
      )}
    >
      {icon ? (
        <span
          aria-hidden
          className="material-symbols-outlined text-on-surface absolute top-4 right-4 text-6xl opacity-10"
        >
          {icon}
        </span>
      ) : null}
      <p className="text-on-surface-variant mb-1 text-sm font-medium">{label}</p>
      <h3 className="text-on-surface mb-4 text-3xl font-bold">
        {value}
        {subLabel ? (
          <span className="text-on-surface-variant/70 ml-1.5 text-sm font-medium">{subLabel}</span>
        ) : null}
      </h3>
      <div className="flex items-center justify-between">
        {trend ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium",
              TREND_TEXT[accent]
            )}
            title={trend.tooltip}
            data-testid="statcard-trend"
          >
            <span className="material-symbols-outlined text-[12px]" aria-hidden>
              {TREND_ICON[trend.direction]}
            </span>
            {trend.tooltip ? (
              "—"
            ) : (
              <>
                {trend.direction === "up" ? "+" : ""}
                {trend.percent}%
              </>
            )}
          </span>
        ) : (
          <span />
        )}
        {sparkline && sparkline.length ? (
          <div aria-hidden className="flex h-8 w-16 items-end gap-1">
            {sparkline.map((v, i) => (
              <div
                key={i}
                className={cn(
                  "bg-cyan/60 w-1.5 rounded-t-sm",
                  i === sparkline.length - 1 && "bg-cyan"
                )}
                style={{ height: `${Math.max((v / sparkMax) * 100, 8)}%` }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
