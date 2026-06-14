'use client';

import { useSettingsStore } from '@/store/settingsStore';
import { ThemeScript, StickyNav } from './components';
import { LandingCopyProvider } from './landingI18n';
import {
  HeroSection,
  ProblemSection,
  SolutionSection,
  LearningLoopSection,
  ProductPreviewSection,
  GuardianEvidenceSection,
  ResponsibleAISection,
  StatusSection,
  AudienceSection,
  DifferentiatorsSection,
  FeedbackSection,
  TechStackSection,
  MaintainerSection,
  FooterSection,
} from './sections';

export function LandingPage() {
  const language = useSettingsStore((state) => state.language);

  return (
    <LandingCopyProvider language={language}>
      <ThemeScript />
      <StickyNav />
      <main className="min-h-screen bg-background text-foreground pt-14">
        <HeroSection />
        <ProblemSection />
        <SolutionSection />
        <LearningLoopSection />
        <ProductPreviewSection />
        <GuardianEvidenceSection />
        <ResponsibleAISection />
        <StatusSection />
        <AudienceSection />
        <DifferentiatorsSection />
        <FeedbackSection />
        <TechStackSection />
        <MaintainerSection />
        <FooterSection />
      </main>
    </LandingCopyProvider>
  );
}
