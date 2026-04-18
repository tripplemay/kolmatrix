import { redirect } from "next/navigation";

import { auth } from "@/auth";

// Server-side guard for the (app) route group. Middleware already redirects
// unauthenticated users, but keeping this here means API / streaming routes
// rendered under (app) cannot leak if the middleware matcher ever misses a
// path.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }
  return <>{children}</>;
}
