/**
 * BM2-F006 · Extract JSON from AI model output.
 *
 * Claude Haiku (via aigcgateway) frequently wraps structured output
 * in ```json ... ``` code fences despite explicit "raw JSON only"
 * system prompts. Gemini's responses are usually clean but not
 * guaranteed. This helper strips fences defensively so callers can
 * always `JSON.parse(stripCodeFence(output))`.
 *
 * Also pulled out of BM1-F003 generateAiAssets.ts inline logic so
 * F006 / F009 / F010 can reuse the same guard.
 */

/**
 * Peel any enclosing code fence (```json ... ``` or ``` ... ```) off
 * the supplied string. Leaves non-fenced content untouched.
 */
export function stripCodeFence(raw: string): string {
  const trimmed = raw.trim();
  // Match a leading fence with optional language tag and a trailing
  // fence. Non-greedy body so nested fences inside the payload (rare
  // but possible in markdown-ish content) don't eat past the close.
  const fenceRe = /^```(?:[a-z]+)?\s*\n([\s\S]*?)\n?```$/i;
  const m = trimmed.match(fenceRe);
  if (m && m[1] !== undefined) return m[1].trim();
  return trimmed;
}

/**
 * Convenience: strip + JSON.parse in one go. Throws a descriptive
 * error containing the original (truncated) payload so debugging a
 * failing model response is less painful.
 */
export function parseFencedJson<T = unknown>(raw: string): T {
  const stripped = stripCodeFence(raw);
  try {
    return JSON.parse(stripped) as T;
  } catch (err) {
    const preview = stripped.length > 200 ? `${stripped.slice(0, 200)}…` : stripped;
    throw new Error(
      `parseFencedJson: not valid JSON after fence strip. Got: "${preview}". Underlying error: ${(err as Error).message}`
    );
  }
}
