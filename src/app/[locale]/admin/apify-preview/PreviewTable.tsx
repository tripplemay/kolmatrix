"use client";

/**
 * BL-012-F003 · Apify-KOL preview table (Stage 1.5 read-only review surface).
 *
 * Receives a server-fetched page of ApifyKolItems plus the query that
 * produced it, then renders:
 *   - Filter row (platform / minFollowers / hasEmail / sort / page size)
 *     URL-synced via next/navigation router.
 *   - Pagination footer (previous / next).
 *   - Main table with per-column quality indicators (empty → muted, emails
 *     present → green, aggregator emails present → purple).
 *   - Row expand panel that pretty-prints the raw JSON + copy button.
 */
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition, type FormEvent, type ReactNode } from "react";

import { EmptyState } from "@/components/common";
import {
  APIFY_KOL_PLATFORMS,
  APIFY_KOL_SORTS,
  type ApifyKolItem,
  type ApifyKolPlatform,
  type ApifyKolSort,
  type ApifyPreviewQuery,
} from "@/lib/admin/apify-preview-client";

export interface PreviewTableProps {
  items: ApifyKolItem[];
  page: number;
  pageSize: number;
  total: number;
  query: ApifyPreviewQuery;
  /**
   * Pre-serialized raw page object (data + page + pageSize + total) — only
   * referenced as an opaque blob in tests; per-row raw JSON is rebuilt from
   * the item itself so each expand panel stays self-contained.
   */
  rawPageJson?: string;
}

const DEFAULT_PAGE_SIZE = 50;

function buildSearch(next: ApifyPreviewQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (next.platform) params.set("platform", next.platform);
  if (typeof next.minFollowers === "number") {
    params.set("minFollowers", String(next.minFollowers));
  }
  if (next.hasEmail) params.set("hasEmail", "true");
  if (next.sort) params.set("sort", next.sort);
  if (typeof next.page === "number" && next.page > 1) {
    params.set("page", String(next.page));
  }
  if (typeof next.pageSize === "number" && next.pageSize !== DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(next.pageSize));
  }
  return params;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRelativeTime(iso: string | null | undefined, now: Date = new Date()): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const diffMs = now.getTime() - then.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diffMs < minute) return "just now";
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 30 * day) return `${Math.floor(diffMs / day)}d ago`;
  return then.toISOString().slice(0, 10);
}

function ScoreDot({ value, label }: { value: number | null | undefined; label: string }) {
  const filled = value == null ? 0 : Math.max(0, Math.min(1, value));
  const tone =
    value == null
      ? "bg-outline-variant"
      : filled >= 0.7
        ? "bg-cyan"
        : filled >= 0.4
          ? "bg-cyan/60"
          : "bg-outline";
  return (
    <span
      data-testid={`score-dot-${label}`}
      title={`${label}: ${value == null ? "n/a" : value.toFixed(2)}`}
      className="inline-flex h-2 w-8 items-center"
    >
      <span className="block h-2 w-full overflow-hidden rounded-full bg-surface-high">
        <span
          className={`block h-full ${tone}`}
          style={{ width: `${Math.round(filled * 100)}%` }}
        />
      </span>
    </span>
  );
}

function EmailBadge({ count, tone }: { count: number; tone: "green" | "purple" | "muted" }) {
  const color =
    tone === "green"
      ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30"
      : tone === "purple"
        ? "bg-purple/15 text-purple ring-purple/30"
        : "bg-surface-high text-on-surface-variant ring-outline-variant/30";
  return (
    <span
      className={`inline-flex min-w-6 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${color}`}
    >
      {count}
    </span>
  );
}

export function PreviewTable({ items, page, pageSize, total, query }: PreviewTableProps) {
  const t = useTranslations("admin.apifyPreview");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  function pushQuery(next: ApifyPreviewQuery) {
    const params = buildSearch(next);
    const qs = params.toString();
    const url = qs ? `?${qs}` : "";
    startTransition(() => {
      router.push(`${window.location.pathname}${url}`);
    });
  }

  function onPlatformChange(value: string) {
    pushQuery({
      ...query,
      page: 1,
      platform: value
        ? (value as ApifyKolPlatform)
        : undefined,
    });
  }

  function onSortChange(value: string) {
    pushQuery({ ...query, page: 1, sort: value as ApifyKolSort });
  }

  function onMinFollowersChange(value: string) {
    const parsed = value === "" ? undefined : Number(value);
    pushQuery({
      ...query,
      page: 1,
      minFollowers: typeof parsed === "number" && Number.isFinite(parsed) ? parsed : undefined,
    });
  }

  function onHasEmailToggle(checked: boolean) {
    pushQuery({ ...query, page: 1, hasEmail: checked || undefined });
  }

  function onPageChange(nextPage: number) {
    pushQuery({ ...query, page: Math.max(1, nextPage) });
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
  }

  async function copyJson(item: ApifyKolItem, id: string) {
    try {
      await navigator.clipboard.writeText(JSON.stringify(item, null, 2));
      setCopiedId(id);
      setTimeout(() => setCopiedId((current) => (current === id ? null : current)), 1500);
    } catch {
      // Clipboard write blocked (no HTTPS / permissions). The button just
      // stays in its idle state — admin can still copy manually from the
      // pre block below the row. No noisy error toast in this read-only
      // tool.
    }
  }

  // Allow the page to round-trip the URL even if the link came from a stale
  // bookmark with extra params we don't recognise.
  const platformValue = query.platform ?? searchParams?.get("platform") ?? "";
  const sortValue = query.sort ?? "recent";

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));

  return (
    <section className="space-y-6">
      <form
        onSubmit={onSubmit}
        className="flex flex-wrap items-end gap-4 rounded-xl bg-surface-low/60 p-4 ring-1 ring-outline-variant/30"
        data-testid="apify-preview-filter-row"
      >
        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          {t("filterPlatform")}
          <select
            data-testid="filter-platform"
            className="rounded-md bg-surface px-3 py-2 text-sm text-on-surface ring-1 ring-outline-variant/40"
            value={platformValue}
            onChange={(event) => onPlatformChange(event.target.value)}
          >
            <option value="">{t("filterPlatformAll")}</option>
            {APIFY_KOL_PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          {t("filterMinFollowers")}
          <input
            data-testid="filter-min-followers"
            type="number"
            min={0}
            className="w-32 rounded-md bg-surface px-3 py-2 text-sm text-on-surface ring-1 ring-outline-variant/40"
            value={query.minFollowers ?? ""}
            onChange={(event) => onMinFollowersChange(event.target.value)}
          />
        </label>

        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            data-testid="filter-has-email"
            type="checkbox"
            className="h-4 w-4 rounded border-outline-variant"
            checked={Boolean(query.hasEmail)}
            onChange={(event) => onHasEmailToggle(event.target.checked)}
          />
          {t("filterHasEmail")}
        </label>

        <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
          {t("filterSort")}
          <select
            data-testid="filter-sort"
            className="rounded-md bg-surface px-3 py-2 text-sm text-on-surface ring-1 ring-outline-variant/40"
            value={sortValue}
            onChange={(event) => onSortChange(event.target.value)}
          >
            {APIFY_KOL_SORTS.map((s) => (
              <option key={s} value={s}>
                {t(`sortOptions.${s}`)}
              </option>
            ))}
          </select>
        </label>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon="search_off"
          title={t("emptyTitle")}
          description={t("emptyDescription")}
          testId="apify-preview-empty"
        />
      ) : (
        <div
          className="overflow-x-auto rounded-xl bg-surface-low/60 ring-1 ring-outline-variant/30"
          data-testid="apify-preview-table-container"
        >
          <table className="w-full text-left text-sm" data-testid="apify-preview-table">
            <thead className="border-b border-outline-variant/30 text-xs uppercase tracking-wide text-on-surface-variant">
              <tr>
                <th className="px-4 py-2 font-medium">{t("columns.username")}</th>
                <th className="px-4 py-2 font-medium">{t("columns.platform")}</th>
                <th className="px-4 py-2 font-medium">{t("columns.followers")}</th>
                <th className="px-4 py-2 font-medium">{t("columns.verified")}</th>
                <th className="px-4 py-2 font-medium">{t("columns.scores")}</th>
                <th className="px-4 py-2 font-medium">{t("columns.emails")}</th>
                <th className="px-4 py-2 font-medium">{t("columns.tags")}</th>
                <th className="px-4 py-2 font-medium">{t("columns.lastScraped")}</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const id = String(item.id);
                const expanded = expandedId === id;
                const emails = item.emails ?? [];
                const aggregator = item.aggregatorEmails ?? [];
                const tags = item.matchedTags ?? [];
                return (
                  <Row
                    key={id}
                    id={id}
                    item={item}
                    emails={emails}
                    aggregatorEmails={aggregator}
                    tags={tags}
                    expanded={expanded}
                    onToggle={() => setExpandedId(expanded ? null : id)}
                    copyDone={copiedId === id}
                    onCopy={() => copyJson(item, id)}
                    copyLabel={t(copiedId === id ? "copyJsonDone" : "copyJson")}
                    expandPanelLabel={t("expandPanel")}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <nav
        className="flex items-center justify-between text-sm text-on-surface-variant"
        data-testid="apify-preview-pagination"
      >
        <span>{t("pagination.status", { page, totalPages, total })}</span>
        <div className="flex gap-2">
          <button
            type="button"
            data-testid="pagination-previous"
            className="rounded-md bg-surface-high px-3 py-1 text-on-surface ring-1 ring-outline-variant/40 disabled:opacity-40"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            {t("pagination.previous")}
          </button>
          <button
            type="button"
            data-testid="pagination-next"
            className="rounded-md bg-surface-high px-3 py-1 text-on-surface ring-1 ring-outline-variant/40 disabled:opacity-40"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            {t("pagination.next")}
          </button>
        </div>
      </nav>
    </section>
  );

  function Row(props: {
    id: string;
    item: ApifyKolItem;
    emails: string[];
    aggregatorEmails: string[];
    tags: string[];
    expanded: boolean;
    onToggle: () => void;
    copyDone: boolean;
    onCopy: () => void;
    copyLabel: string;
    expandPanelLabel: string;
  }) {
    const { id, item, emails, aggregatorEmails, tags, expanded, onToggle } = props;
    const muted = "text-on-surface-variant/40";
    const profileHref = item.profileUrl ?? "#";
    return (
      <>
        <tr
          data-testid={`apify-preview-row-${id}`}
          className="cursor-pointer border-b border-outline-variant/20 hover:bg-surface-high/40"
          onClick={onToggle}
        >
          <td className="px-4 py-3">
            <a
              href={profileHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              {item.displayName ? `${item.displayName} ` : ""}@{item.username}
            </a>
          </td>
          <td className="px-4 py-3 text-on-surface">{item.platform}</td>
          <td className={`px-4 py-3 ${item.followers == null ? muted : "text-on-surface"}`}>
            {formatNumber(item.followers)}
          </td>
          <td className="px-4 py-3">
            {item.verified == null ? (
              <span className={muted}>—</span>
            ) : item.verified ? (
              <span aria-label="verified" className="text-cyan">
                ✓
              </span>
            ) : (
              <span className={muted}>—</span>
            )}
          </td>
          <td className="px-4 py-3">
            <span className="flex items-center gap-1">
              <ScoreDot value={item.relevanceScore} label="relevance" />
              <ScoreDot value={item.influenceScore} label="influence" />
              <ScoreDot value={item.qualityScore} label="quality" />
              <ScoreDot value={item.reachabilityScore} label="reachability" />
            </span>
          </td>
          <td className="px-4 py-3">
            <span className="flex items-center gap-1">
              <EmailBadge
                count={emails.length}
                tone={emails.length > 0 ? "green" : "muted"}
              />
              {aggregatorEmails.length > 0 ? (
                <EmailBadge count={aggregatorEmails.length} tone="purple" />
              ) : null}
            </span>
          </td>
          <td className="px-4 py-3">
            {tags.length === 0 ? (
              <span className={muted}>—</span>
            ) : (
              <span className="flex flex-wrap gap-1">
                {tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-surface-high px-2 py-0.5 text-xs text-on-surface-variant"
                  >
                    {tag}
                  </span>
                ))}
              </span>
            )}
          </td>
          <td className={`px-4 py-3 ${item.lastScrapedAt ? "text-on-surface" : muted}`}>
            {formatRelativeTime(item.lastScrapedAt)}
          </td>
        </tr>
        {expanded ? (
          <tr data-testid={`apify-preview-expand-${id}`}>
            <td colSpan={8} className="bg-surface-lowest px-4 py-4">
              <ExpandPanel
                json={JSON.stringify(item, null, 2)}
                label={props.expandPanelLabel}
                copyLabel={props.copyLabel}
                onCopy={props.onCopy}
                copyDone={props.copyDone}
              />
            </td>
          </tr>
        ) : null}
      </>
    );
  }
}

function ExpandPanel({
  json,
  label,
  copyLabel,
  onCopy,
  copyDone,
}: {
  json: string;
  label: ReactNode;
  copyLabel: ReactNode;
  onCopy: () => void;
  copyDone: boolean;
}): ReactNode {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          {label}
        </h3>
        <button
          type="button"
          data-testid="expand-copy"
          onClick={onCopy}
          className={`rounded-md px-2 py-1 text-xs ring-1 ring-outline-variant/40 ${
            copyDone ? "bg-cyan/20 text-cyan" : "bg-surface-high text-on-surface-variant"
          }`}
        >
          {copyLabel}
        </button>
      </div>
      <pre className="max-h-[480px] overflow-auto rounded-md bg-surface-low p-3 text-xs text-on-surface-variant">
        {json}
      </pre>
    </div>
  );
}
