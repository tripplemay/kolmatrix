import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/zh/request-access", "/en/request-access"],
      disallow: [
        "/zh/insight", "/en/insight",
        "/zh/match", "/en/match",
        "/zh/reach", "/en/reach",
        "/zh/crm", "/en/crm",
        "/zh/brief", "/en/brief",
        "/zh/campaigns", "/en/campaigns",
        "/zh/roi", "/en/roi",
        "/zh/assets", "/en/assets",
        "/zh/admin", "/en/admin",
        "/admin",
        "/api",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
