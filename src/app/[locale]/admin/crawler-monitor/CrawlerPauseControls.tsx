"use client";

/**
 * BL-108-F004 · 爬虫暂停开关控制面(监控页)。
 *
 * 两层开关(ADR-019 D1):主「暂停所有爬虫抓取」+ 子「暂停 refresh」。
 * - 开关语义:checked = 已暂停(开关名即"暂停 X")
 * - 主暂停时子开关置灰(已被主开关覆盖, D1 层级)
 * - availability=unknown(爬虫不可达)→ 两开关都禁用, 显示未知态
 * - 翻转前确认弹窗讲清代价(D6:暂停=指标冻结, 须可控可视)
 * - 乐观 UI:先翻本地态 → setCrawlerStateAction 失败回滚 + 瞬态错误条
 *   (codebase 无全局 toast 设施, 沿用内联 transient alert 惯例)
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import type { CrawlerControlState } from "@/lib/admin/crawler-control-state";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/Dialog";

import { setCrawlerStateAction } from "./actions";

interface PendingFlip {
  flag: "main" | "sub";
  /** 目标暂停态:true = 即将暂停, false = 即将恢复 */
  nextPaused: boolean;
}

function SwitchRow({
  id,
  label,
  description,
  checked,
  disabled,
  disabledNote,
  onFlip,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  disabledNote?: string;
  onFlip: (nextChecked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-0.5">
        <p className="text-sm font-medium text-white/90">{label}</p>
        <p className="text-xs text-white/40">{description}</p>
        {disabled && disabledNote ? (
          <p className="text-xs text-warning/80">{disabledNote}</p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        data-testid={id}
        disabled={disabled}
        onClick={() => onFlip(!checked)}
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-error" : "bg-white/15",
          disabled ? "cursor-not-allowed opacity-40" : "cursor-pointer",
        ].join(" ")}
      >
        <span
          aria-hidden
          className={[
            "absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

type DurationT = (
  key: "durationDays" | "durationHours" | "durationMinutes",
  values: Record<string, number>,
) => string;

function formatDuration(ms: number, t: DurationT): string {
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return t("durationDays", { days, hours: hours % 24 });
  if (hours > 0) return t("durationHours", { hours, minutes: minutes % 60 });
  return t("durationMinutes", { minutes });
}

export function CrawlerPauseControls({ control }: { control: CrawlerControlState }) {
  const t = useTranslations("admin.crawlerMonitor.pause");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // 乐观本地态(null = unknown);server refresh 带来新 props 时在 render 期间
  // 重新对齐(React 官方 "adjusting state when props change" 模式, 不用 effect)
  const [scrapingEnabled, setScrapingEnabled] = useState(control.scrapingEnabled);
  const [refreshEnabled, setRefreshEnabled] = useState(control.refreshEnabled);
  const [syncedFrom, setSyncedFrom] = useState({
    scrapingEnabled: control.scrapingEnabled,
    refreshEnabled: control.refreshEnabled,
  });
  const [pending, setPending] = useState<PendingFlip | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (
    syncedFrom.scrapingEnabled !== control.scrapingEnabled ||
    syncedFrom.refreshEnabled !== control.refreshEnabled
  ) {
    setSyncedFrom({
      scrapingEnabled: control.scrapingEnabled,
      refreshEnabled: control.refreshEnabled,
    });
    setScrapingEnabled(control.scrapingEnabled);
    setRefreshEnabled(control.refreshEnabled);
  }

  const unknown = control.availability === "unknown";
  const mainPaused = scrapingEnabled === false;
  const subPaused = refreshEnabled === false;
  const anyPaused = mainPaused || subPaused;

  const confirmFlip = () => {
    if (!pending) return;
    const { flag, nextPaused } = pending;
    setPending(null);
    setError(null);

    // 乐观翻转 + 留存回滚快照
    const prev = { scrapingEnabled, refreshEnabled };
    const patch =
      flag === "main" ? { scrapingEnabled: !nextPaused } : { refreshEnabled: !nextPaused };
    if (flag === "main") setScrapingEnabled(!nextPaused);
    else setRefreshEnabled(!nextPaused);

    startTransition(async () => {
      const result = await setCrawlerStateAction(patch);
      if (!result.ok) {
        setScrapingEnabled(prev.scrapingEnabled);
        setRefreshEnabled(prev.refreshEnabled);
        setError(t("applyFailed", { error: result.error }));
        return;
      }
      setScrapingEnabled(result.state.scrapingEnabled);
      setRefreshEnabled(result.state.refreshEnabled);
      router.refresh();
    });
  };

  const confirmBody = pending
    ? pending.flag === "main"
      ? pending.nextPaused
        ? t("confirmPauseMain")
        : t("confirmResumeMain")
      : pending.nextPaused
        ? t("confirmPauseSub")
        : t("confirmResumeSub")
    : "";

  return (
    <section
      data-testid="crawler-pause-controls"
      className="rounded-xl border border-white/10 bg-surface-low p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-white/80">{t("title")}</h2>
        <span
          data-testid="pause-status"
          data-state={unknown ? "unknown" : anyPaused ? "paused" : "running"}
          className={[
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            unknown
              ? "bg-white/10 text-white/50"
              : anyPaused
                ? "bg-error/15 text-error"
                : "bg-success/15 text-success",
          ].join(" ")}
        >
          {unknown ? t("statusUnknown") : anyPaused ? t("statusPaused") : t("statusRunning")}
        </span>
        {!unknown && anyPaused && control.pausedDurationMs != null ? (
          <span className="text-xs text-white/50">
            {t("pausedFor", { duration: formatDuration(control.pausedDurationMs, t) })}
          </span>
        ) : null}
      </div>

      {unknown ? (
        <p role="alert" data-testid="pause-unknown-note" className="text-xs text-warning">
          {t("unknownNote")}
        </p>
      ) : null}

      <div className="space-y-4">
        <SwitchRow
          id="pause-main-switch"
          label={t("mainLabel")}
          description={t("mainDesc")}
          checked={mainPaused}
          disabled={unknown || isPending}
          onFlip={(nextChecked) => setPending({ flag: "main", nextPaused: nextChecked })}
        />
        <SwitchRow
          id="pause-refresh-switch"
          label={t("subLabel")}
          description={t("subDesc")}
          checked={mainPaused ? true : subPaused}
          disabled={unknown || isPending || mainPaused}
          disabledNote={mainPaused ? t("subCovered") : undefined}
          onFlip={(nextChecked) => setPending({ flag: "sub", nextPaused: nextChecked })}
        />
      </div>

      <dl className="grid grid-cols-2 gap-3 border-t border-white/5 pt-3 text-sm lg:grid-cols-3">
        <div>
          <dt className="text-white/40">{t("backlogDueNow")}</dt>
          <dd className="font-semibold text-white" data-testid="pause-backlog">
            {control.refreshBacklogDueNow == null ? "—" : control.refreshBacklogDueNow}
          </dd>
        </div>
        <div>
          <dt className="text-white/40">{t("lastRefresh")}</dt>
          <dd className="font-semibold text-white" data-testid="pause-last-refresh">
            {control.lastRefreshAt ? new Date(control.lastRefreshAt).toLocaleString() : t("never")}
          </dd>
        </div>
        <div>
          <dt className="text-white/40">{t("updatedBy")}</dt>
          <dd className="font-semibold text-white" data-testid="pause-updated-by">
            {control.updatedBy ?? "—"}
          </dd>
        </div>
      </dl>

      {error ? (
        <p role="alert" data-testid="pause-error" className="text-xs text-error">
          {error}
        </p>
      ) : null}

      <Dialog open={pending !== null} onOpenChange={(v) => (!v ? setPending(null) : undefined)}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPanel size="sm" data-testid="pause-confirm-dialog">
            <DialogHeader>
              <DialogTitle>{t("confirmTitle")}</DialogTitle>
            </DialogHeader>
            <p className="px-5 py-4 text-sm text-white/70">{confirmBody}</p>
            <DialogFooter>
              <Button
                variant="ghost"
                data-testid="pause-confirm-cancel"
                onClick={() => setPending(null)}
              >
                {t("cancel")}
              </Button>
              <Button data-testid="pause-confirm-accept" onClick={confirmFlip}>
                {t("confirm")}
              </Button>
            </DialogFooter>
          </DialogPanel>
        </DialogPortal>
      </Dialog>
    </section>
  );
}
