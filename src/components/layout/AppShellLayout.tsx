"use client";

import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { deriveActiveNav, NAV_ITEMS } from "./nav-config";

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
  const pathname = usePathname() ?? "/dashboard";
  const activeId = deriveActiveNav(pathname);
  const t = useTranslations("nav");
  const activeItem = NAV_ITEMS.find((n) => n.id === activeId);
  const pageTitle = activeItem ? t(activeItem.i18nKey.replace(/^nav\./, "")) : "";

  return (
    <div className="bg-navy-base min-h-screen">
      <Sidebar activeId={activeId} user={user} />
      <div className="ml-[240px] flex min-h-screen flex-col">
        <Topbar
          pageTitle={pageTitle}
          user={user}
          unreadNotifications={unreadNotifications}
          onSignOut={onSignOut}
        />
        <main className="flex-1 px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
