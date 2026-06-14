import { TopNav } from "./TopNav";
import { HeroVideo } from "./HeroVideo";
import { LandingAnalytics } from "./LandingAnalytics";
import { TrustPlaceholder } from "./TrustPlaceholder";
import { PainPoints } from "./PainPoints";
import { Features } from "./Features";
import { EmailCenterDemo } from "./EmailCenterDemo";
import { HowItWorks } from "./HowItWorks";
import { Stats } from "./Stats";
import { FAQ } from "./FAQ";
import { FooterCTA } from "./FooterCTA";

interface Props {
  locale: string;
}

/**
 * BL-114-F003 — single dark navy-base canvas (no light sections / no
 * SectionTransition seams). BL-115-F001 — LandingAnalytics + trial CTAs.
 * BL-115-F003 — re-adds the email-focused PainPoints + EmailCenterDemo per
 * the placement doc, ordered: Hero → logo strip → pain points → capability
 * bento → email-center demo → how-it-works → stats → FAQ → closing CTA.
 * (BeforeAfter + SectionTransition stay deleted — absent from the prototype.)
 */
export function LandingPage({ locale }: Props) {
  return (
    <main
      className="min-h-screen bg-navy-base text-on-surface"
      data-testid="landing-page"
      data-landing-cinematic
      data-locale={locale}
    >
      <LandingAnalytics />
      <TopNav locale={locale} />
      <HeroVideo />
      <TrustPlaceholder />
      <PainPoints />
      <Features />
      <EmailCenterDemo />
      <HowItWorks />
      <Stats />
      <FAQ />
      <FooterCTA locale={locale} />
    </main>
  );
}
