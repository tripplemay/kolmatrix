"use client";

/**
 * BL-084-F006 · AI Match Panel — client interactivity layer.
 *
 * Renders the 3-column workbench (推荐池 / 已接受 / 候补池) and owns all
 * interactions: Accept (optimistic + 5s Undo toast), Skip, Swap, Re-add,
 * native drag between the suggested ↔ swap columns, manual Refresh
 * (force=true), and the BL-067 "Why" detailed-explanation dialog.
 *
 * Data is seeded server-side by MatchAiPanel; this component keeps the
 * three columns in local state and mutates them optimistically while the
 * server action runs in a transition.
 */
import { useCallback, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { DetailedExplanationDialog } from "@/app/[locale]/(app)/campaigns/[id]/DetailedExplanationDialog";
import type { DetailedExplanationLabels } from "@/app/[locale]/(app)/campaigns/[id]/DetailedExplanationDialog";

import { getCampaignSuggestions } from "./server-actions/get-campaign-suggestions";
import {
  acceptKolToCampaign,
  reAddToSuggested,
  removeKolFromCampaign,
  skipKolFromCampaign,
  swapKolToSwapPool,
  undoLastDecision,
} from "./server-actions/suggestion-actions";
import { MatchAiKolCard, type PanelCard } from "./MatchAiKolCard";

type ColumnId = "suggested" | "accepted" | "swap";

interface PendingUndo {
  decisionId: string;
  card: PanelCard;
  expiresAtMs: number;
}

interface Props {
  campaignId: string;
  locale: string;
  initialSuggested: PanelCard[];
  initialAccepted: PanelCard[];
  initialSwap: PanelCard[];
  generatedAt: string | null;
  rerankFallback: boolean;
  dialogLabels: DetailedExplanationLabels;
}

function hoursAgo(iso: string | null): number | null {
  if (!iso) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  return Math.max(0, Math.floor((Date.now() - ms) / (60 * 60 * 1000)));
}

export function MatchAiPanelClient({
  campaignId,
  locale,
  initialSuggested,
  initialAccepted,
  initialSwap,
  generatedAt,
  rerankFallback,
  dialogLabels,
}: Props) {
  const t = useTranslations("match.aiPanel");

  const [suggested, setSuggested] = useState<PanelCard[]>(initialSuggested);
  const [accepted, setAccepted] = useState<PanelCard[]>(initialAccepted);
  const [swap, setSwap] = useState<PanelCard[]>(initialSwap);
  const [generated, setGenerated] = useState<string | null>(generatedAt);
  const [fallback, setFallback] = useState(rerankFallback);
  const [pendingUndo, setPendingUndo] = useState<PendingUndo | null>(null);
  const [whyKol, setWhyKol] = useState<PanelCard | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const staleHours = useMemo(() => hoursAgo(generated), [generated]);

  const removeFrom = useCallback(
    (setter: typeof setSuggested, id: string) =>
      setter((prev) => prev.filter((c) => c.id !== id)),
    [],
  );

  const handleAccept = useCallback(
    (card: PanelCard) => {
      // Optimistic: suggested → accepted.
      removeFrom(setSuggested, card.id);
      setAccepted((prev) => [card, ...prev]);
      void acceptKolToCampaign(card.id, campaignId).then((res) => {
        if (res.ok) {
          setPendingUndo({
            decisionId: res.decisionId,
            card,
            expiresAtMs: Date.parse(res.undoExpiresAt),
          });
          // Auto-dismiss the toast when the window closes.
          const ms = Date.parse(res.undoExpiresAt) - Date.now();
          window.setTimeout(() => {
            setPendingUndo((cur) =>
              cur && cur.decisionId === res.decisionId ? null : cur,
            );
          }, Math.max(0, ms));
        } else {
          // Roll back optimistic move on failure.
          setAccepted((prev) => prev.filter((c) => c.id !== card.id));
          setSuggested((prev) => [card, ...prev]);
        }
      });
    },
    [campaignId, removeFrom],
  );

  const handleUndo = useCallback(() => {
    if (!pendingUndo) return;
    const { decisionId, card } = pendingUndo;
    setPendingUndo(null);
    // Optimistic: accepted → suggested.
    setAccepted((prev) => prev.filter((c) => c.id !== card.id));
    setSuggested((prev) => [card, ...prev]);
    void undoLastDecision(decisionId).then((res) => {
      if (!res.ok) {
        // Undo expired/failed server-side: put it back in accepted.
        setSuggested((prev) => prev.filter((c) => c.id !== card.id));
        setAccepted((prev) => [card, ...prev]);
      }
    });
  }, [pendingUndo]);

  const handleSkip = useCallback(
    (card: PanelCard) => {
      removeFrom(setSuggested, card.id);
      void skipKolFromCampaign(card.id, campaignId).then((res) => {
        if (!res.ok) setSuggested((prev) => [card, ...prev]);
      });
    },
    [campaignId, removeFrom],
  );

  const handleSwap = useCallback(
    (card: PanelCard) => {
      removeFrom(setSuggested, card.id);
      setSwap((prev) => [card, ...prev]);
      void swapKolToSwapPool(card.id, campaignId).then((res) => {
        if (!res.ok) {
          setSwap((prev) => prev.filter((c) => c.id !== card.id));
          setSuggested((prev) => [card, ...prev]);
        }
      });
    },
    [campaignId, removeFrom],
  );

  const handleRemove = useCallback(
    (card: PanelCard) => {
      removeFrom(setAccepted, card.id);
      setSuggested((prev) => [card, ...prev]);
      void removeKolFromCampaign(card.id, campaignId).then((res) => {
        if (!res.ok) {
          setSuggested((prev) => prev.filter((c) => c.id !== card.id));
          setAccepted((prev) => [card, ...prev]);
        }
      });
    },
    [campaignId, removeFrom],
  );

  const handleReAdd = useCallback(
    (card: PanelCard) => {
      removeFrom(setSwap, card.id);
      setSuggested((prev) => [card, ...prev]);
      void reAddToSuggested(card.id, campaignId).then((res) => {
        if (!res.ok) {
          setSuggested((prev) => prev.filter((c) => c.id !== card.id));
          setSwap((prev) => [card, ...prev]);
        }
      });
    },
    [campaignId, removeFrom],
  );

  const handleRefresh = useCallback(() => {
    startRefresh(async () => {
      const res = await getCampaignSuggestions({ campaignId, force: true });
      if (res.ok) {
        setSuggested(
          res.data.suggestions.map((s) => ({
            id: s.id,
            displayName: s.displayName,
            handle: s.handle,
            platform: s.platform,
            avatarUrl: s.avatarUrl,
            followerCount: s.followerCount,
            countryCode: s.countryCode,
            categories: s.categories,
            matchScore: s.matchScore,
            matchReason: s.matchReason,
          })),
        );
        setGenerated(res.data.generatedAt);
        setFallback(res.data.rerankFallback);
      }
    });
  }, [campaignId]);

  // Native drag-and-drop between suggested ↔ swap.
  const onDropTo = useCallback(
    (target: ColumnId, e: React.DragEvent) => {
      e.preventDefault();
      const id = e.dataTransfer.getData("text/kol-id");
      const from = e.dataTransfer.getData("text/from") as ColumnId;
      if (!id || from === target) return;
      if (from === "suggested" && target === "swap") {
        const card = suggested.find((c) => c.id === id);
        if (card) handleSwap(card);
      } else if (from === "swap" && target === "suggested") {
        const card = swap.find((c) => c.id === id);
        if (card) handleReAdd(card);
      }
    },
    [suggested, swap, handleSwap, handleReAdd],
  );

  return (
    <div data-testid="match-ai-panel" className="flex flex-col gap-4">
      {/* Header: refresh + freshness hint + fallback warning */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">{t("title")}</h2>
        <div className="flex items-center gap-3 text-xs text-on-surface-variant">
          {staleHours != null ? (
            <span data-testid="cache-stale-hint">
              {t("cacheStaleHint", { hours: staleHours })}
            </span>
          ) : null}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            data-testid="refresh-button"
            className="rounded-lg border border-cyan/30 px-3 py-1.5 font-medium text-cyan disabled:opacity-50"
          >
            {isRefreshing ? t("refreshing") : t("refreshButton")}
          </button>
        </div>
      </div>

      {fallback ? (
        <p
          data-testid="rerank-fallback-warning"
          className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-300"
        >
          {t("rerankFallbackWarning")}
        </p>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Column
          columnId="suggested"
          title={t("suggestedColumn")}
          count={suggested.length}
          emptyLabel={t("emptyStateSuggested")}
          cards={suggested}
          onDrop={(e) => onDropTo("suggested", e)}
        >
          {suggested.map((card) => (
            <MatchAiKolCard
              key={card.id}
              card={card}
              mode="suggested"
              onAccept={() => handleAccept(card)}
              onSkip={() => handleSkip(card)}
              onSwap={() => handleSwap(card)}
              onWhy={() => setWhyKol(card)}
            />
          ))}
        </Column>

        <Column
          columnId="accepted"
          title={t("acceptedColumn")}
          count={accepted.length}
          emptyLabel={t("emptyStateAccepted")}
          cards={accepted}
        >
          {accepted.map((card) => (
            <MatchAiKolCard
              key={card.id}
              card={card}
              mode="accepted"
              onRemove={() => handleRemove(card)}
            />
          ))}
        </Column>

        <Column
          columnId="swap"
          title={t("swapColumn")}
          count={swap.length}
          emptyLabel={t("emptyStateSwap")}
          cards={swap}
          onDrop={(e) => onDropTo("swap", e)}
        >
          {swap.map((card) => (
            <MatchAiKolCard
              key={card.id}
              card={card}
              mode="swap"
              onReAdd={() => handleReAdd(card)}
            />
          ))}
        </Column>
      </div>

      {/* 5s Undo toast (bottom-right) */}
      {pendingUndo ? (
        <div
          data-testid="undo-toast"
          className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl border border-white/10 bg-navy-base px-4 py-3 shadow-lg"
        >
          <span className="text-sm text-white">
            {t("undoToast", { name: pendingUndo.card.displayName })}
          </span>
          <button
            type="button"
            onClick={handleUndo}
            data-testid="undo-button"
            className="rounded-lg bg-cyan px-3 py-1 text-sm font-semibold text-navy-base"
          >
            {t("undoCta")}
          </button>
        </div>
      ) : null}

      {whyKol ? (
        <DetailedExplanationDialog
          open={whyKol !== null}
          onClose={() => setWhyKol(null)}
          kolId={whyKol.id}
          campaignId={campaignId}
          kolHandle={whyKol.handle}
          locale={locale}
          labels={dialogLabels}
        />
      ) : null}
    </div>
  );
}

function Column({
  columnId,
  title,
  count,
  emptyLabel,
  cards,
  onDrop,
  children,
}: {
  columnId: ColumnId;
  title: string;
  count: number;
  emptyLabel: string;
  cards: PanelCard[];
  onDrop?: (e: React.DragEvent) => void;
  children: React.ReactNode;
}) {
  return (
    <section
      data-testid={`column-${columnId}`}
      data-count={count}
      onDragOver={onDrop ? (e) => e.preventDefault() : undefined}
      onDrop={onDrop}
      className="flex flex-col gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-4"
    >
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <span className="rounded-full bg-surface-high px-2 py-0.5 text-xs text-on-surface-variant">
          {count}
        </span>
      </header>
      {cards.length === 0 ? (
        <p className="py-8 text-center text-xs text-on-surface-variant/70">
          {emptyLabel}
        </p>
      ) : (
        <div className="flex flex-col gap-3">{children}</div>
      )}
    </section>
  );
}
