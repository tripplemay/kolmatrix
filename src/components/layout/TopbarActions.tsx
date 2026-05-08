import { LanguageSwitcher } from "./LanguageSwitcher";
import { NotificationBell } from "./NotificationBell";
import { UserAvatarMenu } from "./UserAvatarMenu";

interface TopbarActionsProps {
  user: { name: string; email?: string | null; avatarUrl?: string | null };
  /** Real role enum (platform_admin / tenant_admin / marketer / client). */
  roleEnum?: string | null;
  unreadNotifications?: number;
  onSignOut?: () => void;
}

export function TopbarActions({
  user,
  roleEnum,
  unreadNotifications = 0,
  onSignOut,
}: TopbarActionsProps) {
  return (
    <div className="flex items-center gap-2">
      <LanguageSwitcher />
      <NotificationBell unread={unreadNotifications} />
      <span aria-hidden className="bg-outline-variant/40 mx-1 h-5 w-px" />
      <UserAvatarMenu user={user} role={roleEnum} onSignOut={onSignOut} />
    </div>
  );
}
