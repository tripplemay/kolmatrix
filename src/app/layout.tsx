import type { Metadata } from "next";
import { getLocale } from "next-intl/server";
import { Inter } from "next/font/google";

import "../styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KOLMatrix",
  description: "Neural Velocity — AI-driven KOL campaign command center",
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
    <html lang={locale} className={`${inter.variable} h-full antialiased`}>
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/icon?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-25..200"
        />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
