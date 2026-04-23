import { redirect } from "next/navigation";

/**
 * BM1-F008 · Localized root redirect.
 *
 * `/` is handled by the middleware (which performs Accept-Language /
 * cookie detection → redirects to `/{locale}/dashboard`). When a user
 * types `/zh/` or `/en/` directly, we still need a page to resolve;
 * this one shortcuts to the dashboard so the auth middleware can then
 * route unauthenticated traffic to /login as usual.
 */
interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LocalizedRootPage({ params }: Props): Promise<never> {
  const { locale } = await params;
  redirect(`/${locale}/dashboard`);
}
