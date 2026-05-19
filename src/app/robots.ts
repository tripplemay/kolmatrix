import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://kol.guangai.ai";
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/zh/request-access", "/en/request-access"],
      disallow: [
        "/insight",
        "/match",
        "/reach",
        "/crm",
        "/brief",
        "/campaigns",
        "/roi",
        "/assets",
        "/admin",
        "/api",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
