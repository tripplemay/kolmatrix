import { TopNav } from "./TopNav";
import { HeroVideo } from "./HeroVideo";
import { TrustPlaceholder } from "./TrustPlaceholder";
import { Features } from "./Features";
import { HowItWorks } from "./HowItWorks";
import { Stats } from "./Stats";
import { FAQ } from "./FAQ";
import { FooterCTA } from "./FooterCTA";

interface Props {
  locale: string;
}

/**
 * BL-114-F003 — section order recomposed to the Stitch "Neural Velocity"
 * prototype: Hero → logo strip → bento → how-it-works → stats → FAQ →
 * closing CTA, all on a single dark navy-base canvas (no light sections, no
 * dark↔light SectionTransition seams). The legacy PainPoints / BeforeAfter /
 * EmailCenterDemo sections (absent from the prototype) are unmounted here;
 * their files + now-unused helpers are deleted in F004.
 */
export function LandingPage({ locale }: Props) {
  return (
    <main
      className="min-h-screen bg-navy-base text-on-surface"
      data-testid="landing-page"
      data-landing-cinematic
      data-locale={locale}
    >
      <TopNav locale={locale} />
      <HeroVideo locale={locale} />
      <TrustPlaceholder />
      <Features />
      <HowItWorks />
      <Stats />
      <FAQ />
      <FooterCTA locale={locale} />
    </main>
  );
}
