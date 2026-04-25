/**
 * BM2-F010 · Shared (anonymous) route layout — bare HTML scaffold so
 * the marketing AppShell (sidebar/topbar/auth) is not inherited.
 *
 * Per Planner adjudication §F010: the anonymous shared-report page
 * lives at `/shared/weekly-report/[token]` and is reachable without
 * a session. We do not call `getMessages()` here because next-intl
 * needs a locale context the unauthenticated route does not have.
 */
import "../../styles/globals.css";

export default function SharedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-surface min-h-screen">{children}</body>
    </html>
  );
}
