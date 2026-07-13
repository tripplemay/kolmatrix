/**
 * Sidebar — server-rendered shell. SidebarNav (the only client-side
 * piece) computes its own activeId via usePathname now (BIx-F005-F).
 */
import { SidebarLogo } from "./SidebarLogo";
import { SidebarNav } from "./SidebarNav";
import { SidebarUserChip } from "./SidebarUserChip";

interface SidebarProps {
  user: { name: string; role: string; avatarUrl?: string | null };
}

export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="bg-navy-800 fixed top-0 left-0 z-50 flex h-screen w-[240px] flex-col px-6 py-6 shadow-[20px_0_40px_-24px_rgba(0,0,0,0.55)]">
      <SidebarLogo />
      <SidebarNav />
      <SidebarUserChip name={user.name} role={user.role} avatarUrl={user.avatarUrl} />
    </aside>
  );
}
