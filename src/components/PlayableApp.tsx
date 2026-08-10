'use client';

import { useEffect, useState } from 'react';
import { motion, MotionConfig } from 'framer-motion';
import { BookOpen } from 'lucide-react';
import { BattleInterface } from '@/components/BattleInterface';
import { InputSection } from '@/components/InputSection';
import { MistakeNotebook } from '@/components/MistakeNotebook';
import { ParentDashboard } from '@/components/ParentDashboard';
import { SettingsModal } from '@/components/SettingsModal';
import { VerbCodex } from '@/components/VerbCodex';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getPlayerProfile } from '@/db/db';

export function PlayableApp() {
  const { questions } = useGameStore();
  const { language } = useSettingsStore();
  const [codexOpen, setCodexOpen] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [questions.length]);

  useEffect(() => {
    getPlayerProfile()
      .then((p) => useGameStore.getState().setUnlockedVerbs(p.unlockedVerbs ?? ['recognize', 'recall']))
      .catch(() => { /* profile load is best-effort for unlock hydration */ });
  }, []);

  return (
    <MotionConfig reducedMotion="user">
    <main className="min-h-screen bg-background text-foreground overflow-hidden relative">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center [mask-image:linear-gradient(180deg,white,rgba(255,255,255,0))]" />
      <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 via-transparent to-purple-500/5" />

      <SettingsModal />
      <MistakeNotebook />
      <ParentDashboard />
      <VerbCodex isOpen={codexOpen} onClose={() => setCodexOpen(false)} />

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
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setCodexOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
            >
              <BookOpen className="w-4 h-4" />
              {language === 'zh' ? '动词典籍' : 'Verb Codex'}
            </button>
          </div>
        </header>

        <div className="flex-1 flex flex-col justify-center">
          {questions.length > 0 ? (
            <BattleInterface />
          ) : (
            <InputSection />
          )}
        </div>

        <footer className="text-center text-sm text-muted-foreground py-8">
          <p>{language === 'zh' ? '系统状态：在线 | 神经链接：已激活' : 'System Status: ONLINE | Neural Link: ACTIVE'}</p>
        </footer>
      </div>
    </main>
    </MotionConfig>
  );
}
