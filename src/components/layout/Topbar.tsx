import { TopbarActions } from "./TopbarActions";
import { TopbarSearch } from "./TopbarSearch";

interface TopbarProps {
  pageTitle: string;
  user: { name: string; email?: string | null; avatarUrl?: string | null };
  unreadNotifications?: number;
  currentLocale?: "en" | "zh" | "ja" | "ko" | "es";
  onSignOut?: () => void;
}

export function Topbar({
  pageTitle,
  user,
  unreadNotifications,
  currentLocale,
  onSignOut,
}: TopbarProps) {
  return (
    <header className="bg-navy-base/85 sticky top-0 z-30 flex h-16 items-center gap-6 px-8 shadow-[0_4px_20px_rgba(0,0,0,0.30)] backdrop-blur-[24px]">
      <h1 className="text-on-surface shrink-0 text-[16px] font-semibold">{pageTitle}</h1>
      <div className="flex flex-1 justify-center">
        <TopbarSearch className="max-w-[480px]" />
      </div>
      <TopbarActions
        user={user}
        unreadNotifications={unreadNotifications}
        currentLocale={currentLocale}
        onSignOut={onSignOut}
      />
    </header>
  );
}
