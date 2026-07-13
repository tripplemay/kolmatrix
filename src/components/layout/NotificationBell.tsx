interface NotificationBellProps {
  unread?: number;
}

export function NotificationBell({ unread = 0 }: NotificationBellProps) {
  const hasUnread = unread > 0;
  return (
    <button
      type="button"
      aria-label={hasUnread ? `Notifications (${unread} unread)` : "Notifications"}
      className="hover:text-brand-400 text-on-surface-variant hover:bg-navy-700/60 relative inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors"
    >
      <span className="material-symbols-outlined text-[20px]" aria-hidden>
        notifications
      </span>
      {hasUnread ? (
        <span className="bg-warning absolute top-2 right-2 h-1.5 w-1.5 rounded-full" />
      ) : null}
    </button>
  );
}
