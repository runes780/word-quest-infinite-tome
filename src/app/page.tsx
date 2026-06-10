
import type { Metadata } from 'next';
import { LandingPage } from './project/LandingPage';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://word-quest-infinite-tome.vercel.app').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Word Quest: Infinite Tome — AI Vocabulary Learning Game',
  description:
    'An early-stage open-source AI+education project for English vocabulary learning. Game-based battles, SRS/FSRS review scheduling, mastery tracking, and guardian-facing learning evidence.',
  openGraph: {
    title: 'Word Quest: Infinite Tome',
    description:
      'An open-source AI+education project combining game-based vocabulary battles, SRS/FSRS review scheduling, and transparent learning evidence.',
    type: 'website',
    url: SITE_URL,
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

export default LandingPage;
