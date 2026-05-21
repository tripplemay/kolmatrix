import { TopNav } from "./TopNav";
import { Hero } from "./Hero";
import { PainPoints } from "./PainPoints";
import { BeforeAfter } from "./BeforeAfter";
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
      <TopNav locale={locale} />
      <Hero locale={locale} />
      <PainPoints />
      <BeforeAfter />
      <Features locale={locale} />
      <EmailCenterDemo />
      <TrustPlaceholder />
      <FAQ />
      <FooterCTA locale={locale} />
    </main>
  );
}
