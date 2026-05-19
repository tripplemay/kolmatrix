/**
 * BM2-F010 · @media print stylesheet (Planner adjudication §13 #K:A+C).
 *
 * Hides the AppShell sidebar / topbar / page chrome so a Print →
 * Save as PDF run produces the report on its own. Forces a light
 * paper-friendly palette per Planner §13.5 #12 — the cyan-on-glass
 * dark theme is great on screen but unreadable in print mode where
 * background colours often drop.
 */
export function WeeklyReportPrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: A4; margin: 16mm; }
        html, body { background: #ffffff !important; color: #111111 !important; }
        aside, header.sticky, nav[aria-label="Primary"],
        [data-testid="weekly-report-print-hide"] {
          display: none !important;
        }
        main { margin-left: 0 !important; }
        [data-testid="weekly-report-page"] {
          background: #ffffff !important;
          color: #111111 !important;
          max-width: none !important;
          padding: 0 !important;
        }
        [data-testid="weekly-report-page"] * {
          background: transparent !important;
          color: inherit !important;
          box-shadow: none !important;
          border-color: #e5e7eb !important;
        }
        [data-testid="weekly-report-page"] h1,
        [data-testid="weekly-report-page"] h2,
        [data-testid="weekly-report-page"] h3,
        [data-testid="weekly-report-page"] h4 {
          color: #000000 !important;
          page-break-after: avoid;
        }
        [data-testid="weekly-report-page"] section,
        [data-testid="weekly-report-page"] article {
          break-inside: avoid;
        }
      }
    `}</style>
  );
}
