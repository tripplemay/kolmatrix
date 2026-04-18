import { auth } from "@/auth";
import { withTenant } from "@/lib/db";

export const metadata = { title: "Dashboard — KOLMatrix" };

// F005 stub: the App Shell (Sidebar + Topbar) is now provided by (app)/layout.tsx.
// The pixel-perfect dashboard (5 blocks, F010 common components) arrives with F007.
export default async function DashboardPage() {
  const session = await auth();
  const tenantId = session?.user.tenantId;
  const kolCount = tenantId ? await withTenant(tenantId, (tx) => tx.kol.count()) : 0;

  return (
    <section className="glass-panel ambient-glow mx-auto flex max-w-xl flex-col gap-4 p-10">
      <span className="text-on-surface-variant text-xs font-semibold tracking-[0.2em] uppercase">
        Dashboard (F005 App Shell active)
      </span>
      <h1 className="gradient-text text-3xl font-bold tracking-tight">
        Welcome, {session?.user.name ?? "Operator"}
      </h1>
      <p className="text-on-surface-variant text-sm">
        Tenant-scoped KOL count: <strong className="text-cyan">{kolCount}</strong>
      </p>
      <p className="text-on-surface-variant text-xs">
        Sidebar, Topbar, search (⌘K), and user menu are provided by AppShellLayout. F007 will wire
        up the 5 dashboard blocks using the F010 common component library.
      </p>
    </section>
  );
}
