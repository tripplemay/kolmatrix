/**
 * CampaignRow — Campaign 行（logo + 名 + 进度条 + 2 个指标 + more 菜单）
 *
 * Dashboard "Active Campaigns" / Campaigns 列表表格 / Campaign detail KOL
 * 表都走此结构。status dot 用语义色标记状态。
 * HTML 源：dashboard.html:269-295。
 */
import Image from "next/image";

import { cn } from "@/lib/utils";

type Status = "active" | "paused" | "draft" | "completed";

interface Metric {
  label: string;
  value: string | number;
}

interface CampaignRowProps {
  name: string;
  logo?: string | null;
  subtitle?: string;
  progress?: number;
  primaryMetric?: Metric;
  secondaryMetric?: Metric;
  status?: Status;
  onMoreClick?: () => void;
  className?: string;
}

const STATUS_DOT: Record<Status, string> = {
  active: "bg-emerald-400",
  paused: "bg-amber-400",
  draft: "bg-on-surface-variant/50",
  completed: "bg-cyan",
};

export function CampaignRow(props: CampaignRowProps) {
  const {
    name,
    logo,
    subtitle,
    progress,
    primaryMetric,
    secondaryMetric,
    status,
    onMoreClick,
    className,
  } = props;
  const clampedProgress =
    typeof progress === "number" ? Math.min(Math.max(progress, 0), 100) : null;

  return (
    <div
      className={cn(
        "bg-surface-high flex flex-col items-start gap-4 rounded-[12px] p-4 sm:flex-row sm:items-center",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3 sm:w-1/3">
        <div className="bg-surface-highest relative h-12 w-12 shrink-0 overflow-hidden rounded-[10px]">
          {logo ? (
            <Image src={logo} alt="" fill sizes="48px" className="object-cover" />
          ) : (
            <span
              className="material-symbols-outlined text-on-surface-variant flex h-full w-full items-center justify-center text-lg"
              aria-hidden
            >
              campaign
            </span>
          )}
          {status ? (
            <span
              aria-label={`status ${status}`}
              className={cn(
                "border-surface-high absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2",
                STATUS_DOT[status]
              )}
            />
          ) : null}
        </div>
        <div className="min-w-0">
          <h4 className="text-on-surface truncate text-[15px] font-semibold">{name}</h4>
          {subtitle ? (
            <p className="text-on-surface-variant/70 truncate text-xs">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {clampedProgress !== null ? (
        <div className="w-full flex-1 sm:px-4">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-on-surface-variant">Progress</span>
            <span className="text-cyan font-semibold">{clampedProgress}%</span>
          </div>
          <div className="bg-navy-base h-1.5 w-full overflow-hidden rounded-full">
            <div className="gradient-cta h-full" style={{ width: `${clampedProgress}%` }} />
          </div>
        </div>
      ) : null}
      <div className="flex shrink-0 items-center gap-6">
        {primaryMetric ? <MetricCell metric={primaryMetric} /> : null}
        {secondaryMetric ? <MetricCell metric={secondaryMetric} /> : null}
        {onMoreClick ? (
          <button
            type="button"
            onClick={onMoreClick}
            aria-label="More"
            className="text-on-surface-variant hover:text-on-surface inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[18px]">more_vert</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function MetricCell({ metric }: { metric: Metric }) {
  return (
    <div className="text-right">
      <p className="text-on-surface-variant/70 text-[10px] font-semibold tracking-wider uppercase">
        {metric.label}
      </p>
      <p className="text-on-surface text-sm font-semibold">{metric.value}</p>
    </div>
  );
}
