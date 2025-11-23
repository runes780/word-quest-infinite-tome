
'use client';

import { useGameStore } from '@/store/gameStore';
import { InputSection } from '@/components/InputSection';
import { BattleInterface } from '@/components/BattleInterface';
import { SettingsModal } from '@/components/SettingsModal';
import { motion } from 'framer-motion';

import { useSettingsStore } from '@/store/settingsStore';
import { useEffect } from 'react';

export default function Home() {
  const { questions } = useGameStore();
  const { apiKey, setSettingsOpen } = useSettingsStore();

  useEffect(() => {
    if (!apiKey) {
      setSettingsOpen(true);
    }
  }, [apiKey, setSettingsOpen]);

  return (
    <main className="min-h-screen bg-background text-foreground overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-purple-500/5" />

      <SettingsModal />

      <div className="relative z-10 container mx-auto px-4 py-8 min-h-screen flex flex-col">
        <header className="text-center mb-12 pt-8">
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl md:text-6xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-primary to-purple-400 mb-4"
          >
            WORD QUEST
          </motion.h1>
          <motion.p
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-muted-foreground font-medium"
          >
            INFINITE TOME PROTOCOL
          </motion.p>
        </header>

        <div className="flex-1 flex flex-col justify-center">
          {questions.length > 0 ? (
            <BattleInterface />
          ) : (
            <InputSection />
          )}
        </div>

        <footer className="text-center text-sm text-muted-foreground py-8">
          <p>System Status: ONLINE | Neural Link: ACTIVE</p>
        </footer>
      </div>
    </main>
  );
}
