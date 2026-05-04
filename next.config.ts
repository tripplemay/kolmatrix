import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * BIx-mvp-polish-pass F005 Part A — production polish.
 *
 * - `images.remotePatterns` whitelists every CDN we render through
 *   `next/image`. The full set is YouTube avatars + thumbnails (today's
 *   only KOL platform); Twitch/TikTok/Bilibili rows in seed data don't
 *   carry public CDN avatars yet, so they're commented out as
 *   placeholders. Add patterns when those connectors ship.
 * - `optimizePackageImports` peels recharts + @base-ui/react so per-
 *   page bundles only land the symbols actually rendered.
 * - `serverExternalPackages` keeps native / heavy deps server-side
 *   (Prisma client, bcrypt, googleapis, resend) so the client bundle
 *   never tries to load them.
 * - `headers()` pins the 6-header security baseline. CSP runs Report-
 *   Only this batch (one-week observation period); next batch flips
 *   to enforce.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // YouTube — current sole KOL CDN surface
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "yt3.ggpht.com" },
      { protocol: "https", hostname: "yt3.googleusercontent.com" },
      // KOLMatrix dev / staging tenant logos (Stitch fixtures)
      { protocol: "https", hostname: "stitch.withgoogle.com" },
      // TODO BIx-next: enable when Twitch/TikTok/Bilibili adapters ship
      // { protocol: "https", hostname: "static-cdn.jtvnw.net" },        // Twitch
      // { protocol: "https", hostname: "p16-sign-va.tiktokcdn.com" },   // TikTok
      // { protocol: "https", hostname: "i0.hdslb.com" },                // Bilibili
    ],
    formats: ["image/avif", "image/webp"],
  },
  experimental: {
    optimizePackageImports: ["recharts", "@base-ui/react"],
  },
  serverExternalPackages: [
    "@prisma/client",
    "bcrypt",
    "googleapis",
    "resend",
  ],
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          // CSP enforce mode (v0.9.10+ — BL-020-F006 切换 2026-05-04
          // after the F005 prod-mvp audit completed; staging will run
          // the previous Report-Only directives unchanged for one week
          // so any belated violation surfaces in DevTools before the
          // next prod redeploy).
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https://aigc.guangai.ai",
              "frame-ancestors 'none'",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
