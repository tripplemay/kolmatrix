"use client";

/**
 * B7a-F002 · `<SmartMatchDialog>` — AI Smart Match interaction surface.
 *
 * Three-step flow:
 *   1. Pick a product (dropdown, populated from server-side preload).
 *   2. POST /api/kols/smart-match → top 10 KOL hits w/ match score.
 *   3. Display ring-progress + per-card "Save" + "Save all to campaign".
 *
 * Loading state stays minimal because the cosine round-trip is < 200ms
 * for cached embeddings; product JIT-embed adds ~300ms once. The UI
 * never spins for more than 1-2s in normal flow.
 *
 * "Save all to campaign" → redirects to /campaigns/new with a query
 * param carrying the matched KOL ids, so the form there can pre-link
 * them after the campaign row is created.
 */
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import {
  Button,
  Dialog,
  DialogBackdrop,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPortal,
  DialogTitle,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface ProductOption {
  id: string;
  name: string;
  category: string;
}

interface SmartMatchKolHit {
  id: string;
  displayName: string;
  handle: string;
  platform: string;
  avatarUrl: string | null;
  followerCount: number;
  countryCode: string | null;
  categories: string[];
  matchScore: number;
}

interface SmartMatchResponse {
  product: { id: string; name: string; category: string; embeddedJustInTime: boolean };
  results: SmartMatchKolHit[];
  durationMs: number;
}

interface Props {
  /** Tenant's products preloaded by the server component. */
  products: readonly ProductOption[];
  /** Locale for the redirect URL after "Save all to campaign". */
  locale: string;
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/** Tiny dependency-free ring-progress in pure SVG. */
function MatchRing({ score, label }: { score: number; label: string }): React.ReactNode {
  const r = 16;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - score / 100);
  const titleId = useId();
  return (
    <div
      className="relative h-12 w-12 shrink-0"
      role="img"
      aria-labelledby={titleId}
      data-testid="smart-match-ring"
      data-score={score}
    >
      <svg viewBox="0 0 40 40" className="h-12 w-12 -rotate-90">
        <title id={titleId}>{label}</title>
        <circle
          cx="20"
          cy="20"
          r={r}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          className="text-on-surface/15"
        />
        <circle
          cx="20"
          cy="20"
          r={r}
          stroke="currentColor"
          strokeWidth="3"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="text-cyan transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
        {score}
      </span>
    </div>
  );
}

export function SmartMatchDialog({ products, locale }: Props): React.ReactNode {
  const t = useTranslations("discovery.smartMatch");
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [productId, setProductId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<SmartMatchResponse | null>(null);

  const noProducts = products.length === 0;

  function reset(): void {
    setProductId("");
    setLoading(false);
    setError(null);
    setResponse(null);
  }

  async function runMatch(): Promise<void> {
    if (!productId) {
      setError(t("errors.pickProduct"));
      return;
    }
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const res = await fetch("/api/kols/smart-match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (data.error === "product_not_found") {
          setError(t("errors.productMissing"));
        } else if (data.error === "embedding_failed") {
          setError(t("errors.embeddingDown"));
        } else if (res.status === 401) {
          setError(t("errors.unauthorized"));
        } else {
          setError(t("errors.generic"));
        }
        return;
      }
      const data = (await res.json()) as SmartMatchResponse;
      setResponse(data);
    } catch {
      setError(t("errors.network"));
    } finally {
      setLoading(false);
    }
  }

  function saveAllToCampaign(): void {
    if (!response || response.results.length === 0) return;
    const ids = response.results.map((r) => r.id).join(",");
    const url =
      `/${locale}/campaigns/new?` +
      new URLSearchParams({
        productId: response.product.id,
        smartMatchKolIds: ids,
      }).toString();
    router.push(url);
  }

  return (
    <>
      <Button
        type="button"
        variant="primary-gradient"
        onClick={() => {
          reset();
          setOpen(true);
        }}
        disabled={noProducts}
        title={noProducts ? t("noProducts") : undefined}
        data-testid="ai-smart-match-button"
      >
        <span className="material-symbols-outlined text-[16px]" aria-hidden>
          auto_awesome
        </span>
        {t("button")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPanel
            className="w-[min(640px,90vw)]"
            data-testid="smart-match-dialog"
          >
            <DialogHeader>
              <DialogTitle>{t("title")}</DialogTitle>
              <p className="text-sm text-on-surface-variant">{t("subtitle")}</p>
            </DialogHeader>

            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-on-surface-variant">
                  {t("productLabel")}
                </span>
                <Select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  disabled={loading}
                  data-testid="smart-match-product-select"
                >
                  <option value="">{t("productPlaceholder")}</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.category}
                    </option>
                  ))}
                </Select>
              </label>

              {error ? (
                <p
                  className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-300"
                  data-testid="smart-match-error"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              {loading ? (
                <div
                  className="flex items-center gap-3 rounded-lg bg-cyan/10 px-3 py-3 text-sm text-cyan"
                  data-testid="smart-match-loading"
                >
                  <span
                    className="material-symbols-outlined animate-spin text-[18px]"
                    aria-hidden
                  >
                    progress_activity
                  </span>
                  {t("loading")}
                </div>
              ) : null}

              {response ? (
                <div className="space-y-3">
                  <div
                    className="flex items-center justify-between text-xs text-on-surface-variant"
                    data-testid="smart-match-meta"
                  >
                    <span>
                      {t("metaCount", { n: response.results.length })}
                    </span>
                    <span>
                      {t("metaLatency", { ms: response.durationMs })}
                    </span>
                  </div>
                  {response.results.length === 0 ? (
                    <p
                      className="rounded-lg border border-dashed border-on-surface/20 px-3 py-6 text-center text-sm text-on-surface-variant"
                      data-testid="smart-match-empty"
                    >
                      {t("empty")}
                    </p>
                  ) : (
                    <ul
                      className="max-h-[40vh] overflow-y-auto pr-1"
                      data-testid="smart-match-results"
                    >
                      {response.results.map((kol) => (
                        <li
                          key={kol.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg px-2 py-2",
                            "transition-colors hover:bg-on-surface/5"
                          )}
                          data-testid="smart-match-result-item"
                          data-kol-id={kol.id}
                        >
                          <MatchRing
                            score={kol.matchScore}
                            label={t("ringLabel", { score: kol.matchScore })}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-white">
                              {kol.displayName}
                            </p>
                            <p className="truncate text-xs text-on-surface-variant">
                              @{kol.handle} · {formatFollowers(kol.followerCount)}{" "}
                              {t("followers")}
                              {kol.countryCode ? ` · ${kol.countryCode}` : ""}
                            </p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                data-testid="smart-match-close"
              >
                {t("close")}
              </Button>
              {response && response.results.length > 0 ? (
                <Button
                  type="button"
                  variant="primary-gradient"
                  onClick={saveAllToCampaign}
                  data-testid="smart-match-save-all"
                >
                  {t("saveAllToCampaign")}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary-gradient"
                  onClick={runMatch}
                  disabled={loading || !productId}
                  data-testid="smart-match-run"
                >
                  {t("run")}
                </Button>
              )}
            </DialogFooter>
          </DialogPanel>
        </DialogPortal>
      </Dialog>
    </>
  );
}
