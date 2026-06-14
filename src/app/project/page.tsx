import type { Metadata } from 'next';
import { LandingPage } from './LandingPage';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://word-quest-infinite-tome.vercel.app').replace(/\/$/, '');

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Word Quest: Infinite Tome — Project Overview',
  description:
    'An early-stage open-source AI+education project for English vocabulary learning. Game-based battles, SRS/FSRS review scheduling, mastery tracking, and guardian-facing learning evidence — built by a teacher.',
  openGraph: {
    title: 'Word Quest: Infinite Tome',
    description:
      'An open-source AI+education project combining game-based vocabulary battles, SRS/FSRS review scheduling, and transparent learning evidence.',
    type: 'website',
    url: `${SITE_URL}/project`,
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
  return <LandingPage />;
}
