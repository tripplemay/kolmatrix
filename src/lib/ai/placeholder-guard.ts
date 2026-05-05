/**
 * BL-034 F006 · Bracket-placeholder validator (shared).
 *
 * AI-generated email / video copy is post-processed by a Mustache
 * substitution layer that recognises `{{kol.name}}`-style tokens. When
 * the model regresses to bracketed `[Creator Name]` placeholders the
 * substitution layer can't replace them and the raw bracket text reaches
 * end recipients (BL-032 / BM2 incidents). This guard rejects AI output
 * that contains uppercase-led bracket placeholders so callers can retry
 * once or surface AiPlaceholderViolationError.
 *
 * Previously this lived locally in
 * `src/lib/products/generateAiAssets.ts:111`. Lift to the shared module
 * so single-asset regeneration paths (email-generator.ts /
 * video-script-generator.ts) can attach the same check (BL-034 audit
 * AI-H5).
 */

/** Kept here so re-importers do not need to grep the legacy location. */
export class AiPlaceholderViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiPlaceholderViolationError";
  }
}

// Spec §D3 — only flag uppercase-led bracket strings. Lower/Title-case
// brackets like [press release] are legitimate marketing prose.
const BRACKET_RE = /\[[A-Z][a-zA-Z ]+\]/g;
// Mustache tokens are always lowercase (per the prompt + seed catalogue:
// {{kol.name}}, {{product.usp}}, {{marketer.name}}, {{date}}).
const MUSTACHE_RE = /\{\{[a-z][a-zA-Z0-9_.]+\}\}/g;

export interface PlaceholderGuardOpts {
  /**
   * BL-033 BL-034 F006 — the bulk generator (`generateAiAssets.ts`) was
   * historically permissive: a segment that mixes `[Press Release]`
   * marketing prose with a real `{{kol.name}}` token is intentional and
   * must NOT throw. Setting this flag preserves that behavior — brackets
   * only fail when the same segment carries no Mustache tokens at all.
   * Single-asset regen paths (email-generator.ts /
   * video-script-generator.ts) leave the flag off so any bracket throws.
   */
  allowIfMustache?: boolean;
}

/**
 * Inspect the supplied subject / body / html fields. Throw
 * AiPlaceholderViolationError on the first field that contains an
 * uppercase-led bracket token (subject to `allowIfMustache`). Empty /
 * undefined fields are skipped.
 */
export function validateNoBracketPlaceholders(
  content: {
    subject?: string | null;
    body?: string | null;
    html?: string | null;
  },
  opts: PlaceholderGuardOpts = {},
): void {
  const fields = [content.subject, content.body, content.html].filter(
    (x): x is string => typeof x === "string" && x.length > 0,
  );
  for (const text of fields) {
    const brackets = text.match(BRACKET_RE);
    if (!brackets || brackets.length === 0) continue;
    if (opts.allowIfMustache) {
      const mustaches = text.match(MUSTACHE_RE);
      if (mustaches && mustaches.length > 0) continue;
    }
    const sample = brackets.slice(0, 3).map((b) => JSON.stringify(b)).join(", ");
    throw new AiPlaceholderViolationError(
      `AI output uses bracket placeholders ${sample} — expected Mustache tokens like {{kol.name}} (prompt regression)`,
    );
  }
}
