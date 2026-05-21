import { TopNav } from "./TopNav";
import { HeroVideo } from "./HeroVideo";
import { PainPoints } from "./PainPoints";
import { BeforeAfter } from "./BeforeAfter";
import { Features } from "./Features";
import { EmailCenterDemo } from "./EmailCenterDemo";
import { TrustPlaceholder } from "./TrustPlaceholder";
import { FAQ } from "./FAQ";
import { FooterCTA } from "./FooterCTA";
import { SectionTransition } from "./SectionTransition";

interface Props {
  locale: string;
}

export function LandingPage({ locale }: Props) {
  return (
    <main
      className="min-h-screen bg-surface text-on-surface"
      data-testid="landing-page"
      data-landing-cinematic
      data-locale={locale}
    >
      <TopNav locale={locale} />
      <HeroVideo locale={locale} />
      <SectionTransition from="dark" to="light" />
      <PainPoints />
      <SectionTransition from="light" to="dark" />
      <BeforeAfter />
      <SectionTransition from="dark" to="light" />
      <Features locale={locale} />
      <SectionTransition from="light" to="dark" />
      <EmailCenterDemo />
      <SectionTransition from="dark" to="light" />
      <TrustPlaceholder />
      <SectionTransition from="light" to="dark" />
      <FAQ />
      <FooterCTA locale={locale} />
    </main>
  );
}
