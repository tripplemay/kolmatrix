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
 *
 * BL-012-F006a · `roleEnum` is the raw role from the session (e.g.
 * `tenant_admin`); the Sidebar still uses the human-readable label
 * the (app) layout supplies on `user.role`.
 */
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

interface AppShellLayoutProps {
  children: React.ReactNode;
  user: { name: string; role: string; email?: string | null; avatarUrl?: string | null };
  /** Raw role enum — forwarded to Topbar/UserAvatarMenu for the admin gate. */
  roleEnum?: string | null;
  unreadNotifications?: number;
  onSignOut?: () => void;
}

export function AppShellLayout({
  children,
  user,
  roleEnum,
  unreadNotifications,
  onSignOut,
}: AppShellLayoutProps) {
  return (
    // BL-HORIZON-FE-PILOT F001 — `font-dm` switches the entire app subtree to
    // DM Sans (Horizon body font). Scoped here (not on <body>) so landing /
    // auth surfaces stay on Inter (out of pilot scope). F002 restyles the
    // shell colors + applies Poppins to headings.
    <div className="bg-navy-base min-h-screen font-dm">
      <Sidebar user={user} />
      <div className="ml-[240px] flex min-h-screen flex-col">
        <Topbar
          user={user}
          roleEnum={roleEnum}
          unreadNotifications={unreadNotifications}
          onSignOut={onSignOut}
        />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
