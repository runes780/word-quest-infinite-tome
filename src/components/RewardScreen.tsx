import { motion, AnimatePresence } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useSettingsStore } from '@/store/settingsStore';
import { translations } from '@/lib/translations';
import { Coins, ArrowRight, X } from 'lucide-react';
import { playSound } from '@/lib/audio';

export function RewardScreen() {
    const { showRewardScreen, pendingRewards, claimReward, closeRewardScreen, nextQuestion } = useGameStore();
    const { language, soundEnabled } = useSettingsStore();
    const t = translations[language];

    const handleContinue = () => {
        closeRewardScreen();
        nextQuestion();
    };

    return (
        <AnimatePresence>
            {showRewardScreen && (
                <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-3 backdrop-blur-sm sm:items-center sm:p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        role="dialog"
                        aria-modal="true"
                        aria-label={t.battle.rewards}
                        className="relative my-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border-2 border-yellow-500/50 bg-slate-900 shadow-[0_0_50px_rgba(234,179,8,0.2)]"
                    >
                        <button
                            type="button"
                            onClick={handleContinue}
                            aria-label={language === 'zh' ? '稍后领取并继续' : 'Skip rewards and continue'}
                            className="absolute right-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-2.5 py-1.5 text-xs font-semibold text-white/70 shadow-sm backdrop-blur hover:bg-black/60 hover:text-white"
                        >
                            <X className="h-4 w-4" />
                            <span className="hidden sm:inline">{language === 'zh' ? '稍后' : 'Later'}</span>
                        </button>
                        {/* Header */}
                        <div className="shrink-0 p-8 text-center border-b border-white/10 bg-gradient-to-b from-yellow-500/10 to-transparent">
                            <motion.div
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                                className="w-20 h-20 bg-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg shadow-yellow-500/50"
                            >
                                <Coins className="w-10 h-10 text-black" />
                            </motion.div>
                            <h2 className="text-3xl font-black text-yellow-500 tracking-wider uppercase drop-shadow-sm">
                                {t.battle.rewards}
                            </h2>
                        </div>

                        {/* Rewards Grid */}
                        <div className="min-h-0 flex-1 overflow-y-auto p-8 grid gap-4">
                            {pendingRewards.length === 0 ? (
                                <div className="text-center text-muted-foreground py-8">
                                    {t.battle.inventoryEmpty}
                                </div>
                            ) : (
                                pendingRewards.map((reward, index) => (
                                    <motion.button
                                        key={reward.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        onClick={() => {
                                            claimReward(reward.id);
                                            if (soundEnabled) playSound.coin();
                                        }}
                                        className="group relative flex items-center gap-6 p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-500/50 rounded-xl transition-all w-full text-left"
                                    >
                                        <div className="w-16 h-16 bg-black/50 rounded-lg flex items-center justify-center text-3xl border border-white/10 group-hover:scale-110 transition-transform">
                                            {reward.icon}
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-xl font-bold text-white group-hover:text-yellow-400 transition-colors whitespace-nowrap">
                                                {reward.label}
                                            </h3>
                                            {reward.description && (
                                                <p className="text-sm text-muted-foreground group-hover:text-white/70 transition-colors text-balance">
                                                    {reward.description}
                                                </p>
                                            )}
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-yellow-500 text-black px-4 py-1 rounded-full font-bold text-sm flex items-center gap-1 whitespace-nowrap">
                                            {t.battle.claim}
                                        </div>
                                    </motion.button>
                                ))
                            )}
                        </div>

                        {/* Footer */}
                        <div className="shrink-0 p-6 bg-black/20 border-t border-white/10 flex justify-end">
                            <button
                                onClick={handleContinue}
                                className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 text-black font-bold rounded-xl flex items-center gap-2 transition-colors shadow-lg shadow-yellow-500/20"
                            >
                                {pendingRewards.length > 0 ? t.battle.skip : t.battle.continue}
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
