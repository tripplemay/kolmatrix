/**
 * BL-084-F005 · Shared constants / types for the accept/skip/swap/undo
 * suggestion actions. Separate from the "use server" module because a
 * "use server" file may only export async functions (generator.md §14).
 */

/** Undo window — a decision can be reverted within this many ms. */
export const UNDO_WINDOW_MS = 5_000;

/** suggestion_status values written by the decision actions. */
export type SuggestionDecision = "accepted" | "skipped" | "swap_pool";

export type SuggestionActionError =
  | "unauthorized"
  | "validation_failed"
  | "not_found"
  | "undo_expired"
  | "internal_error";

export type DecisionActionResult =
  | { ok: true; decisionId: string; undoExpiresAt: string }
  | { ok: false; error: SuggestionActionError };

export type UndoActionResult =
  | { ok: true; kolId: string; campaignId: string }
  | { ok: false; error: SuggestionActionError };

export type ReAddActionResult =
  | { ok: true }
  | { ok: false; error: SuggestionActionError };
