import { SidebarLogo } from "./SidebarLogo";
import { SidebarNav } from "./SidebarNav";
import { SidebarUserChip } from "./SidebarUserChip";
import type { NavItemId } from "./nav-config";

interface SidebarProps {
  activeId: NavItemId;
  user: { name: string; role: string; avatarUrl?: string | null };
}

export function Sidebar({ activeId, user }: SidebarProps) {
  return (
    <aside className="bg-surface-lowest fixed top-0 left-0 z-50 flex h-screen w-[240px] flex-col px-6 py-6 shadow-[20px_0_20px_-15px_rgba(0,229,255,0.03)]">
      <SidebarLogo />
      <SidebarNav activeId={activeId} />
      <SidebarUserChip name={user.name} role={user.role} avatarUrl={user.avatarUrl} />
    </aside>
  );
}
