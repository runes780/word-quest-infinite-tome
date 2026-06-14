import type { Metadata } from 'next';
import { PlayableApp } from '@/components/PlayableApp';

export const metadata: Metadata = {
  title: 'Word Quest: Infinite Tome — Playable Prototype',
  description: 'Play the current Word Quest vocabulary learning prototype.',
};

export default function AppPage() {
  return <PlayableApp />;
}
