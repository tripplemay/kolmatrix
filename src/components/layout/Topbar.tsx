/**
 * Topbar — server component (BIx-F005-F). The page title now comes
 * from a leaf client component (`PageTitleClient`) that owns the
 * pathname read; everything else stays server-rendered.
 */
import { PageTitleClient } from "./PageTitleClient";
import { TopbarActions } from "./TopbarActions";
import { TopbarSearch } from "./TopbarSearch";

interface TopbarProps {
  user: { name: string; email?: string | null; avatarUrl?: string | null };
  /** Real role enum, forwarded to UserAvatarMenu for the F006a admin gate. */
  roleEnum?: string | null;
  unreadNotifications?: number;
  onSignOut?: () => void;
}

export function Topbar({ user, roleEnum, unreadNotifications, onSignOut }: TopbarProps) {
  return (
    <header className="bg-navy-base/85 sticky top-0 z-40 flex h-16 items-center gap-6 px-8 shadow-[0_4px_20px_rgba(0,0,0,0.30)] backdrop-blur-[24px]">
      <PageTitleClient />
      <div className="flex flex-1 justify-center">
        <TopbarSearch className="max-w-[480px]" />
      </div>
      <TopbarActions
        user={user}
        roleEnum={roleEnum}
        unreadNotifications={unreadNotifications}
        onSignOut={onSignOut}
      />
    </header>
  );
}
