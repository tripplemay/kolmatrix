import { redirect } from "next/navigation";

import { auth } from "@/auth";

import { LandingPage } from "./(marketing)/_components/LandingPage";

/**
 * 2026-05-19 landing page · Root locale page.
 *
 * Anonymous → render marketing landing.
 * Authenticated → redirect to /insight (user's home surface).
 *
 * Middleware also performs this split for the un-prefixed `/` so
 * authenticated users skip the landing page entirely; this server
 * component is the fallback for direct `/zh/` or `/en/` visits.
 */
interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LocalizedRootPage({ params }: Props) {
  const { locale } = await params;
  const session = await auth();
  if (session?.user) {
    redirect(`/${locale}/insight`);
  }
  return <LandingPage locale={locale} />;
}
