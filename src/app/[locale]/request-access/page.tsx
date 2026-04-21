import { setRequestLocale } from "next-intl/server";
import Image from "next/image";

import { RequestAccessBrandOverlay } from "@/components/auth/RequestAccessBrandOverlay";
import { RequestAccessForm } from "@/components/auth/RequestAccessForm";

export const metadata = { title: "Request access — KOLMatrix" };

interface Props {
  params: Promise<{ locale: string }>;
}

export default async function RequestAccessPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="flex min-h-screen bg-surface">
      {/* Cinematic hero — lg+ only */}
      <section className="relative hidden w-[58%] overflow-hidden bg-surface-lowest lg:block">
        <Image
          src="/brand/signup-hero.png"
          alt=""
          fill
          priority
          sizes="58vw"
          className="scale-[1.05] object-cover opacity-60 brightness-[0.75]"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to right, rgba(11, 19, 38, 0.8), rgba(11, 19, 38, 0.1) 40%, transparent)",
          }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-20"
          style={{
            background:
              "radial-gradient(circle at right, rgba(0, 229, 255, 0.15), transparent 70%)",
          }}
          aria-hidden="true"
        />
        <RequestAccessBrandOverlay />
      </section>

      {/* Form column */}
      <section className="relative flex w-full flex-col items-center justify-center overflow-y-auto bg-surface px-6 py-12 sm:px-12 lg:w-[42%]">
        <RequestAccessForm locale={locale} />
      </section>
    </main>
  );
}
