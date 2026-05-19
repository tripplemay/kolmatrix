import { Hero } from "./Hero";
import { PainPoints } from "./PainPoints";
import { Features } from "./Features";
import { EmailCenterDemo } from "./EmailCenterDemo";
import { TrustPlaceholder } from "./TrustPlaceholder";
import { FAQ } from "./FAQ";
import { FooterCTA } from "./FooterCTA";

interface Props {
  locale: string;
}

export function LandingPage({ locale }: Props) {
  return (
    <main
      className="min-h-screen bg-surface text-on-surface"
      data-testid="landing-page"
      data-locale={locale}
    >
      <Hero locale={locale} />
      <PainPoints />
      <Features locale={locale} />
      <EmailCenterDemo />
      <TrustPlaceholder />
      <FAQ />
      <FooterCTA locale={locale} />
    </main>
  );
}
