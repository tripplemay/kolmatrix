import { redirect } from "next/navigation";

import { auth, signOut } from "@/auth";
import { NetworkStatusBanner } from "@/components/common";
import { AppShellLayout } from "@/components/layout/AppShellLayout";

const ROLE_LABELS: Record<string, string> = {
  marketer: "Ops Lead",
  manager: "Campaign Manager",
  admin: "Platform Admin",
};

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  async function handleSignOut() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  const sessionUser = session.user;

  return (
    <>
      <NetworkStatusBanner />
      <AppShellLayout
        user={{
          name: sessionUser.name ?? sessionUser.email ?? "Operator",
          role: ROLE_LABELS[sessionUser.role ?? ""] ?? "Ops Lead",
          email: sessionUser.email,
          avatarUrl: sessionUser.image,
        }}
        unreadNotifications={1}
        onSignOut={handleSignOut}
      >
        {children}
      </AppShellLayout>
    </>
  );
}
