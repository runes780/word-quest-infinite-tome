import type { Metadata } from 'next';
import { PlayableApp } from '@/components/PlayableApp';

export const metadata: Metadata = {
  title: 'Word Quest: Infinite Tome — Demo',
  description: 'Try the current Word Quest vocabulary learning demo.',
};

export default function DemoPage() {
  return <PlayableApp />;
}
