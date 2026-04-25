/**
 * BM2-F010 · Pure helper to slice an AI weekly-report markdown blob
 * into per-H2 sections (per Planner adjudication §13.2 sample).
 *
 * Strategy: walk the markdown line-by-line; treat any line matching
 * /^##\s+(.+)$/ as a section boundary. Content before the first H2
 * lands under the "_preamble" key (rare in practice — AI output
 * starts with ## immediately).
 *
 * Trims surrounding whitespace; leaves intra-section formatting
 * (bullets, bold, links) untouched for react-markdown to consume.
 */

export const PREAMBLE_KEY = "_preamble";

export function splitByH2(markdown: string): Record<string, string> {
  const sections: Record<string, string> = {};
  if (!markdown) return sections;

  const lines = markdown.split("\n");
  let currentKey = PREAMBLE_KEY;
  let buffer: string[] = [];

  const flush = () => {
    const joined = buffer.join("\n").trim();
    if (joined.length > 0) {
      sections[currentKey] = joined;
    }
  };

  for (const line of lines) {
    const m = line.match(/^##\s+(.+?)\s*$/);
    if (m) {
      flush();
      currentKey = m[1].trim();
      buffer = [];
    } else {
      buffer.push(line);
    }
  }
  flush();
  return sections;
}

/**
 * Convenience: returns the section text for `heading` if present,
 * otherwise undefined. Lookup is exact (case-sensitive) to match
 * Planner §13.2 contract.
 */
export function getSection(
  sections: Record<string, string>,
  heading: string
): string | undefined {
  return sections[heading];
}
