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
import { useState, useSyncExternalStore, useTransition } from "react";
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

// useSyncExternalStore 的稳定 subscribe(ready 永不变 → 无需真订阅)
const emptySubscribe = () => () => {};

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
          // BL-111-F001 — paused track is amber (warning), not error-pink.
          // --color-error (#ffb4ab) is Material's error-container salmon;
          // filling the whole track with it read as a harsh pink. Pausing
          // is an "attention" state, not an error — amber (#fec931) matches
          // the component's existing text-warning and stays clean even when
          // the covered sub-switch dims it to opacity-40 (pink muddied to
          // brown there). Run state keeps bg-white/15; thumb unchanged.
          checked ? "bg-warning" : "bg-white/15",
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

/**
 * 确定性 UTC 时间戳格式化(BL-108 fixing 修 React #418 水合失配)。
 *
 * 原实现 `new Date(iso).toLocaleString()` 依赖运行时时区+locale:SSR 在
 * 服务器时区渲染、客户端水合时按浏览器时区重渲 → 文本节点不一致 → React
 * 抛 #418 水合失配 → 整个客户端子树(含两个开关)被丢弃重渲, onClick 不再
 * 绑定 → 监控页开关点击无效(Codex verifying L2 blocker)。
 *
 * 用 `getUTC*` 输出固定 `YYYY-MM-DD HH:mm UTC` 格式:服务端/客户端逐字符
 * 一致, 杜绝失配;UTC 也是 ops 监控页的惯例口径(团队跨时区无歧义)。
 */
function formatTimestampUtc(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`
  );
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

  // 水合门闸(BL-108 reverify fix-round 2)。SSR 与首次客户端渲染 ready=false →
  // 两开关 disabled;水合提交后 ready=true → 开关可点。
  // 为何必须:SSR 把开关按钮渲进 HTML 后, 到 React 完成水合、给 onClick 绑事件
  // 之间有一段窗口(staging 实证 ~0.7–1.25s)。这期间按钮可见可点但 onClick 未
  // 绑定, 真实点击被静默丢弃且 React 18+ 事件重放在本场景不补触发(reverify
  // 实证 trusted click 永不重放)→ 用户点"暂停爬虫"无任何反应。门闸把"可点"
  // 严格对齐"已水合": 真实用户看到诚实的未就绪态, Playwright 标准 click 也会
  // 自动等到 enabled 才点。用 useSyncExternalStore(server=false / client=true)做
  // 水合安全的客户端检测: SSR/首屏均 false 不引入失配, 提交后切 true(比
  // useState+useEffect 更 idiomatic, 且避开 react-hooks/set-state-in-effect)。
  const ready = useSyncExternalStore(emptySubscribe, () => true, () => false);

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
      data-ready={ready ? "true" : "false"}
      className="rounded-xl border border-white/10 bg-surface-low p-5 space-y-4"
    >
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-white/80">{t("title")}</h2>
        <span
          data-testid="pause-status"
          data-state={unknown ? "unknown" : anyPaused ? "paused" : "running"}
          className={[
            "rounded-full px-2.5 py-0.5 text-xs font-medium",
            // BL-111-F001 — paused badge aligns with the amber track
            // (warning = "paused/attention" semantics), not error-pink.
            unknown
              ? "bg-white/10 text-white/50"
              : anyPaused
                ? "bg-warning/15 text-warning"
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
      ) : !ready ? (
        <p role="status" data-testid="pause-initializing-note" className="text-xs text-white/40">
          {t("initializing")}
        </p>
      ) : null}

      <div className="space-y-4">
        <SwitchRow
          id="pause-main-switch"
          label={t("mainLabel")}
          description={t("mainDesc")}
          checked={mainPaused}
          disabled={!ready || unknown || isPending}
          onFlip={(nextChecked) => setPending({ flag: "main", nextPaused: nextChecked })}
        />
        <SwitchRow
          id="pause-refresh-switch"
          label={t("subLabel")}
          description={t("subDesc")}
          checked={mainPaused ? true : subPaused}
          disabled={!ready || unknown || isPending || mainPaused}
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
            {control.lastRefreshAt ? formatTimestampUtc(control.lastRefreshAt) : t("never")}
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
