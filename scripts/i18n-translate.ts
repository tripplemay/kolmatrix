/**
 * MVP-i18n-full-locale F001 · UI string translator.
 *
 * Walks `messages/en.json`, finds leaves that are still untranslated in
 * the target locale (leaf value === en value), groups them by top-level
 * section, calls the `ui-i18n-translate-{doubao,gemini}` aigcgateway
 * Action to translate each section, validates that every {placeholder}
 * and HTML tag is preserved, and writes the merged JSON back to
 * `messages/{locale}.json`.
 *
 * Usage:
 *   npm run i18n:translate -- --target zh
 *   npm run i18n:translate:dry -- --target ja
 *   npm run i18n:translate -- --target es --section dashboard
 *
 * Flags:
 *   --target zh|ja|ko|es  required
 *   --section <name>      optional; only translate that top-level section
 *   --dry-run             skip the network call; print the diff plan
 *   --max-leaves N        cap leaves per section; useful for smoke runs
 *
 * Model routing:
 *   zh / ja / ko → ui-i18n-translate-doubao  (doubao-pro, $0.082 in / $0.329 out)
 *   es           → ui-i18n-translate-gemini  (gemini-2.5-flash-lite, $0.12 in / $0.48 out)
 *
 * Output:
 *   - in-place edit of messages/{locale}.json (merged)
 *   - diff report at docs/i18n/translate-report-{date}-{locale}.md
 */
import "dotenv/config";

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const ACTION_DOUBAO = "cmogjcqsg0001bnrbq3r7c4o6";
const ACTION_GEMINI = "cmogjd1cl020tbnqwicf8rgvh";

const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  "doubao-pro": { input: 0.082192, output: 0.328767 },
  "gemini-2.5-flash-lite": { input: 0.12, output: 0.48 },
};

type Locale = "zh" | "ja" | "ko" | "es";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [k: string]: JsonValue };

export type JsonObject = { [k: string]: JsonValue };

export interface CliArgs {
  target: Locale;
  section?: string;
  dryRun: boolean;
  maxLeaves?: number;
}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { target: "" as Locale, dryRun: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]!;
    if (a === "--target") {
      const v = argv[++i] ?? "";
      if (!isLocale(v)) throw new Error(`--target must be one of zh|ja|ko|es, got "${v}"`);
      args.target = v;
    } else if (a === "--section") {
      args.section = argv[++i] ?? "";
    } else if (a === "--dry-run") {
      args.dryRun = true;
    } else if (a === "--max-leaves") {
      const n = Number(argv[++i]);
      if (!Number.isFinite(n) || n < 1) throw new Error(`--max-leaves must be a positive integer`);
      args.maxLeaves = n;
    }
  }
  if (!args.target) {
    throw new Error("missing --target zh|ja|ko|es");
  }
  return args;
}

function isLocale(v: string): v is Locale {
  return v === "zh" || v === "ja" || v === "ko" || v === "es";
}

export function actionForLocale(locale: Locale): { id: string; model: string } {
  if (locale === "es") {
    return { id: ACTION_GEMINI, model: "gemini-2.5-flash-lite" };
  }
  return { id: ACTION_DOUBAO, model: "doubao-pro" };
}

// ---------------------------------------------------------------------
// Tree walking + diff
// ---------------------------------------------------------------------

export interface Leaf {
  path: (string | number)[];
  value: string;
}

export function* walkLeaves(obj: JsonValue, path: (string | number)[] = []): Generator<Leaf> {
  if (typeof obj === "string") {
    yield { path, value: obj };
    return;
  }
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      yield* walkLeaves(obj[i]!, [...path, i]);
    }
    return;
  }
  if (obj !== null && typeof obj === "object") {
    for (const k of Object.keys(obj)) {
      yield* walkLeaves(obj[k]!, [...path, k]);
    }
  }
}

export function getAtPath(
  obj: JsonValue,
  path: (string | number)[]
): JsonValue | undefined {
  let cur: JsonValue | undefined = obj;
  for (const k of path) {
    if (cur == null || typeof cur !== "object") return undefined;
    if (Array.isArray(cur)) {
      cur = cur[k as number];
    } else {
      cur = (cur as JsonObject)[k as string];
    }
  }
  return cur;
}

export function setAtPath(
  obj: JsonObject,
  path: (string | number)[],
  value: JsonValue
): void {
  let cur: JsonValue = obj;
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]!;
    const nextKey = path[i + 1]!;
    if (cur == null || typeof cur !== "object") {
      throw new Error(`setAtPath: hit non-object at ${path.slice(0, i).join(".")}`);
    }
    if (Array.isArray(cur)) {
      const idx = key as number;
      if (cur[idx] == null || typeof cur[idx] !== "object") {
        cur[idx] = typeof nextKey === "number" ? [] : {};
      }
      cur = cur[idx] as JsonValue;
    } else {
      const k = key as string;
      const next = (cur as JsonObject)[k];
      if (next == null || typeof next !== "object") {
        (cur as JsonObject)[k] = typeof nextKey === "number" ? [] : {};
      }
      cur = (cur as JsonObject)[k] as JsonValue;
    }
  }
  const last = path[path.length - 1]!;
  if (Array.isArray(cur)) {
    cur[last as number] = value;
  } else if (cur != null && typeof cur === "object") {
    (cur as JsonObject)[last as string] = value;
  }
}

/**
 * Find leaves where the target locale's value still equals the en
 * source value (i.e. never translated). Skips numeric/boolean/null
 * leaves and skips strings shorter than 3 characters (likely tokens).
 */
export function findUntranslated(
  en: JsonObject,
  target: JsonObject,
  topLevelSection?: string
): Leaf[] {
  const out: Leaf[] = [];
  for (const leaf of walkLeaves(en)) {
    if (topLevelSection && leaf.path[0] !== topLevelSection) continue;
    if (leaf.value.length < 3) continue;
    const tv = getAtPath(target, leaf.path);
    if (tv === leaf.value || tv === undefined) {
      out.push(leaf);
    }
  }
  return out;
}

// ---------------------------------------------------------------------
// Placeholder + HTML tag preservation validation
// ---------------------------------------------------------------------

const PLACEHOLDER_RE = /\{[a-zA-Z_][a-zA-Z0-9_]*[^}]*\}/g;
const HTML_TAG_RE = /<\/?[a-zA-Z][a-zA-Z0-9-]*(?:\s+[^<>]*)?\/?>/g;

export function extractTokens(s: string): { placeholders: string[]; tags: string[] } {
  return {
    placeholders: (s.match(PLACEHOLDER_RE) ?? []).slice().sort(),
    tags: (s.match(HTML_TAG_RE) ?? []).slice().sort(),
  };
}

export function validateTokenPreservation(
  source: string,
  translated: string
): { ok: true } | { ok: false; reason: string } {
  const src = extractTokens(source);
  const tgt = extractTokens(translated);
  if (JSON.stringify(src.placeholders) !== JSON.stringify(tgt.placeholders)) {
    return {
      ok: false,
      reason: `placeholder mismatch: source=${JSON.stringify(src.placeholders)} translated=${JSON.stringify(tgt.placeholders)}`,
    };
  }
  if (JSON.stringify(src.tags) !== JSON.stringify(tgt.tags)) {
    return {
      ok: false,
      reason: `HTML tag mismatch: source=${JSON.stringify(src.tags)} translated=${JSON.stringify(tgt.tags)}`,
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------
// Section bundling — group untranslated leaves into a JSON subtree the
// model can translate in one call. Keeps nested structure for context.
// ---------------------------------------------------------------------

interface SectionBundle {
  section: string;
  leaves: Leaf[];
  /** Nested JSON subtree of just the untranslated leaves. */
  payload: JsonObject;
}

export function buildSectionBundles(
  en: JsonObject,
  untranslated: Leaf[],
  maxLeavesPerBundle = 200
): SectionBundle[] {
  const bySection = new Map<string, Leaf[]>();
  for (const leaf of untranslated) {
    const key = String(leaf.path[0]);
    if (!bySection.has(key)) bySection.set(key, []);
    bySection.get(key)!.push(leaf);
  }
  const bundles: SectionBundle[] = [];
  for (const [section, leaves] of bySection) {
    // Slice into chunks if section is huge.
    for (let i = 0; i < leaves.length; i += maxLeavesPerBundle) {
      const slice = leaves.slice(i, i + maxLeavesPerBundle);
      const payload: JsonObject = {};
      for (const leaf of slice) {
        // Strip the leading section key from the path so the payload
        // root is the section itself (no double-nesting).
        setAtPath(payload, leaf.path.slice(1), leaf.value);
      }
      bundles.push({ section, leaves: slice, payload: { [section]: payload } });
    }
  }
  return bundles;
}

// ---------------------------------------------------------------------
// aigcgateway client
// ---------------------------------------------------------------------

interface RunActionResponse {
  output?: string;
  traceId?: string;
  usage?: { prompt_tokens?: number; output_tokens?: number; total_tokens?: number };
}

export async function callTranslator(
  actionId: string,
  variables: { source_text: string; target_lang: string; context: string; glossary: string },
  opts: { dryRun?: boolean; timeout?: number } = {}
): Promise<RunActionResponse> {
  const apiKey = process.env.AIGCGATEWAY_API_KEY;
  if (!apiKey) throw new Error("AIGCGATEWAY_API_KEY is not set");
  // Local .env points AIGCGATEWAY_BASE_URL at http://localhost:4000
  // (where no service runs); override that stub here so the script
  // doesn't need a manual env shadow on dev machines. Set
  // I18N_TRANSLATE_USE_LOCAL_GATEWAY=1 to honour the .env value.
  const useLocal = process.env.I18N_TRANSLATE_USE_LOCAL_GATEWAY === "1";
  const baseUrl = (
    useLocal
      ? (process.env.AIGCGATEWAY_BASE_URL ?? "https://aigc.guangai.ai/v1")
      : "https://aigc.guangai.ai/v1"
  ).replace(/\/$/, "");
  // aigcgateway exposes action runs at POST /v1/actions/run with the
  // action_id in the request body (not as a path segment). Same shape
  // the MCP `run_action` tool uses.
  const url = `${baseUrl}/actions/run`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeout ?? 90_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        action_id: actionId,
        variables,
        dry_run: !!opts.dryRun,
        // Default endpoint behaviour is SSE streaming. Force the
        // single-JSON variant since the script post-processes a
        // structured object, not a token-by-token feed.
        stream: false,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`aigcgateway responded ${res.status}: ${txt.slice(0, 200)}`);
    }
    return (await res.json()) as RunActionResponse;
  } catch (err) {
    if (err instanceof Error) {
      const cause = (err as Error & { cause?: unknown }).cause;
      throw new Error(
        `${err.message}${cause ? ` (cause: ${String(cause)})` : ""}`
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------
// JSON parse — strip optional ```json ... ``` fences before parsing.
// ---------------------------------------------------------------------

export function parseModelJson<T = unknown>(raw: string): T {
  const trimmed = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  const body = fence ? fence[1]! : trimmed;
  return JSON.parse(body) as T;
}

// ---------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------

interface BundleResult {
  section: string;
  leafCount: number;
  applied: number;
  skipped: { path: string; reason: string }[];
  promptTokens: number;
  outputTokens: number;
}

async function runBundle(
  bundle: SectionBundle,
  target: Locale,
  glossary: string,
  dryRun: boolean
): Promise<BundleResult> {
  const action = actionForLocale(target);
  const variables = {
    source_text: JSON.stringify(bundle.payload, null, 2),
    target_lang: target,
    context: `KOLMatrix UI section: ${bundle.section}`,
    glossary,
  };
  const result: BundleResult = {
    section: bundle.section,
    leafCount: bundle.leaves.length,
    applied: 0,
    skipped: [],
    promptTokens: 0,
    outputTokens: 0,
  };
  if (dryRun) {
    // Estimate cost: prompt ≈ source_text.length / 3 tokens.
    result.promptTokens = Math.ceil(variables.source_text.length / 3);
    result.outputTokens = Math.ceil(variables.source_text.length / 3);
    return result;
  }
  const res = await callTranslator(action.id, variables);
  result.promptTokens = res.usage?.prompt_tokens ?? 0;
  result.outputTokens = res.usage?.output_tokens ?? 0;
  if (!res.output) {
    throw new Error(`section ${bundle.section}: missing output`);
  }
  let translated: JsonObject;
  try {
    translated = parseModelJson<JsonObject>(res.output);
  } catch (err) {
    throw new Error(
      `section ${bundle.section}: model output not parseable JSON: ${(err as Error).message}\n--- raw ---\n${res.output.slice(0, 400)}\n--- end ---`
    );
  }
  // Walk back and merge each leaf, validating tokens.
  for (const leaf of bundle.leaves) {
    const tv = getAtPath(translated, leaf.path);
    if (typeof tv !== "string") {
      result.skipped.push({
        path: leaf.path.join("."),
        reason: `model omitted this leaf or returned non-string`,
      });
      continue;
    }
    const check = validateTokenPreservation(leaf.value, tv);
    if (!check.ok) {
      result.skipped.push({ path: leaf.path.join("."), reason: check.reason });
      continue;
    }
    bundle.payload = mergePayload(bundle.payload, leaf.path, tv);
    result.applied += 1;
  }
  return result;
}

function mergePayload(payload: JsonObject, path: (string | number)[], value: string): JsonObject {
  setAtPath(payload, path, value);
  return payload;
}

interface RunReport {
  locale: Locale;
  totalUntranslated: number;
  totalApplied: number;
  totalSkipped: number;
  bundles: BundleResult[];
  estimatedCostUsd: number;
}

export async function runTranslate(args: CliArgs): Promise<RunReport> {
  const repoRoot = resolve(__dirname, "..");
  const enPath = resolve(repoRoot, "messages/en.json");
  const targetPath = resolve(repoRoot, `messages/${args.target}.json`);
  const glossaryPath = resolve(repoRoot, "docs/i18n/brand-glossary.json");

  const en = JSON.parse(readFileSync(enPath, "utf8")) as JsonObject;
  const target = JSON.parse(readFileSync(targetPath, "utf8")) as JsonObject;
  const glossaryText = readFileSync(glossaryPath, "utf8");

  let untranslated = findUntranslated(en, target, args.section);
  if (args.maxLeaves != null && args.maxLeaves > 0) {
    untranslated = untranslated.slice(0, args.maxLeaves);
  }
  const bundles = buildSectionBundles(en, untranslated);

  const action = actionForLocale(args.target);
  console.log(
    `[i18n-translate] target=${args.target} action=${action.id} model=${action.model}`
  );
  console.log(
    `[i18n-translate] untranslated leaves: ${untranslated.length} across ${bundles.length} section bundle(s)`
  );
  for (const b of bundles) {
    console.log(`  · ${b.section} → ${b.leaves.length} leaves`);
  }
  if (untranslated.length === 0) {
    console.log("[i18n-translate] nothing to translate. exiting.");
    return {
      locale: args.target,
      totalUntranslated: 0,
      totalApplied: 0,
      totalSkipped: 0,
      bundles: [],
      estimatedCostUsd: 0,
    };
  }

  const report: RunReport = {
    locale: args.target,
    totalUntranslated: untranslated.length,
    totalApplied: 0,
    totalSkipped: 0,
    bundles: [],
    estimatedCostUsd: 0,
  };

  for (const bundle of bundles) {
    const result = await runBundle(bundle, args.target, glossaryText, args.dryRun);
    report.bundles.push(result);
    report.totalApplied += result.applied;
    report.totalSkipped += result.skipped.length;
    if (!args.dryRun) {
      // Merge translated leaves into target locale tree.
      const sectionPayload = bundle.payload[bundle.section] as JsonObject;
      for (const leaf of bundle.leaves) {
        if (result.skipped.some((s) => s.path === leaf.path.join("."))) continue;
        const translated = getAtPath({ [bundle.section]: sectionPayload }, leaf.path);
        if (typeof translated === "string") {
          setAtPath(target, leaf.path, translated);
        }
      }
    }
  }

  // Cost estimate
  const pricing = MODEL_PRICING[action.model]!;
  const totalIn = report.bundles.reduce((s, b) => s + b.promptTokens, 0);
  const totalOut = report.bundles.reduce((s, b) => s + b.outputTokens, 0);
  report.estimatedCostUsd =
    (totalIn / 1_000_000) * pricing.input + (totalOut / 1_000_000) * pricing.output;

  if (!args.dryRun) {
    writeFileSync(targetPath, JSON.stringify(target, null, 2) + "\n", "utf8");
  }

  // Diff report
  const reportPath = resolve(
    repoRoot,
    `docs/i18n/translate-report-${todayUtc()}-${args.target}.md`
  );
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, formatReportMarkdown(report, args), "utf8");
  console.log(`\n[i18n-translate] applied=${report.totalApplied} skipped=${report.totalSkipped}`);
  console.log(
    `[i18n-translate] tokens in=${totalIn} out=${totalOut} estimated cost=$${report.estimatedCostUsd.toFixed(4)}`
  );
  console.log(`[i18n-translate] report → ${reportPath}`);
  if (args.dryRun) {
    console.log(`[i18n-translate] DRY-RUN (no writes, no API calls)`);
  }

  return report;
}

function todayUtc(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

function formatReportMarkdown(report: RunReport, args: CliArgs): string {
  const lines: string[] = [];
  lines.push(`# i18n translate report — ${report.locale}`);
  lines.push("");
  lines.push(`- Date: ${todayUtc()}`);
  lines.push(`- Target: ${report.locale}`);
  lines.push(`- Model: ${actionForLocale(report.locale).model}`);
  lines.push(`- Mode: ${args.dryRun ? "dry-run" : "live"}`);
  lines.push(`- Untranslated leaves: ${report.totalUntranslated}`);
  lines.push(`- Applied: ${report.totalApplied}`);
  lines.push(`- Skipped: ${report.totalSkipped}`);
  lines.push(`- Estimated cost: $${report.estimatedCostUsd.toFixed(4)}`);
  lines.push("");
  lines.push("## Per-section breakdown");
  lines.push("");
  lines.push("| Section | Leaves | Applied | Skipped | Prompt tok | Output tok |");
  lines.push("|---|---:|---:|---:|---:|---:|");
  for (const b of report.bundles) {
    lines.push(
      `| ${b.section} | ${b.leafCount} | ${b.applied} | ${b.skipped.length} | ${b.promptTokens} | ${b.outputTokens} |`
    );
  }
  if (report.totalSkipped > 0) {
    lines.push("");
    lines.push("## Skipped leaves (placeholder / tag mismatch)");
    lines.push("");
    for (const b of report.bundles) {
      for (const s of b.skipped) {
        lines.push(`- \`${b.section}.${s.path}\` — ${s.reason}`);
      }
    }
  }
  lines.push("");
  return lines.join("\n");
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  runTranslate(args).catch((err) => {
    console.error("[i18n-translate] fatal:", err.message);
    process.exitCode = 1;
  });
}
