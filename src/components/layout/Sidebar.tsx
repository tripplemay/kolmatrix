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
    <aside className="bg-surface-lowest flex w-[240px] shrink-0 flex-col">
      <div className="px-5 pt-6 pb-5">
        <SidebarLogo />
      </div>
      <div className="px-5 pb-4">
        <button
          type="button"
          className="gradient-cta inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-[12px] text-[13px] font-semibold transition-shadow hover:shadow-[0_0_24px_rgba(0,229,255,0.4)]"
        >
          <span className="material-symbols-outlined text-[18px]" aria-hidden>
            add
          </span>
          Create Campaign
        </button>
      </div>
      <SidebarNav activeId={activeId} />
      <SidebarUserChip name={user.name} role={user.role} avatarUrl={user.avatarUrl} />
    </aside>
  );
}
