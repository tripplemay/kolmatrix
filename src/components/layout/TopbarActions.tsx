import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { UserAvatarMenu } from "./UserAvatarMenu";

interface TopbarActionsProps {
  user: { name: string; email?: string | null; avatarUrl?: string | null };
  unreadNotifications?: number;
  currentLocale?: "en" | "zh" | "ja" | "ko" | "es";
  onSignOut?: () => void;
}

export function TopbarActions({
  user,
  unreadNotifications = 0,
  currentLocale = "en",
  onSignOut,
}: TopbarActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher currentLocale={currentLocale} />
      <NotificationBell unread={unreadNotifications} />
      <span aria-hidden className="bg-outline-variant/40 mx-1 h-5 w-px" />
      <UserAvatarMenu user={user} onSignOut={onSignOut} />
    </div>
  );
}
