import { setRequestLocale } from "next-intl/server";
import Image from "next/image";

import { LoginBrandOverlay } from "@/components/auth/LoginBrandOverlay";
import { LoginForm } from "@/components/auth/LoginForm";

export const metadata = { title: "Sign in — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function LoginPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="grid min-h-screen grid-cols-1 bg-surface lg:grid-cols-[58fr_42fr]">
      {/* Cinematic hero — lg+ only */}
      <section className="relative hidden overflow-hidden bg-surface-lowest lg:block">
        <Image
          src="/brand/login-hero.png"
          alt=""
          fill
          priority
          sizes="58vw"
          className="object-cover brightness-[0.55]"
        />
        {/* Left-to-right dark gradient for text legibility */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(6, 13, 32, 0.9) 0%, rgba(6, 13, 32, 0.4) 100%)",
          }}
          aria-hidden="true"
        />
        {/* Cyan bleed at the right edge for continuity with the form column */}
        <div
          className="pointer-events-none absolute -right-48 top-0 bottom-0 w-96"
          style={{
            background:
              "radial-gradient(circle at center, rgba(0, 229, 255, 0.08) 0%, transparent 70%)",
          }}
          aria-hidden="true"
        />
        <LoginBrandOverlay />
      </section>

      {/* Form column */}
      <section className="relative flex flex-col items-center justify-center overflow-y-auto bg-surface px-6 py-12 sm:px-12">
        <LoginForm />
      </section>
    </main>
  );
}
