import type { Metadata } from 'next';
import { ThemeScript, StickyNav } from './components';
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

export const metadata: Metadata = {
  metadataBase: new URL('https://github.com/runes780/word-quest-infinite-tome'),
  title: 'Word Quest: Infinite Tome — Project Overview',
  description:
    'An early-stage open-source AI+education project for English vocabulary learning. Game-based battles, SRS/FSRS review scheduling, mastery tracking, and guardian-facing learning evidence — built by a teacher.',
  openGraph: {
    title: 'Word Quest: Infinite Tome',
    description:
      'An open-source AI+education project combining game-based vocabulary battles, SRS/FSRS review scheduling, and transparent learning evidence.',
    type: 'website',
    url: 'https://github.com/runes780/word-quest-infinite-tome',
    images: [
      {
        url: '/wordquest/hero.png',
        width: 1672,
        height: 941,
        alt: 'Word Quest: Infinite Tome hero banner',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Word Quest: Infinite Tome',
    description: 'Open-source AI+education vocabulary learning project.',
    images: ['/wordquest/hero.png'],
  },
};

export default function ProjectPage() {
  return (
    <>
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
    </>
  );
}
