/**
 * BM2-F010 · AI Insights right-side panel (Planner adjudication
 * §13 #E:A — parse `## Key Insights` section into 3-5 colored cards).
 *
 * Tone heuristic: scans bullet text for keywords; defaults to "info"
 * when no keyword matches. The AI may emit "## Key Insights" bullets
 * like "*   **Scaling Efficiency:** ..." — we render the bold prefix
 * as the title and the rest as the body.
 */
import { WeeklyReportRenderer } from "./WeeklyReportRenderer";

interface Props {
  section: string | undefined;
  emptyLabel: string;
}

interface ParsedInsight {
  title: string;
  body: string;
  tone: "positive" | "warning" | "info";
}

const POSITIVE_KEYWORDS = [
  "growth",
  "high",
  "success",
  "win",
  "scaling",
  "efficiency",
  "increase",
  "exceed",
  "强势",
  "增长",
  "高",
];
const WARNING_KEYWORDS = [
  "warning",
  "risk",
  "underperform",
  "drop",
  "declin",
  "alert",
  "降",
  "风险",
  "下降",
];

function detectTone(text: string): ParsedInsight["tone"] {
  const lower = text.toLowerCase();
  if (WARNING_KEYWORDS.some((k) => lower.includes(k))) return "warning";
  if (POSITIVE_KEYWORDS.some((k) => lower.includes(k))) return "positive";
  return "info";
}

function parseSection(section: string): ParsedInsight[] {
  const bullets = section
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[*\-]\s+/.test(l));

  if (bullets.length === 0) return [];

  return bullets.slice(0, 5).map((line) => {
    const noLead = line.replace(/^[*\-]\s+/, "");
    const boldMatch = noLead.match(/^\*\*([^*]+)\*\*[:：]?\s*(.*)$/);
    if (boldMatch) {
      return {
        title: boldMatch[1].trim(),
        body: boldMatch[2].trim(),
        tone: detectTone(line),
      };
    }
    return { title: "", body: noLead, tone: detectTone(line) };
  });
}

function toneClasses(tone: ParsedInsight["tone"]): string {
  if (tone === "positive") {
    return "border-l-4 border-emerald-400 bg-white/5 text-emerald-50";
  }
  if (tone === "warning") {
    return "border-l-4 border-amber-400 bg-white/5 text-amber-50";
  }
  return "border-l-4 border-cyan bg-white/5 text-on-surface";
}

function toneIcon(tone: ParsedInsight["tone"]): string {
  if (tone === "positive") return "trending_up";
  if (tone === "warning") return "warning";
  return "lightbulb";
}

export function WeeklyReportInsightsPanel({ section, emptyLabel }: Props) {
  if (!section) {
    return (
      <article
        data-testid="weekly-report-insights-panel"
        className="rounded-2xl border border-white/5 bg-surface-low/60 p-6"
      >
        <p className="text-xs text-on-surface-variant">{emptyLabel}</p>
      </article>
    );
  }

  const items = parseSection(section);
  // Fallback: if we couldn't extract bullets cleanly, render the raw
  // markdown body inside the same container so the user still sees
  // the AI output (Planner §13.5 #2 spirit).
  if (items.length === 0) {
    return (
      <article
        data-testid="weekly-report-insights-panel"
        className="rounded-2xl border border-white/5 bg-surface-low/60 p-6"
      >
        <WeeklyReportRenderer markdown={section} />
      </article>
    );
  }

  return (
    <article
      data-testid="weekly-report-insights-panel"
      className="rounded-2xl border border-white/5 bg-surface-low/60 p-6"
    >
      <ul className="flex flex-col gap-3">
        {items.map((item, idx) => (
          <li
            key={idx}
            className={`rounded-xl px-4 py-3 ${toneClasses(item.tone)}`}
          >
            <div className="flex items-start gap-2">
              <span
                aria-hidden
                className="material-symbols-outlined mt-0.5 text-[18px]"
              >
                {toneIcon(item.tone)}
              </span>
              <div className="min-w-0 flex-1">
                {item.title ? (
                  <p className="text-sm font-bold">{item.title}</p>
                ) : null}
                <p className="mt-0.5 text-xs leading-relaxed">{item.body}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </article>
  );
}
