/**
 * BIx-mvp-polish-pass F005-F · App shell layout (server component).
 *
 * Previously this entire subtree (`Sidebar` + `Topbar` + everything
 * underneath) was a Client Component just so we could call
 * `usePathname()` once for active-nav highlighting + page-title
 * derivation. The active-nav read is now contained in:
 *
 *   - `SidebarNav` (already a CC; pulls `usePathname` directly)
 *   - `PageTitleClient` (leaf client island, ~30 lines)
 *
 * which lets this shell + Sidebar + Topbar regress to server
 * components, knocking the static logo / icons / user chip out of
 * the client bundle.
 */
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellLayoutProps {
  children: React.ReactNode;
  user: { name: string; role: string; email?: string | null; avatarUrl?: string | null };
  unreadNotifications?: number;
  onSignOut?: () => void;
}

export function AppShellLayout({
  children,
  user,
  unreadNotifications,
  onSignOut,
}: AppShellLayoutProps) {
  return (
    <div className="bg-navy-base min-h-screen">
      <Sidebar user={user} />
      <div className="ml-[240px] flex min-h-screen flex-col">
        <Topbar user={user} unreadNotifications={unreadNotifications} onSignOut={onSignOut} />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
