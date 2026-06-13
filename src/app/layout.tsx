import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Inter, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";

import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

// BL-114-F001 — Neural Velocity landing (Stitch prototype) pairs Inter with
// JetBrains Mono for technical labels (eyebrow / step numbers / stats
// captions). Exposed as `--font-jetbrains-mono` and wired to Tailwind's
// `font-mono` utility via `--font-mono` in globals.css.
const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

// BIx-mvp-polish-pass F005-B: Material Symbols self-hosted as a
// 61-icon subset (~8KB). Keep the icon roster in sync — see
// `scripts/regenerate-material-symbols-subset.sh` for the grep-based
// regeneration recipe. The companion `.material-symbols-outlined`
// CSS rules live in `src/styles/globals.css` and consume the
// `--font-material-symbols` variable wired below.
const materialSymbols = localFont({
  src: "./fonts/material-symbols-outlined.woff2",
  variable: "--font-material-symbols",
  display: "swap",
  weight: "100 700",
  style: "normal",
});

// Cinematic v2 landing page — Geist Sans + Mono. Only landing-page
// components opt in via Tailwind `font-geist` / `font-geist-mono`
// utility classes. App side stays on Inter via `font-sans`.
const geistSans = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist-sans-raw",
  display: "swap",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono-raw",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "KOLMatrix",
  // BL-055 F005 — replaces the Stitch-design codename "Neural Velocity"
  // with the bilingual product tagline so SEO + browser-tab preview
  // match what the sidebar renders.
  description: "KOLMatrix — Game KOL Marketing Platform / 游戏 KOL 智能营销平台",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // MVP-i18n-F006: dynamic <html lang> — next-intl's middleware sets
  // the active locale on every request via setRequestLocale (called
  // from the [locale] layout), so getLocale() resolves the same value
  // before the children server-render. Falls back to
  // routing.defaultLocale ("en") on routes that bypass i18n
  // (e.g. /shared/* anonymous report links).
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      className={`${inter.variable} ${materialSymbols.variable} ${geistSans.variable} ${geistMono.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
