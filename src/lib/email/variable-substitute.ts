/**
 * BM2-F006 · Pure `{{token}}` substitution for email templates.
 *
 * Template tokens match the F002 seed catalogue:
 *   {{kol.name}} / {{kol.handle}} / {{product.name}} /
 *   {{product.category}} / {{product.usp}} / {{marketer.name}} / {{date}}
 *
 * Missing tokens collapse to empty string by default — the composer
 * preview UI can warn on unresolved tokens via the `missing` array.
 */

export interface SubstituteVariables {
  kol: { name: string; handle?: string | null };
  product: { name: string; category?: string | null; usp?: string | null };
  marketer: { name: string };
  /** BL-033-F002: ISO yyyy-mm-dd, e.g. "2026-05-04". Required so TS catches all callers. */
  date: string;
}

export interface SubstituteResult {
  text: string;
  missing: string[]; // tokens present in the template but undefined in variables
}

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function resolve(vars: SubstituteVariables, path: string): string | undefined {
  // Split on dots — supports up to 2 levels (kol.name, product.usp).
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = vars;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  if (cur == null) return undefined;
  return String(cur);
}

export function substitute(
  template: string,
  variables: SubstituteVariables
): SubstituteResult {
  const missing: string[] = [];
  const text = template.replace(TOKEN_RE, (_match, token: string) => {
    const v = resolve(variables, token);
    if (v === undefined || v === "") {
      if (!missing.includes(token)) missing.push(token);
      return "";
    }
    return v;
  });
  return { text, missing };
}

/**
 * Substitute subject + body in one pass, merging missing tokens.
 */
export function substituteSubjectAndBody(
  template: { subject: string; body: string },
  variables: SubstituteVariables
): { subject: string; body: string; missing: string[] } {
  const subj = substitute(template.subject, variables);
  const body = substitute(template.body, variables);
  const missing = Array.from(new Set([...subj.missing, ...body.missing]));
  return { subject: subj.text, body: body.text, missing };
}
