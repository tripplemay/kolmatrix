import { auth, signOut } from "@/auth";
import { withTenant } from "@/lib/db";

export const metadata = { title: "Dashboard — KOLMatrix" };

// F004 stub: proves tenant-scoped queries work end-to-end.
// F007 will replace this with the pixel-perfect Dashboard.
export default async function DashboardStub() {
  const session = await auth();
  const tenantId = session?.user.tenantId;
  const kolCount = tenantId ? await withTenant(tenantId, (tx) => tx.kol.count()) : 0;

  async function logout() {
    "use server";
    await signOut({ redirectTo: "/login" });
  }

  return (
    <main className="flex flex-1 items-center justify-center p-12">
      <section className="glass-panel ambient-glow flex max-w-xl flex-col gap-4 p-10">
        <span className="text-on-surface-variant text-xs font-semibold tracking-[0.2em] uppercase">
          Dashboard (F004 stub)
        </span>
        <h1 className="gradient-text text-3xl font-bold tracking-tight">
          Welcome, {session?.user.name ?? "Operator"}
        </h1>
        <p className="text-on-surface-variant text-sm">
          Tenant-scoped KOL count: <strong className="text-cyan">{kolCount}</strong>
        </p>
        <p className="text-on-surface-variant text-xs">
          Pixel-perfect layout arrives with F005 + F007. Hitting the DB now verifies RLS.
        </p>
        <form action={logout}>
          <button
            type="submit"
            className="bg-surface-high text-on-surface hover:bg-surface-highest h-9 rounded-md px-4 text-sm font-medium transition-colors"
          >
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}
