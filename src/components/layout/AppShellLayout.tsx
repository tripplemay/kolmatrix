"use client";

import { usePathname } from "next/navigation";

import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { deriveActiveNav, deriveActivePageTitle } from "./nav-config";

interface AppShellLayoutProps {
  children: React.ReactNode;
  user: { name: string; role: string; email?: string | null; avatarUrl?: string | null };
  unreadNotifications?: number;
  currentLocale?: "en" | "zh" | "ja" | "ko" | "es";
  onSignOut?: () => void;
}

export function AppShellLayout({
  children,
  user,
  unreadNotifications,
  currentLocale,
  onSignOut,
}: AppShellLayoutProps) {
  const pathname = usePathname() ?? "/dashboard";
  const activeId = deriveActiveNav(pathname);
  const pageTitle = deriveActivePageTitle(activeId);

  return (
    <div className="bg-navy-base flex min-h-screen">
      <Sidebar activeId={activeId} user={user} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          pageTitle={pageTitle}
          user={user}
          unreadNotifications={unreadNotifications}
          currentLocale={currentLocale}
          onSignOut={onSignOut}
        />
        <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
      </div>
    </div>
  );
}
